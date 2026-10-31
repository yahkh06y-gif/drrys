// Coco tab — talk to your learning companion.
// Layout, top to bottom:
//   1. title row: "Coco" + two icons (new chat, Coco's settings)
//   2. what you're talking about: General or one of your trees (one tap switches; each keeps its own chat)
//   3. the chat (before the first message: Coco says hi in the middle, a few ready questions sit above the bar)
//   4. one message bar: type, or tap the mic and talk
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { autoDir } from '@/design/rtl';
import { color, radius } from '@/design/tokens';
import { COCO } from '@/art';
import { Coco, Enter } from '@/components/ui';
import { useVoice, VoiceWave, withLive } from '@/components/Voice';
import { chatCoco } from '@/lib/ai';
import { play, tap } from '@/lib/feedback';
import { activeSubject, useApp } from '@/store';
import { C, F } from '@/theme';

// failed: Coco couldn't be reached; tapping the line sends the message before it again
type Msg = { role: 'user' | 'assistant'; text: string; voice?: boolean; failed?: boolean; why?: string };
const STYLE_LABEL = { friendly: 'Friendly coach', calm: 'Calm tutor', direct: 'Direct & focused', playful: 'Playful buddy' };
const GENERAL = 'general';
const NONE: Msg[] = [];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function CocoTab() {
  const coco = useApp((s) => s.coco);
  const name = useApp((s) => s.profile.name);
  const interests = useApp((s) => (s.coco.memory ? s.profile.interests : []));
  const subjects = useApp((s) => s.subjects);
  const current = useApp(activeSubject);
  // what the chat is about: a tree (its id) or General. Starts on the tree you were last on.
  const [picked, setPicked] = useState<string>(current?.id ?? GENERAL);
  const subject = subjects.find((x) => x.id === picked);
  const topic = subject ? subject.id : GENERAL; // a tree that was cut down falls back to General
  // one conversation per topic, so switching never loses what you said
  const [threads, setThreads] = useState<Record<string, Msg[]>>({});
  const [busy, setBusy] = useState<string | null>(null); // the topic Coco is answering right now
  const [text, setText] = useState('');
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);

  const msgs = threads[topic] ?? NONE;
  const first = name.trim().split(' ')[0];

  const send = useCallback(
    async (raw: string, voice?: boolean, before?: Msg[]) => {
      const said = raw.trim();
      if (!said || busy) return;
      tap('select');
      const key = topic;
      // what Coco sees: the conversation without the "couldn't reach Coco" lines
      const next: Msg[] = [...(before ?? msgs).filter((m) => !m.failed), { role: 'user', text: said, ...(voice ? { voice: true } : {}) }];
      const put = (f: (m: Msg[]) => Msg[]) => setThreads((t) => ({ ...t, [key]: f(t[key] ?? []) }));
      put(() => next);
      setText('');
      setBusy(key);
      try {
        const reply = await chatCoco(
          {
            subject: subject?.name ?? 'General (any subject the student asks about)',
            chapter: subject ? subject.chapters.map((c) => c.title).filter(Boolean).join(', ') : '',
            interests,
            style: STYLE_LABEL[coco.style],
            depth: coco.depth,
          },
          next.map(({ role, text: t }) => ({ role, text: t })),
        );
        put((m) => [...m, { role: 'assistant', text: reply.trim() }]);
        play('select');
      } catch (e) {
        // while developing, show the real reason (bad key, model name, region, rate limit…)
        const why = __DEV__ ? String((e as Error)?.message ?? e).slice(0, 220) : undefined;
        put((m) => [...m, { role: 'assistant', text: '', failed: true, why }]);
      }
      setBusy(null);
    },
    [busy, topic, msgs, subject, interests, coco.style, coco.depth],
  );

  // a voice message is sent as soon as it's written down (same as Ask Coco); without voice the keyboard's mic is used
  const voice = useVoice(
    useCallback((t: string) => send(t, true), [send]),
    () => input.current?.focus(),
  );

  useEffect(() => {
    if (msgs.length) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
  }, [msgs.length, busy, topic]);

  const retry = (k: number) => {
    const sent = msgs[k - 1];
    if (sent?.role === 'user') send(sent.text, sent.voice, msgs.slice(0, k - 1));
  };

  const newChat = () => {
    if (voice.state === 'recording') voice.toggle();
    setThreads((t) => ({ ...t, [topic]: [] }));
    setText('');
  };

  const pick = (id: string) => {
    if (id === topic) return;
    tap('select');
    if (voice.state === 'recording') voice.toggle();
    setPicked(id);
  };

  const chapter = subject?.chapters[0]?.title;
  const starters: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = subject
    ? [
        { icon: 'bulb-outline', text: chapter ? `Explain ${chapter} simply` : `Explain the basics of ${subject.name}` },
        { icon: 'help-circle-outline', text: `Quiz me on ${subject.name}` },
        { icon: 'list-outline', text: `What should I review in ${subject.name}?` },
      ]
    : [
        { icon: 'calendar-outline', text: 'Help me plan today’s study' },
        { icon: 'sparkles-outline', text: 'How do I remember things for longer?' },
        { icon: 'bulb-outline', text: 'Explain something I don’t get' },
      ];

  const recording = voice.state === 'recording';
  const busyVoice = voice.state !== 'idle';
  const typed = !!text.trim();
  const waiting = busy === topic;
  const empty = msgs.length === 0 && !waiting;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.paper }}>
      {/* 1. title row — same large title as Profile, actions on the right */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingTop: 8, height: 56 }}>
        <Text accessibilityRole="header" style={{ flex: 1, fontFamily: F.semi, fontSize: 28, lineHeight: 34, color: C.ink, letterSpacing: -0.5 }}>
          Coco
        </Text>
        {!empty && <HeaderIcon name="create-outline" label="New chat" onPress={newChat} />}
        <HeaderIcon name="options-outline" label="Coco settings" onPress={() => router.push('/customize')} />
      </View>

      {/* 2. what we're talking about */}
      <View style={{ paddingTop: 6, paddingBottom: 12, borderBottomWidth: 1, borderColor: C.line }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }} accessibilityRole="tablist">
          <Topic label="General" icon="chatbubbles-outline" on={topic === GENERAL} onPress={() => pick(GENERAL)} />
          {subjects.map((s) => (
            <Topic key={s.id} label={s.name} icon="leaf-outline" on={topic === s.id} onPress={() => pick(s.id)} />
          ))}
        </ScrollView>
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {/* 3. the chat */}
        <ScrollView
          ref={scroll}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, gap: 18 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          {empty ? (
            <View style={{ flex: 1, justifyContent: 'space-between', gap: 24 }}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Coco src={COCO[coco.outfit] ?? COCO.classic} size={96} />
                <Text style={{ fontFamily: F.semi, fontSize: 20, lineHeight: 26, color: C.ink, textAlign: 'center' }}>
                  {first ? `Hi ${first}, what’s on your mind?` : 'Hi, what’s on your mind?'}
                </Text>
                <Text style={{ fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.muted, textAlign: 'center', maxWidth: 300 }}>
                  {subject ? `Ask me anything about ${subject.name}.` : 'Ask about any subject, or how to study.'}
                </Text>
              </View>
              {/* ready questions sit right above the bar, where your thumb already is */}
              <View style={{ gap: 8 }}>
                {starters.map((s, i) => (
                  <Enter key={`${topic}-${i}`} delay={60 * i}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => send(s.text)}
                      style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: pressed ? C.sand : C.white })}>
                      <Ionicons name={s.icon} size={18} color={C.teal} />
                      <Text numberOfLines={2} style={{ flex: 1, fontFamily: F.regular, fontSize: 15, color: C.ink }}>
                        {s.text}
                      </Text>
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
                    {m.voice && <Ionicons name="mic" size={13} color={color.overlay.onDark} style={{ marginTop: 4 }} />}
                    <Text style={[{ flexShrink: 1, fontFamily: F.regular, fontSize: 16, lineHeight: 23, color: C.white }, autoDir(m.text)]}>{m.text}</Text>
                  </View>
                </Enter>
              ) : m.failed ? (
                <Pressable key={k} accessibilityRole="button" onPress={() => retry(k)} hitSlop={6} style={{ alignSelf: 'flex-start', gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="refresh" size={15} color={C.orange} />
                    <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.orange }}>Couldn’t reach Coco. Tap to try again.</Text>
                  </View>
                  {m.why && <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.mutedLight }}>{m.why}</Text>}
                </Pressable>
              ) : (
                // Coco's replies read like text on the page, not boxes (same as Ask Coco in a session)
                <Enter key={k} style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
                  <Text selectable style={[{ fontFamily: F.regular, fontSize: 16, lineHeight: 26, color: C.ink }, autoDir(m.text)]}>
                    {m.text}
                  </Text>
                </Enter>
              ),
            )
          )}
          {waiting && <Typing />}
        </ScrollView>

        {/* 4. message bar: while recording it turns into a recording bar */}
        <View style={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, backgroundColor: C.white, borderWidth: 1.5, borderColor: recording ? C.red : C.lineStrong, borderRadius: 26, paddingLeft: 16, paddingRight: 5, paddingVertical: 5, minHeight: 52 }}>
            {busyVoice ? (
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 42 }}>
                {recording ? (
                  <>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.red }} />
                    <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.ink, fontVariant: ['tabular-nums'] }}>{clock(voice.seconds)}</Text>
                    <VoiceWave level={voice.level} active height={26} style={{ flex: 1 }} />
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
                placeholder={subject ? `Ask about ${subject.name}` : 'Message Coco'}
                placeholderTextColor={C.mutedLight}
                style={[{ flex: 1, maxHeight: 120, paddingTop: 11, paddingBottom: 11, fontFamily: F.regular, fontSize: 16, color: C.ink }, autoDir(text)]}
              />
            )}
            {typed && !busyVoice ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send"
                onPress={() => send(text)}
                disabled={!!busy}
                style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: busy ? C.lineStrong : C.green, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="arrow-up" size={22} color={C.white} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={recording ? 'Send voice message' : 'Talk to Coco'}
                onPress={voice.toggle}
                disabled={voice.state === 'writing' || !!busy}
                style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: recording ? C.red : C.sand, alignItems: 'center', justifyContent: 'center', opacity: voice.state === 'writing' || busy ? 0.4 : 1 }}>
                <Ionicons name={recording ? 'arrow-up' : 'mic'} size={22} color={recording ? C.white : C.teal} />
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------- pieces ---------- */

function HeaderIcon({ name, label, onPress }: { name: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => (tap(), onPress())}
      hitSlop={4}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.sand : 'transparent' })}>
      <Ionicons name={name} size={24} color={C.teal} />
    </Pressable>
  );
}

/** One topic chip: General or a tree. The chosen one is filled. */
function Topic({ label, icon, on, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 36,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: on ? color.selected.border : C.lineStrong,
        backgroundColor: on ? color.selected.bg : pressed ? C.sand : C.white,
      })}>
      <Ionicons name={icon} size={15} color={on ? color.selected.text : C.muted} />
      <Text numberOfLines={1} style={{ maxWidth: 160, fontFamily: F.medium, fontSize: 14, color: on ? color.selected.text : C.ink }}>
        {label}
      </Text>
    </Pressable>
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
