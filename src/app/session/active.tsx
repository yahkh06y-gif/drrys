// Session step 4 — Active learning: "One idea at a time". Student explains, Coco grades (elaboration + self-explanation).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Btn, Coco, Enter, Pill, SessionHeader, T } from '@/components/ui';
import { gradeAnswer, type Grade } from '@/lib/ai';
import { haptic, play, tap } from '@/lib/feedback';
import { sessionContext } from '@/lib/session';
import { useApp } from '@/store';
import { C, F } from '@/theme';

export default function Active() {
  const qs = useApp((s) => s.session?.questions ?? []);
  const patchSession = useApp((s) => s.patchSession);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState(false);
  const [grade, setGrade] = useState<Grade>();
  const [busy, setBusy] = useState(false);
  const q = qs[i];
  if (!q) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const g = await gradeAnswer(await sessionContext(false), q, answer);
      setGrade(g);
      const st = useApp.getState().session!;
      patchSession({ answers: [...st.answers, answer], correct: st.correct + (g.correct ? 1 : 0) });
      if (g.correct) {
        play('success');
        haptic('success');
      } else {
        play('wrong');
        haptic('error');
      }
    } catch {
      setGrade({ correct: false, feedback: 'Coco lost connection — compare with the model answer below.' });
    }
    setBusy(false);
  };

  const next = () => {
    if (i + 1 >= qs.length) router.replace('/session/cards');
    else {
      play('flip');
      setI(i + 1);
      setAnswer('');
      setHint(false);
      setGrade(undefined);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <SessionHeader step={4} title="Active learning" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView key={i} contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Enter>
            <Pill text="COCO ASKS" />
            <T v="h2" style={{ marginTop: 6 }}>
              {i === qs.length - 1 ? 'Explain it your way' : 'One idea at a time'}
            </T>
            <T>Answer from memory. Coco will adapt the next question.</T>
            <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.leaf, marginTop: 4 }}>
              Question {i + 1} of {qs.length}
            </Text>
          </Enter>

          <Enter delay={120}>
            <View style={{ backgroundColor: C.white, borderRadius: 22, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 4, padding: 18 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 18, lineHeight: 26, color: C.teal, textAlign: 'center' }}>{q.q}</Text>
            </View>
          </Enter>

          {!grade && <Coco src={i === qs.length - 1 ? COCO.pointer : COCO.stand} size={130} />}

          {hint && !grade && (
            <Enter>
              <View style={{ backgroundColor: '#FFF6E3', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.amber }}>
                <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.goldInk }}>💡 {q.hint}</Text>
              </View>
            </Enter>
          )}

          {!grade ? (
            <View style={{ backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.lineStrong, padding: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: F.bold, fontSize: 10, letterSpacing: 0.5, color: C.goldInk }}>YOU’RE EXPLAINING</Text>
                <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.leaf }}>🎤 keyboard mic works too</Text>
              </View>
              <TextInput
                value={answer}
                onChangeText={setAnswer}
                multiline
                placeholder="Explain it in your own words…"
                placeholderTextColor="#A69A8A"
                style={{ minHeight: 90, fontFamily: F.medium, fontSize: 15, lineHeight: 22, color: C.ink, textAlignVertical: 'top' }}
              />
            </View>
          ) : (
            <Enter>
              <View style={{ backgroundColor: grade.correct ? '#F0F8E6' : '#FFF1EC', borderRadius: 20, borderWidth: 2, borderColor: grade.correct ? C.mintBorder : '#F2A58A', padding: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={grade.correct ? 'checkmark-circle' : 'refresh-circle'} size={24} color={grade.correct ? C.leaf : C.orange} />
                  <Text style={{ fontFamily: F.bold, fontSize: 16, color: grade.correct ? C.moss : C.orange }}>{grade.correct ? 'Nailed it!' : 'Almost there'}</Text>
                </View>
                <Text style={{ fontFamily: F.medium, fontSize: 14, lineHeight: 21, color: C.ink }}>{grade.feedback}</Text>
                <View style={{ borderTopWidth: 1, borderColor: C.line, paddingTop: 8 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.muted }}>MODEL ANSWER</Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.body, marginTop: 2 }}>{q.ideal}</Text>
                </View>
              </View>
            </Enter>
          )}
        </ScrollView>
        <View style={{ padding: 20, gap: 10 }}>
          {!grade ? (
            <>
              <Btn title="Finish explanation" iconLeft="checkmark-circle" kind="teal" pill loading={busy} disabled={!answer.trim()} onPress={submit} />
              {!hint && (
                <Pressable onPress={() => (tap(), setHint(true))} style={{ alignSelf: 'center', flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: C.sand, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 }}>
                  <Ionicons name="bulb-outline" size={14} color={C.body} />
                  <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.body }}>Need a hint?</Text>
                </Pressable>
              )}
            </>
          ) : (
            <Btn title={i + 1 >= qs.length ? 'Lock it in' : 'Next question'} icon="arrow-forward" kind="teal" pill onPress={next} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
