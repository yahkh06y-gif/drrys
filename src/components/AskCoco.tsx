// "Ask Coco" — one chat sheet used everywhere the student asks Coco about something (a marked question in active
// learning, a flashcard). It opens at half the screen over what's being asked about, can be pulled up for more room,
// and closes by pulling it down, tapping outside, or the ✕. Type, or tap the mic and talk: the voice message is sent
// as soon as Coco has written it down. "Next question" is never on the sheet: asking and moving on stay apart.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color } from '@/design/tokens';
import { COCO } from '@/art';
import { Coco } from '@/components/ui';
import { useVoice, withLive } from '@/components/Voice';
import { discussAnswer, type ActiveQuestion } from '@/lib/ai';
import { tap } from '@/lib/feedback';
import { saveResult, sessionContext } from '@/lib/session';
import { useApp, type ChatMsg } from '@/store';
import { C, F } from '@/theme';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const EASE = { duration: 260, easing: Easing.out(Easing.cubic) };

/** The chat sheet itself. `about`: one line under the title saying what is being asked about. `voice`: start
 *  listening as soon as it opens (opened from a mic button). */
export function CocoChatSheet({
  open,
  about,
  thread,
  waiting,
  starters,
  voice: startVoice,
  onSend,
  onClose,
}: {
  open: boolean;
  about: string;
  thread: ChatMsg[];
  waiting: boolean;
  starters: string[];
  voice?: boolean;
  onSend: (text: string, voice?: boolean) => void;
  onClose: () => void;
}) {
  const { height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const HALF = Math.round(H * 0.55);
  const FULL = Math.round(H - insets.top - 12);
  const [text, setText] = useState('');
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);

  // the sheet's height (half ↔ full) and how far it is pulled down (0 = open; H = gone)
  const height = useSharedValue(HALF);
  const down = useSharedValue(H);
  const start = useSharedValue(HALF);
  useEffect(() => {
    if (!open) return;
    height.value = HALF;
    down.value = H;
    down.value = withTiming(0, EASE);
  }, [open, H, HALF, height, down]);

  const send = useCallback(
    (t: string, v?: boolean) => {
      if (!t.trim()) return;
      onSend(t.trim(), v);
      setText('');
    },
    [onSend],
  );
  const voice = useVoice(
    useCallback((t: string) => send(t, true), [send]),
    () => input.current?.focus(), // no Gemini key: the keyboard's own mic
  );
  const stopVoice = useRef(voice);
  useEffect(() => {
    stopVoice.current = voice;
  });

  const closeNow = useCallback(() => {
    if (stopVoice.current.state === 'recording') stopVoice.current.toggle();
    onClose();
  }, [onClose]);
  const dismiss = useCallback(() => {
    down.value = withTiming(H, { duration: 220 }, (done) => {
      if (done) runOnJS(closeNow)();
    });
  }, [down, H, closeNow]);

  // pull the top bar: up for more room, down to close
  const pan = Gesture.Pan()
    .onBegin(() => {
      start.value = height.value;
    })
    .onUpdate((e) => {
      const h = start.value - e.translationY;
      if (h >= HALF) {
        height.value = Math.min(FULL, h);
        down.value = 0;
      } else {
        height.value = HALF;
        down.value = HALF - h;
      }
    })
    .onEnd((e) => {
      const fromHalf = start.value <= HALF + 10;
      if (down.value > 110 || (e.velocityY > 900 && fromHalf)) {
        down.value = withTiming(H, { duration: 220 }, (done) => {
          if (done) runOnJS(closeNow)();
        });
        return;
      }
      down.value = withTiming(0, EASE);
      const up = e.velocityY < -600 || (e.velocityY < 600 && height.value > (HALF + FULL) / 2);
      height.value = withTiming(up ? FULL : HALF, EASE);
    });

  const sheet = useAnimatedStyle(() => ({ height: height.value, transform: [{ translateY: down.value }] }));
  const shade = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, down.value / HALF) }));

  // opened from a mic: listen straight away
  const started = useRef(false);
  useEffect(() => {
    if (!open) started.current = false;
    else if (startVoice && !started.current && voice.state === 'idle') {
      started.current = true;
      voice.toggle();
    }
  }, [open, startVoice, voice]);

  useEffect(() => {
    if (open) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
  }, [open, thread.length, waiting]);

  const recording = voice.state === 'recording';
  const busyVoice = voice.state !== 'idle';
  const typed = !!text.trim();

  return (
    <Modal visible={open} transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: color.overlay.scrim }, shade]}>
          <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={dismiss} />
        </Animated.View>
        <KeyboardAvoidingView behavior="padding" pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 12 }}>
          <Animated.View style={[{ maxHeight: '100%', backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, sheet]}>
            {/* the top bar: the handle to pull, the title, what it's about, and ✕ */}
            <GestureDetector gesture={pan}>
              <View style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderColor: C.line }}>
                <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 4, backgroundColor: C.lineStrong, marginBottom: 10 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.semi, fontSize: 17, color: C.ink }}>Ask Coco</Text>
                    <Text numberOfLines={1} style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, marginTop: 1 }}>
                      {about}
                    </Text>
                  </View>
                  <Pressable accessibilityLabel="Close" onPress={() => (tap(), dismiss())} hitSlop={10} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="close" size={18} color={C.body} />
                  </Pressable>
                </View>
              </View>
            </GestureDetector>

            <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
              {thread.length === 0 && !waiting ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <Coco src={COCO.stand} size={64} bob={false} />
                  <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.body, textAlign: 'center' }}>What’s still not clear?</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                    {starters.map((s) => (
                      <Pressable key={s} onPress={() => (tap('select'), send(s))} style={{ borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.white, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 }}>
                        <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.teal }}>{s}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                thread.map((m, k) =>
                  m.role === 'user' ? (
                    <View key={k} style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: C.teal, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', gap: 6 }}>
                      {m.voice && <Ionicons name="mic" size={13} color={color.overlay.onDark} style={{ marginTop: 4 }} />}
                      <Text style={{ flexShrink: 1, fontFamily: F.medium, fontSize: 15, lineHeight: 21, color: C.white }}>{m.text}</Text>
                    </View>
                  ) : (
                    // Coco's replies read like text on the page, not boxes
                    <Text key={k} style={{ alignSelf: 'flex-start', maxWidth: '92%', fontFamily: F.medium, fontSize: 15, lineHeight: 23, color: C.ink }}>
                      {m.text}
                    </Text>
                  ),
                )
              )}
              {waiting && <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>Coco is typing…</Text>}
            </ScrollView>

            {/* the message bar: while recording it turns into a timer */}
            <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10) }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, backgroundColor: C.white, borderWidth: 1, borderColor: recording ? C.red : C.lineStrong, borderRadius: 24, paddingLeft: 16, paddingRight: 5, paddingVertical: 5, minHeight: 48 }}>
                {busyVoice ? (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 38 }}>
                    {recording ? (
                      <>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.red }} />
                        <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.ink, fontVariant: ['tabular-nums'] }}>{clock(voice.seconds)}</Text>
                        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: C.track, overflow: 'hidden' }}>
                          <View style={{ width: `${Math.round(15 + voice.level * 85)}%`, height: 4, backgroundColor: C.red }} />
                        </View>
                      </>
                    ) : (
                      <>
                        <ActivityIndicator size="small" color={C.teal} />
                        <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>Writing it down…</Text>
                      </>
                    )}
                  </View>
                ) : (
                  <TextInput
                    ref={input}
                    value={withLive(text, voice.live)}
                    onChangeText={setText}
                    onFocus={() => (height.value = withTiming(FULL, EASE))}
                    multiline
                    placeholder="Message Coco"
                    placeholderTextColor={C.mutedLight}
                    style={{ flex: 1, maxHeight: 120, paddingTop: 9, paddingBottom: 9, fontFamily: F.medium, fontSize: 15, color: C.ink }}
                  />
                )}
                {typed && !busyVoice ? (
                  <Pressable accessibilityLabel="Send" onPress={() => (tap('select'), send(text))} disabled={waiting} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: waiting ? C.lineStrong : C.teal, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="arrow-up" size={20} color={C.white} />
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityLabel={recording ? 'Send voice message' : 'Talk to Coco'}
                    onPress={voice.toggle}
                    disabled={voice.state === 'writing' || waiting}
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: recording ? C.red : C.sand, alignItems: 'center', justifyContent: 'center', opacity: voice.state === 'writing' || waiting ? 0.4 : 1 }}>
                    <Ionicons name={recording ? 'arrow-up' : 'mic'} size={20} color={recording ? C.white : C.teal} />
                  </Pressable>
                )}
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Ask Coco about a marked question in active learning. The chat is kept on the question, so going back to it
 *  later shows the conversation again (and a reply that lands after moving on is still saved on it). */
