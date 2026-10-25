// "Ask Coco" — its own page for talking a question through after it's marked: type, or tap the mic and talk (the voice
// message is sent as soon as Coco has written it down). The chat is kept on the question, so going back to it later
// shows the conversation again. "Next question" is not on this page on purpose: asking and moving on are never side by side.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Coco } from '@/components/ui';
import { useVoice, withLive } from '@/components/Voice';
import { discussAnswer, type ActiveQuestion } from '@/lib/ai';
import { tap } from '@/lib/feedback';
import { saveResult, sessionContext } from '@/lib/session';
import { useApp, type ChatMsg } from '@/store';
import { C, F } from '@/theme';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function AskCoco({ index, q, open, withVoice, onClose }: { index: number; q: ActiveQuestion; open: boolean; withVoice?: boolean; onClose: () => void }) {
  const result = useApp((s) => s.session?.results?.[index] ?? undefined);
  const thread = result?.thread ?? [];
  const [text, setText] = useState('');
  const [waiting, setWaiting] = useState(false);
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const send = useCallback(
    async (raw: string, voice?: boolean) => {
      const said = raw.trim();
      const r = useApp.getState().session?.results?.[index];
      if (!said || !r) return;
      const t: ChatMsg[] = [...(r.thread ?? []), { role: 'user', text: said, ...(voice ? { voice: true } : {}) }];
      saveResult(index, (old) => ({ ...old, thread: t }));
      setText('');
      setWaiting(true);
      let reply: string;
      try {
        reply = (await discussAnswer(await sessionContext(false), q, r.answer, r.grade.feedback, t)).trim();
      } catch {
        reply = 'I lost the connection for a second. Try again?';
      }
      // saved on this question even if the student has closed the page or moved on meanwhile
      saveResult(index, (old) => ({ ...old, thread: [...(old.thread ?? []), { role: 'assistant', text: reply }] }));
      setWaiting(false);
    },
    [index, q],
  );

  // a voice message is sent as soon as it's written down; without a Gemini key the keyboard's own mic is used
  const voice = useVoice(
    useCallback((t: string) => send(t, true), [send]),
    () => input.current?.focus(),
  );

  // opened from the mic on the question: start listening straight away
  const started = useRef(false);
  useEffect(() => {
    if (!open) started.current = false;
    else if (withVoice && !started.current && voice.state === 'idle') {
      started.current = true;
      voice.toggle();
    }
  }, [open, withVoice, voice]);

  useEffect(() => {
    if (open) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
  }, [open, thread.length, waiting]);

  if (!result) return null;
  const close = () => {
    if (voice.state === 'recording') voice.toggle();
    onClose();
  };
  const recording = voice.state === 'recording';
  const busyVoice = voice.state !== 'idle';
  const typed = !!text.trim();
  const starters = result.grade.correct ? ['Why is that the answer?', 'Give me an example'] : ['Where did I go wrong?', 'Explain it more simply'];

  return (
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: insets.top }}>
        {/* header: what we're talking about, and one way out */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: C.line }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 17, color: C.ink }}>Ask Coco</Text>
            <Text numberOfLines={1} style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, marginTop: 1 }}>
              Q{index + 1} · {q.q}
            </Text>
          </View>
          <Pressable accessibilityLabel="Back to the question" onPress={() => (tap(), close())} hitSlop={10} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color={C.body} />
          </Pressable>
        </View>

        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView ref={scroll} contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
            {thread.length === 0 && !waiting ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <Coco src={COCO.stand} size={84} />
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
                    {m.voice && <Ionicons name="mic" size={13} color="rgba(255,255,255,0.7)" style={{ marginTop: 4 }} />}
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

          {/* composer: while recording it turns into a recording bar */}
          <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10) }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, backgroundColor: C.white, borderWidth: 1, borderColor: recording ? C.red : C.lineStrong, borderRadius: 24, paddingLeft: 16, paddingRight: 5, paddingVertical: 5, minHeight: 48 }}>
              {busyVoice ? (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 38 }}>
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
                      <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>Writing it down…</Text>
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
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
