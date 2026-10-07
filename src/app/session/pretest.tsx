// Session step 2 — Warm-up: two guesses before the recall. Wrong is fine: trying to answer first
// primes the brain for what it is about to learn (the "pretesting effect").
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Btn, Coco, Enter, Pill, SessionHeader, T } from '@/components/ui';
import { makePretest, type PretestQ } from '@/lib/ai';
import { haptic, play, tap } from '@/lib/feedback';
import { sessionContext } from '@/lib/session';
import { useApp } from '@/store';
import { C, F } from '@/theme';

export default function Pretest() {
  const patchSession = useApp((s) => s.patchSession);
  const [qs, setQs] = useState<PretestQ[]>();
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState('');
  const [seen, setSeen] = useState(false); // the model answer is showing
  const [done, setDone] = useState<{ q: string; ideal: string; guess: string }[]>([]);

  const toRecall = (list: { q: string; ideal: string; guess: string }[]) => {
    patchSession({ pretest: list });
    router.replace('/session/recall');
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await makePretest(await sessionContext());
        if (!alive) return;
        if (!list.length) return toRecall([]);
        setQs(list);
      } catch {
        if (alive) toRecall([]); // no warm-up this time: never block the session on it
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = qs?.[i];

  const check = () => {
    if (!q) return;
    tap('select');
    haptic('light');
    setDone((d) => [...d, { q: q.q, ideal: q.ideal, guess: guess.trim() }]);
    setSeen(true);
  };

  const next = () => {
    if (!qs) return;
    if (i + 1 >= qs.length) return toRecall(done);
    play('flip');
    setI(i + 1);
    setGuess('');
    setSeen(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <SessionHeader step={2} title="Warm-up" />
      {!q ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
          <Coco src={COCO.reading} size={170} />
          <ActivityIndicator color={C.teal} />
          <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.muted, textAlign: 'center' }}>Coco is picking two warm-up questions…</Text>
          <Pressable onPress={() => toRecall([])} hitSlop={10}>
            <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.leaf }}>Skip the warm-up</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView key={i} contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            <Enter>
              <Pill text="WARM-UP · NOT GRADED" />
              <T v="h2" style={{ marginTop: 6 }}>
                Take a guess first
              </T>
              <T>You haven’t studied this yet, so a wrong guess is perfect: it gets your brain looking for the answer.</T>
              <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.leaf, marginTop: 4 }}>
                Guess {i + 1} of {qs?.length}
              </Text>
            </Enter>

            <Enter delay={120}>
              <View style={{ backgroundColor: C.white, borderRadius: 22, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 4, padding: 18 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 18, lineHeight: 26, color: C.teal, textAlign: 'center' }}>{q.q}</Text>
              </View>
            </Enter>

            {!seen ? (
              <View style={{ backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.lineStrong, padding: 12 }}>
                <TextInput
                  value={guess}
                  onChangeText={setGuess}
                  multiline
                  placeholder="My best guess is…"
                  placeholderTextColor="#A69A8A"
                  style={{ minHeight: 80, fontFamily: F.medium, fontSize: 15, lineHeight: 22, color: C.ink, textAlignVertical: 'top' }}
                />
              </View>
            ) : (
              <Enter>
                <View style={{ backgroundColor: '#F0F8E6', borderRadius: 18, borderWidth: 1, borderColor: C.mintBorder, padding: 14, gap: 4 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.leaf }}>THE IDEA, IN SHORT</Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 14, lineHeight: 21, color: C.ink }}>{q.ideal}</Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, marginTop: 4 }}>
                    Keep it in mind — the lecture will fill in the rest.
                  </Text>
                </View>
              </Enter>
            )}
          </ScrollView>
          <View style={{ padding: 20, gap: 10 }}>
            {!seen ? (
              <>
                <Btn title={guess.trim() ? 'Check my guess' : 'I have no idea — show me'} icon="arrow-forward" kind="teal" pill onPress={check} />
                <Pressable onPress={() => toRecall(done)} style={{ alignSelf: 'center' }}>
                  <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Skip the warm-up</Text>
                </Pressable>
              </>
            ) : (
              <Btn title={i + 1 >= (qs?.length ?? 0) ? 'Start my recall' : 'Next guess'} icon="arrow-forward" kind="teal" pill onPress={next} />
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
