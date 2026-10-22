// Session step 2 — Brain Dump & Recall (active recall: retrieve before re-reading).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn, Enter, SessionHeader, T } from '@/components/ui';
import { MicButton, useVoice, VoiceHint, withLive } from '@/components/Voice';
import { aiEnabled } from '@/lib/ai';
import { DEMO } from '@/lib/demo';
import { tap } from '@/lib/feedback';
import { onSample, SAMPLE_RECALL, typeOut } from '@/lib/sample';
import { useApp } from '@/store';
import { C, F } from '@/theme';

export default function Recall() {
  const recall = useApp((s) => s.session?.recall ?? '');
  const patchSession = useApp((s) => s.patchSession);
  const [mode, setMode] = useState<'speak' | 'write'>('speak');
  const [active, setActive] = useState(false);
  const [secs, setSecs] = useState(0);
  const sample = useApp(onSample); // the sample lecture: a ready-made (imperfect) brain dump is one tap away
  const stopTyping = useRef<() => void>(undefined);
  useEffect(() => () => stopTyping.current?.(), []);
  const input = useRef<TextInput>(null);
  // spoken recall: each recording is written down and added to what's already there
  const addSpoken = useCallback(
    (t: string) => {
      const cur = (useApp.getState().session?.recall ?? '').trim();
      patchSession({ recall: cur ? `${cur} ${t}` : t });
    },
    [patchSession],
  );
  const voice = useVoice(addSpoken, () => input.current?.focus());

  const going = active || voice.state === 'recording'; // the clock runs while typing or talking
  useEffect(() => {
    if (!going) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [going]);

  const words = recall.trim() ? recall.trim().split(/\s+/).length : 0;
  const mm = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <SessionHeader step={2} title="Recall" onBack={() => (router.canGoBack() ? router.back() : router.replace('/session/choose'))} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View>
            <T v="h2">Brain Dump & Recall</T>
            <T>Tell Coco what you remember about today’s lesson… Take your time and try to remember everything.</T>
          </View>

          {/* mode toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: '#EBE8E0', borderRadius: 16, padding: 5, borderWidth: 1, borderColor: C.lineStrong }}>
            {(['speak', 'write'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => (tap('select'), setMode(m))}
                style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: mode === m ? C.white : 'transparent', borderWidth: mode === m ? 1 : 0, borderColor: C.line }}>
                <Ionicons name={m === 'speak' ? 'mic' : 'create-outline'} size={14} color={m === 'speak' ? C.leaf : C.body} />
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: mode === m ? C.teal : C.body }}>{m === 'speak' ? 'Speak (Recommended)' : 'Write instead'}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ backgroundColor: C.white, borderRadius: 24, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 4, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: 'rgba(90,66,37,0.1)', paddingBottom: 9 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: active || voice.state === 'recording' ? C.red : C.lineStrong }} />
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.teal }}>{mode === 'speak' ? 'Voice recall' : 'Written recall'}</Text>
              </View>
              <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.goldInk, backgroundColor: C.sand, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>{mm}</Text>
            </View>

            {mode === 'speak' && (
              <View style={{ alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                <MicButton voice={voice} size={72} style={{ marginVertical: 14 }} />
                <VoiceHint voice={voice} idle={recall ? 'Tap the mic to add more.' : 'Tap the mic and just talk — Arabic or English.'} />
              </View>
            )}

            {sample && !recall && voice.state === 'idle' && (
              <Pressable
                onPress={() => (tap('select'), (stopTyping.current = typeOut(SAMPLE_RECALL, (t) => patchSession({ recall: t }))))}
                style={{ alignSelf: 'flex-start', backgroundColor: C.mint, borderWidth: 1, borderColor: C.mintBorder, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.mossDark }}>✨ Fill sample answer</Text>
              </Pressable>
            )}
            <TextInput
              ref={input}
              value={withLive(recall, voice.live)}
              onChangeText={(t) => voice.state !== 'recording' && patchSession({ recall: t })}
              onFocus={() => setActive(true)}
              onBlur={() => setActive(false)}
              multiline
              placeholder="“We started with…”"
              placeholderTextColor="#A69A8A"
              style={{ minHeight: mode === 'write' ? 220 : 110, backgroundColor: '#F6F3EB', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(90,66,37,0.1)', padding: 13, fontFamily: F.medium, fontSize: 14, lineHeight: 21, color: '#1C1C17', textAlignVertical: 'top' }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.muted }}>{words} words</Text>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                {!aiEnabled && !sample && !recall && (
                  <Pressable onPress={() => (tap(), patchSession({ recall: DEMO.recallExample }))}>
                    <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.leaf }}>Use example</Text>
                  </Pressable>
                )}
                {!!recall && (
                  <Pressable onPress={() => (tap(), patchSession({ recall: '' }))}>
                    <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.body }}>↺ Clear</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
        <View style={{ padding: 20, gap: 6 }}>
          {/* the button shows up once there's something to analyse */}
          {words >= 3 && voice.state === 'idle' ? (
            <Enter key="analyze">
              <Btn title="Analyze & compare with lecture" icon="arrow-forward" kind="teal" pill onPress={() => router.push('/session/analyze')} />
            </Enter>
          ) : null}
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.body, textAlign: 'center' }}>Coco will highlight what you nailed and where memory gaps are.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