export function AskCoco({ index, q, open, withVoice, onClose }: { index: number; q: ActiveQuestion; open: boolean; withVoice?: boolean; onClose: () => void }) {
  const result = useApp((s) => s.session?.results?.[index] ?? undefined);
  const [waiting, setWaiting] = useState(false);

  const send = useCallback(
    async (said: string, voice?: boolean) => {
      const r = useApp.getState().session?.results?.[index];
      if (!r) return;
      const t: ChatMsg[] = [...(r.thread ?? []), { role: 'user', text: said, ...(voice ? { voice: true } : {}) }];
      saveResult(index, (old) => ({ ...old, thread: t }));
      setWaiting(true);
      let reply: string;
      try {
        reply = (await discussAnswer(await sessionContext(false), q, r.answer, r.grade.feedback, t)).trim();
      } catch {
        reply = 'I lost the connection for a second. Try again?';
      }
      saveResult(index, (old) => ({ ...old, thread: [...(old.thread ?? []), { role: 'assistant', text: reply }] }));
      setWaiting(false);
    },
    [index, q],
  );

  if (!result) return null;
  return (
    <CocoChatSheet
      open={open}
      about={`Q${index + 1} · ${q.q}`}
      thread={result.thread ?? []}
      waiting={waiting}
      starters={result.grade.correct ? ['Why is that the answer?', 'Give me an example'] : ['Where did I go wrong?', 'Explain it more simply']}
      voice={withVoice}
      onSend={send}
      onClose={onClose}
    />
  );
}
