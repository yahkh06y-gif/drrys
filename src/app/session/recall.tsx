// Session step 2 — Brain Dump & Recall (active recall: retrieve before re-reading).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn, SessionHeader, T } from '@/components/ui';
import { aiEnabled } from '@/lib/ai';
import { DEMO } from '@/lib/demo';
import { tap } from '@/lib/feedback';
import { useApp } from '@/store';
import { C, F } from '@/theme';

export default function Recall() {
  const recall = useApp((s) => s.session?.recall ?? '');
  const patchSession = useApp((s) => s.patchSession);
  const [mode, setMode] = useState<'speak' | 'write'>('speak');
  const [active, setActive] = useState(false);
  const [secs, setSecs] = useState(0);
  const input = useRef<TextInput>(null);
  const ring = useSharedValue(1);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    ring.value = withRepeat(withTiming(1.15, { duration: 900 }), -1, true);
    return () => {
      clearInterval(t);
      ring.value = withTiming(1);
    };
  }, [active, ring]);

  const ringA = useAnimatedStyle(() => ({ transform: [{ scale: ring.value }] }));
  const words = recall.trim() ? recall.trim().split(/\s+/).length : 0;
  const mm = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <SessionHeader step={2} title="Recall" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: active ? C.red : C.lineStrong }} />
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.teal }}>{mode === 'speak' ? 'Voice recall' : 'Written recall'}</Text>
              </View>
              <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.goldInk, backgroundColor: C.sand, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>{mm}</Text>
            </View>

            {mode === 'speak' && (
              <View style={{ alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                <Pressable onPress={() => (tap(), input.current?.focus())}>
                  <Animated.View style={[{ width: 112, height: 112, borderRadius: 56, backgroundColor: 'rgba(190,243,127,0.4)', borderWidth: 1, borderColor: 'rgba(63,105,0,0.2)', alignItems: 'center', justifyContent: 'center' }, ringA]}>
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderColor: C.shadow }}>
                      <Ionicons name="mic" size={26} color={C.white} />
                    </View>
                  </Animated.View>
                </Pressable>
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.body, textAlign: 'center' }}>Tap, then press the 🎤 on your keyboard and just talk.</Text>
              </View>
            )}

            <TextInput
              ref={input}
              value={recall}
              onChangeText={(t) => patchSession({ recall: t })}
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
                {!aiEnabled && !recall && (
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
          <Btn title="Analyze & compare with lecture" icon="arrow-forward" kind="teal" pill disabled={words < 3} onPress={() => router.push('/session/analyze')} />
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.body, textAlign: 'center' }}>Coco will highlight what you nailed and where memory gaps are.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
