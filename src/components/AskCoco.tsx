// "Ask Coco" — its own page (a sheet over the question) for talking a question through after it's marked: type, or
// hold a voice chat (tap the mic, talk, tap again: it's sent as soon as Coco has written it down). The chat is kept on
// the question, so going back to it later shows the conversation again. "Next question" is not on this page on purpose:
// asking and moving on are never next to each other.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Coco } from '@/components/ui';
import { MicButton, useVoice, withLive } from '@/components/Voice';
import { discussAnswer, type ActiveQuestion } from '@/lib/ai';
import { tap } from '@/lib/feedback';
import { saveResult, sessionContext } from '@/lib/session';
import { useApp, type ChatMsg } from '@/store';
import { C, F } from '@/theme';

// ready-made first questions (the student can also just talk)
const STARTERS = ['Why is that the answer?', 'Explain it more simply', 'Give me an example'];
const WRONG_STARTER = 'Where did I go wrong?';

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
        reply = 'I lost the connection for a second — try again?';
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
  const tone = result.grade.correct ? { c: C.leaf, t: 'You got it' } : result.grade.close ? { c: '#E08A00', t: 'Almost' } : { c: '#D9573B', t: 'Not yet' };
  const recording = voice.state === 'recording';
  const starters = result.grade.correct ? STARTERS : [WRONG_STARTER, ...STARTERS.slice(0, 2)];
  const typed = !!text.trim();

  return (
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: insets.top }}>
        {/* header: one way out, back to the question */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line }}>
          <Pressable onPress={() => (tap(), close())} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="chevron-back" size={22} color={C.teal} />
            <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.teal }}>Question {index + 1}</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center', marginRight: 90 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.ink }}>Ask Coco</Text>
          </View>
        </View>

        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
            {/* what we're talking about */}
            <View style={{ backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.lineStrong, padding: 12, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: F.bold, fontSize: 10, letterSpacing: 0.5, color: C.muted }}>THE QUESTION</Text>
                <Text style={{ fontFamily: F.bold, fontSize: 11, color: tone.c }}>● {tone.t}</Text>
              </View>
              <Text style={{ fontFamily: F.bold, fontSize: 14, lineHeight: 20, color: C.teal }}>{q.q}</Text>
            </View>

            {thread.length === 0 && (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 10 }}>
                <Coco src={COCO.stand} size={96} />
                <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink, textAlign: 'center' }}>What’s still not clear?</Text>
                <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.body, textAlign: 'center', paddingHorizontal: 12 }}>
                  Type it, or tap the mic and just say it, in any language.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 4 }}>
                  {starters.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => (tap('select'), send(s))}
                      disabled={waiting}
                      style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.mintBorder, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.mossDark }}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {thread.map((m, k) =>
              m.role === 'user' ? (
                <View key={k} style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: C.teal, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
                  {m.voice && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <Ionicons name="mic" size={11} color="rgba(255,255,255,0.75)" />
                      <Text style={{ fontFamily: F.bold, fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>Voice</Text>
                    </View>
                  )}
                  <Text style={{ fontFamily: F.medium, fontSize: 15, lineHeight: 21, color: C.white }}>{m.text}</Text>
                </View>
              ) : (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, maxWidth: '90%' }}>
                  <Coco src={COCO.stand} size={28} bob={false} />
                  <View style={{ flexShrink: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
                    <Text style={{ fontFamily: F.medium, fontSize: 15, lineHeight: 21, color: C.ink }}>{m.text}</Text>
                  </View>
                </View>
              ),
            )}
            {waiting && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Coco src={COCO.stand} size={28} bob={false} />
                <ActivityIndicator size="small" color={C.teal} />
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Coco is thinking…</Text>
              </View>
            )}
          </ScrollView>

          {/* the composer: type and send, or talk */}
          <View style={{ borderTopWidth: 1, borderColor: C.line, backgroundColor: C.paper, paddingHorizontal: 12, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), gap: 6 }}>
            {voice.state !== 'idle' && (
              <Text style={{ fontFamily: F.bold, fontSize: 12, color: recording ? C.red : C.leaf, textAlign: 'center' }}>
                {recording ? `● Listening… ${voice.seconds}s · tap ■ to send` : 'Coco is writing down what you said…'}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <TextInput
                ref={input}
                value={withLive(text, voice.live)}
                onChangeText={(t) => !recording && setText(t)}
                editable={!recording}
                multiline
                placeholder="Ask Coco about this question…"
                placeholderTextColor="#A69A8A"
                style={{ flex: 1, minHeight: 46, maxHeight: 120, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 23, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: F.medium, fontSize: 15, color: C.ink }}
              />
              {typed && !recording ? (
                <Pressable
                  accessibilityLabel="Send"
                  onPress={() => (tap('select'), send(text))}
                  disabled={waiting}
                  style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: waiting ? C.lineStrong : C.teal, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-up" size={22} color={C.white} />
                </Pressable>
              ) : (
                <MicButton voice={voice} size={46} />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
