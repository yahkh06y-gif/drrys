// Coco tab — talk to your learning companion.
// Layout: header (who you're talking to + how Coco talks; one tap opens Coco's settings) → the chat → one message bar.
// Before the first message the page shows Coco and three ways to start, so it never opens on an empty box.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Coco, Enter } from '@/components/ui';
import { useVoice, withLive } from '@/components/Voice';
import { chatCoco } from '@/lib/ai';
import { play, tap } from '@/lib/feedback';
import { activeSubject, useApp } from '@/store';
import { C, F } from '@/theme';

// failed: Coco couldn't be reached; the student can send the same message again
type Msg = { role: 'user' | 'assistant'; text: string; voice?: boolean; failed?: boolean; why?: string };
const STYLE_LABEL = { friendly: 'Friendly coach', calm: 'Calm tutor', direct: 'Direct & focused', playful: 'Playful buddy' };
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function CocoTab() {
  const coco = useApp((s) => s.coco);
  const name = useApp((s) => s.profile.name);
  const interests = useApp((s) => (s.coco.memory ? s.profile.interests : []));
  const subject = useApp(activeSubject);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [waiting, setWaiting] = useState(false);
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);

  const subjectName = subject?.name ?? '';
  const chapter = subject?.chapters[0]?.title ?? '';
  const first = name.trim().split(' ')[0];

  const send = useCallback(
    async (raw: string, voice?: boolean, before: Msg[] = msgs) => {
      const said = raw.trim();
      if (!said || waiting) return;
      tap('select');
      // what Coco sees: the conversation without the "couldn't reach Coco" lines
      const next: Msg[] = [...before.filter((m) => !m.failed), { role: 'user', text: said, ...(voice ? { voice: true } : {}) }];
      setMsgs(next);
      setText('');
      setWaiting(true);
      try {
        const reply = await chatCoco(
          {
            subject: subjectName || 'General',
            chapter,
            interests,
            style: STYLE_LABEL[coco.style],
            depth: coco.depth,
          },
          next.map(({ role, text: t }) => ({ role, text: t })),
        );
        setMsgs((m) => [...m, { role: 'assistant', text: reply.trim() }]);
        play('select');
      } catch (e) {
        // while developing, show the real reason (bad key, model name, region, rate limit…)
        const why = __DEV__ ? String((e as Error)?.message ?? e).slice(0, 220) : undefined;
        setMsgs((m) => [...m, { role: 'assistant', text: '', failed: true, why }]);
      }
      setWaiting(false);
    },
    [msgs, waiting, subjectName, chapter, interests, coco.style, coco.depth],
  );

  // a voice message is sent as soon as it's written down (same as Ask Coco); without voice the keyboard's mic is used
  const voice = useVoice(
    useCallback((t: string) => send(t, true), [send]),
    () => input.current?.focus(),
  );

  useEffect(() => {
    if (msgs.length) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
  }, [msgs.length, waiting]);

  // a failed line comes right after the message that didn't get through: trying again sends that message once more
  const retry = (k: number) => {
    const sent = msgs[k - 1];
    if (sent?.role === 'user') send(sent.text, sent.voice, msgs.slice(0, k - 1));
  };

  const newChat = () => {
    if (voice.state === 'recording') voice.toggle();
    setMsgs([]);
    setText('');
  };

  const starters: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: 'bulb-outline', text: chapter ? `Explain ${chapter} simply` : subjectName ? `Explain ${subjectName} simply` : 'Explain something simply' },
    { icon: 'help-circle-outline', text: subjectName ? `Quiz me on ${subjectName}` : 'Quiz me on what I’m studying' },
    { icon: 'calendar-outline', text: 'Help me plan today’s study' },
  ];

  const recording = voice.state === 'recording';
  const busyVoice = voice.state !== 'idle';
  const typed = !!text.trim();
  const empty = msgs.length === 0 && !waiting;
  const mode = [STYLE_LABEL[coco.style], subjectName].filter(Boolean).join(' · ');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.paper }}>
      {/* header: Coco + how Coco talks right now. Tapping it is the one way into Coco's settings. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Coco, ${mode}. Open Coco's settings`}
          onPress={() => (tap(), router.push('/customize'))}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 16, backgroundColor: pressed ? C.sand : 'transparent' })}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
            <Image source={COCO[coco.outfit] ?? COCO.classic} style={{ width: 38, height: 44, marginBottom: -4 }} contentFit="contain" />
          </View>
          <View style={{ flexShrink: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text accessibilityRole="header" style={{ fontFamily: F.bold, fontSize: 18, color: C.ink }}>
                Coco
              </Text>
              <Ionicons name="chevron-down" size={16} color={C.muted} />
            </View>
            <Text numberOfLines={1} style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>
              {mode}
            </Text>
          </View>
        </Pressable>
        {!empty && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New chat"
            onPress={() => (tap(), newChat())}
            hitSlop={8}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.sand : 'transparent' })}>
            <Ionicons name="create-outline" size={22} color={C.teal} />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingVertical: 16, gap: 14 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          {empty ? (
            <View style={{ flex: 1, justifyContent: 'center', gap: 20 }}>
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Coco src={COCO[coco.outfit] ?? COCO.classic} size={120} />
                <Text style={{ fontFamily: F.bold, fontSize: 22, lineHeight: 28, color: C.teal, textAlign: 'center', letterSpacing: -0.4 }}>
                  {first ? `Hi ${first}! What are we learning?` : 'Hi! What are we learning?'}
                </Text>
                <Text style={{ fontFamily: F.medium, fontSize: 15, lineHeight: 21, color: C.muted, textAlign: 'center' }}>
                  Ask me anything, or start with one of these.
                </Text>
              </View>
              <View style={{ gap: 8 }}>
                {starters.map((s, i) => (
                  <Enter key={s.text} delay={80 * i}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => send(s.text)}
                      style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 3, backgroundColor: pressed ? C.sand : C.white })}>
                      <Ionicons name={s.icon} size={20} color={C.teal} />
                      <Text numberOfLines={2} style={{ flex: 1, fontFamily: F.semi, fontSize: 15, color: C.ink }}>
                        {s.text}
                      </Text>
                      <Ionicons name="arrow-up" size={16} color={C.mutedLight} />
                    </Pressable>
                  </Enter>
                ))}
              </View>
            </View>
          ) : (
            msgs.map((m, k) =>
              m.role === 'user' ? (
                <Enter key={k} style={{ alignSelf: 'flex-end', maxWidth: '82%' }}>
                  <View style={{ backgroundColor: C.teal, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', gap: 6 }}>
                    {m.voice && <Ionicons name="mic" size={13} color="rgba(255,255,255,0.7)" style={{ marginTop: 4 }} />}
                    <Text style={{ flexShrink: 1, fontFamily: F.medium, fontSize: 15, lineHeight: 21, color: C.white }}>{m.text}</Text>
                  </View>
                </Enter>
              ) : m.failed ? (
                <Pressable key={k} accessibilityRole="button" onPress={() => retry(k)} hitSlop={6} style={{ alignSelf: 'flex-start', gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="refresh" size={15} color={C.orange} />
                    <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.orange }}>Couldn’t reach Coco. Tap to try again.</Text>
                  </View>
                  {m.why && <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.mutedLight }}>{m.why}</Text>}
                </Pressable>
              ) : (
                // Coco's replies read like text on the page, not boxes (same as Ask Coco in a session)
                <Enter key={k} style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
                  <Text selectable style={{ fontFamily: F.medium, fontSize: 16, lineHeight: 24, color: C.ink }}>
                    {m.text}
                  </Text>
                </Enter>
              ),
            )
          )}
          {waiting && <Typing />}
        </ScrollView>

        {/* message bar: type, or tap the mic and talk. While recording it turns into a recording bar. */}
        <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, backgroundColor: C.white, borderWidth: 1, borderColor: recording ? C.red : C.lineStrong, borderRadius: 26, paddingLeft: 16, paddingRight: 5, paddingVertical: 5, minHeight: 52 }}>
            {busyVoice ? (
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 42 }}>
                {recording ? (
                  <>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.red }} />
                    <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink }}>{clock(voice.seconds)}</Text>
                    <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: C.track, overflow: 'hidden' }}>
                      <View style={{ width: `${Math.round(15 + voice.level * 85)}%`, height: 4, backgroundColor: C.red }} />
                    </View>
                  </>
                ) : (
                  <>
                    <ActivityIndicator size="small" color={C.teal} />
                    <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.muted }}>Writing it down…</Text>
                  </>
                )}
              </View>
            ) : (
              <TextInput
                ref={input}
                value={withLive(text, voice.live)}
                onChangeText={setText}
                multiline
                placeholder="Message Coco"
                placeholderTextColor="#A69A8A"
                style={{ flex: 1, maxHeight: 120, paddingTop: 11, paddingBottom: 11, fontFamily: F.medium, fontSize: 16, color: C.ink }}
              />
            )}
            {typed && !busyVoice ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send"
                onPress={() => send(text)}
                disabled={waiting}
                style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: waiting ? C.lineStrong : C.teal, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="arrow-up" size={22} color={C.white} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={recording ? 'Send voice message' : 'Talk to Coco'}
                onPress={voice.toggle}
                disabled={voice.state === 'writing' || waiting}
                style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: recording ? C.red : C.sand, alignItems: 'center', justifyContent: 'center', opacity: voice.state === 'writing' || waiting ? 0.4 : 1 }}>
                <Ionicons name={recording ? 'arrow-up' : 'mic'} size={22} color={recording ? C.white : C.teal} />
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Three dots that rise one after another while Coco writes. */
function Typing() {
  return (
    <View accessible accessibilityLabel="Coco is typing" style={{ flexDirection: 'row', gap: 5, paddingVertical: 8, alignSelf: 'flex-start' }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} />
      ))}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(delay, withRepeat(withSequence(withTiming(-4, { duration: 280 }), withTiming(0, { duration: 280 }), withTiming(0, { duration: 240 })), -1));
  }, [delay, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: 0.45 + (-y.value / 4) * 0.55 }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal }, a]} />;
}
