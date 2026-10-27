// Session step 2 — Brain Dump & Recall (active recall: retrieve before re-reading).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Segmented } from '@/design/components';

import { Btn, Enter, SessionHeader, T } from '@/components/ui';
import { MicButton, useVoice, VoiceHint, VoiceWave, withLive } from '@/components/Voice';
import { aiEnabled } from '@/lib/ai';
import { DEMO } from '@/lib/demo';
import { tap } from '@/lib/feedback';
import { onSample, SAMPLE_RECALL, typeOut } from '@/lib/sample';
import { useApp } from '@/store';
import { autoDir } from '@/design/rtl';
import { color, radius } from '@/design/tokens';
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
            <T>Tell Coco everything you remember from today’s lesson.</T>
          </View>

          {/* mode toggle */}
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { key: 'speak', label: 'Speak', icon: 'mic', badge: 'Best', badgeTone: 'brand' },
              { key: 'write', label: 'Write', icon: 'create-outline' },
            ]}
          />

          <View style={{ backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: color.border.subtle, paddingBottom: 9 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: active || voice.state === 'recording' ? C.red : C.lineStrong }} />
                <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.ink }}>{mode === 'speak' ? 'Voice recall' : 'Written recall'}</Text>
              </View>
              <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.body, backgroundColor: C.sand, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden', fontVariant: ['tabular-nums'] }}>{mm}</Text>
            </View>

            {mode === 'speak' && (
              <View style={{ alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                <MicButton voice={voice} size={72} style={{ marginTop: 14, marginBottom: voice.state === 'recording' ? 4 : 14 }} />
                {voice.state === 'recording' && <VoiceWave level={voice.level} active height={40} style={{ alignSelf: 'stretch', marginHorizontal: 8 }} />}
                <VoiceHint voice={voice} idle={recall ? 'Tap the mic to add more.' : 'Tap and talk, in Arabic or English.'} />
              </View>
            )}

            {sample && !recall && voice.state === 'idle' && (
              <Pressable
                onPress={() => (tap('select'), (stopTyping.current = typeOut(SAMPLE_RECALL, (t) => patchSession({ recall: t }))))}
                style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: C.mint, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 }}>
                <Ionicons name="sparkles-outline" size={14} color={C.moss} />
                <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.moss }}>Fill sample answer</Text>
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
              placeholderTextColor={C.mutedLight}
              style={[{ minHeight: mode === 'write' ? 220 : 110, backgroundColor: C.white, borderRadius: radius.lg, borderWidth: 1.5, borderColor: active ? color.border.focus : C.lineStrong, padding: 13, fontFamily: F.regular, fontSize: 16, lineHeight: 25, color: color.text.primary, textAlignVertical: 'top' }, autoDir(recall)]}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, fontVariant: ['tabular-nums'] }}>{words} words</Text>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                {!aiEnabled && !sample && !recall && (
                  <Pressable onPress={() => (tap(), patchSession({ recall: DEMO.recallExample }))}>
                    <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.leaf }}>Use example</Text>
                  </Pressable>
                )}
                {!!recall && (
                  <Pressable onPress={() => (tap(), patchSession({ recall: '' }))}>
                    <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.body }}>Clear</Text>
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
              <Btn title="Analyze & compare with lecture" icon="arrow-forward" kind="green" onPress={() => router.push('/session/analyze')} />
            </Enter>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
