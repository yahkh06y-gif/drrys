// Session step 4 — Active learning: "One idea at a time". Student explains, Coco grades (elaboration + self-explanation).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Btn, Coco, Enter, Pill, SessionHeader, T } from '@/components/ui';
import { MicButton, useVoice } from '@/components/Voice';
import { discussAnswer, gradeAnswer, type Grade, type QFormat, type QKind } from '@/lib/ai';
import { HookSheet, type HookTarget } from '@/components/HookSheet';
import { SketchPad, type SketchHandle } from '@/components/SketchPad';
import { MatchQ } from '@/components/questions/Match';
import { OrderQ } from '@/components/questions/Order';
import { SortQ } from '@/components/questions/Sort';
import { gradeMatch, gradeOrder, gradeSort } from '@/lib/grade';
import { haptic, play, tap } from '@/lib/feedback';
import { sessionContext } from '@/lib/session';
import { useApp } from '@/store';
import { C, F } from '@/theme';

// How each kind of idea is practised (PACER): the question type decides what the student is asked to do.
const KIND: Record<QKind, { pill: string; line: string; placeholder: string }> = {
  conceptual: { pill: 'CONNECT IT', line: 'Think about how the ideas relate, then explain it your way.', placeholder: 'It connects because…' },
  procedural: { pill: 'WORK IT OUT', line: 'Write the steps in order, or work a tiny example.', placeholder: 'Step 1…, then…' },
  analogous: { pill: 'TEST THE COMPARISON', line: 'Say where the comparison fits and where it stops working.', placeholder: 'It fits because… but it breaks when…' },
  evidence: { pill: 'USE IT', line: 'Use the idea on a new, short situation.', placeholder: 'In this case…' },
};

// What the student is asked to do, for the question formats that aren't "explain".
const FORMAT_LINE: Partial<Record<QFormat, { pill: string; line: string }>> = {
  order: { pill: 'PUT IN ORDER', line: 'Hold the handle and drag the steps into the right order.' },
  sort: { pill: 'SORT IT', line: 'Drag each item into the group it belongs to.' },
  match: { pill: 'CONNECT THE PAIRS', line: 'Drag from a card on the left to its partner on the right.' },
  work: { pill: 'WORK IT OUT', line: 'Solve it below. Type your working.' },
};

export default function Active() {
  const qs = useApp((s) => s.session?.questions ?? []);
  const patchSession = useApp((s) => s.patchSession);
  // a memory hook for this question: it lives on a flashcard made from it (made when the hook is saved)
  const [hook, setHook] = useState<HookTarget>();
  const cards = useApp((s) => s.cards);
  const sess = useApp((s) => s.session);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState(false);
  const [grade, setGrade] = useState<Grade>();
  const [busy, setBusy] = useState(false);
  // after the grade the student can talk it through with Coco (push back, ask why, try again)
  const [thread, setThread] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [reply, setReply] = useState('');
  const [talking, setTalking] = useState(false);
  // answers for the formats the app marks itself
  const [order, setOrder] = useState<string[]>([]);
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false); // the sort / match is filled in
  const [marks, setMarks] = useState<{ order?: boolean[]; map?: Record<string, boolean> }>({});
  const [sketching, setSketching] = useState(false); // the sketch pad is open (work questions)
  const [ink, setInk] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const pad = useRef<SketchHandle>(null);
  const answerInput = useRef<TextInput>(null);
  const voice = useVoice(
    useCallback((t: string) => setAnswer((a) => (a.trim() ? `${a.trim()} ${t}` : t)), []),
    () => answerInput.current?.focus(),
  );
  const q = qs[i];
  // no questions this time: go straight on to the flashcards instead of a blank screen
  useEffect(() => {
    if (!q) router.replace('/session/cards');
  }, [q]);
  // a reply that lands after moving to the next question must not end up in its chat
  const qRef = useRef(i);
  qRef.current = i;
  if (!q) return null;

  const fmt: QFormat = q.format ?? 'explain';
  // right = green, almost (on the right track) = orange, not yet = red
  const tone = !grade
    ? { bg: '', border: '', icon: 'checkmark-circle' as const, color: '', text: '', title: '' }
    : grade.correct
      ? { bg: '#F0F8E6', border: C.mintBorder, icon: 'checkmark-circle' as const, color: C.leaf, text: C.moss, title: 'Nailed it!' }
      : grade.close
        ? { bg: '#FFF3DC', border: '#F0A63A', icon: 'alert-circle' as const, color: '#E08A00', text: '#B86A00', title: 'Almost there' }
        : { bg: '#FDECEA', border: '#E8998B', icon: 'close-circle' as const, color: '#D9573B', text: '#C2452B', title: 'Not yet' };
  const marked = fmt === 'order' || fmt === 'sort' || fmt === 'match'; // the app marks these itself

  const existing = cards.find((c) => c.subjectId === sess?.subjectId && c.chapterId === sess?.chapterId && c.q === q?.q);
  const openHook = () => {
    if (!sess || !q) return;
    tap('select');
    setHook(existing ?? { subjectId: sess.subjectId, chapterId: sess.chapterId, q: q.q, a: q.ideal });
  };

  // keep the grade, count it, and turn a gap into a flashcard (added to the deck at the end of the session)
  const record = (g: Grade, summary: string) => {
    setGrade(g);
    const st = useApp.getState().session!;
    const gap = g.card?.q && g.card?.a ? g.card : !g.correct ? { q: q.q, a: q.ideal } : undefined;
    patchSession({
      answers: [...st.answers, summary],
      correct: st.correct + (g.correct ? 1 : g.close ? 0.5 : 0), // "almost" counts as half
      ...(gap ? { gapCards: [...(st.gapCards ?? []), { q: gap.q, a: gap.a }] } : {}),
    });
    if (g.correct) {
      play('success');
      haptic('success');
    } else if (g.close) {
      play('select'); // on the right track: no wrong-answer sound
      haptic('light');
    } else {
      play('wrong');
      haptic('error');
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (fmt === 'order') {
        const r = gradeOrder(q, order);
        setMarks({ order: r.marks });
        record(r, order.join(' → '));
      } else if (fmt === 'sort') {
        const r = gradeSort(q, assigned);
        setMarks({ map: r.marks });
        record(r, JSON.stringify(assigned));
      } else if (fmt === 'match') {
        const r = gradeMatch(q, matched);
        setMarks({ map: r.marks });
        record(r, JSON.stringify(matched));
      } else {
        const img = fmt === 'work' && ink ? await pad.current?.capture() : undefined;
        record(await gradeAnswer(await sessionContext(false), q, answer, img), answer || (img ? '(sketch)' : ''));
      }
    } catch {
      setGrade({ correct: false, feedback: 'Coco lost connection — compare with the model answer below.' });
    }
    setBusy(false);
  };

  const talk = async () => {
    const text = reply.trim();
    if (!text || !grade || talking) return;
    const t = [...thread, { role: 'user' as const, text }];
    setThread(t);
    setReply('');
    setTalking(true);
    const at = i;
    try {
      const r = await discussAnswer(await sessionContext(false), q, answer, grade.feedback, t);
      if (qRef.current === at) setThread([...t, { role: 'assistant', text: r.trim() }]);
    } catch {
      if (qRef.current === at) setThread([...t, { role: 'assistant', text: 'I lost the connection for a second — try again?' }]);
    }
    setTalking(false);
  };

  const next = () => {
    if (i + 1 >= qs.length) router.replace('/session/cards');
    else {
      play('flip');
      setI(i + 1);
      setAnswer('');
      setHint(false);
      setGrade(undefined);
      setThread([]);
      setReply('');
      setOrder([]);
      setAssigned({});
      setMatched({});
      setReady(false);
      setMarks({});
      setSketching(false);
      setInk(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <SessionHeader step={5} title="Active learning" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView key={i} scrollEnabled={!drawing} contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Enter>
            <Pill text={(FORMAT_LINE[fmt] ?? KIND[q.kind ?? 'conceptual']).pill} />
            <T v="h2" style={{ marginTop: 6 }}>
              {fmt === 'explain' && i === qs.length - 1 ? 'Explain it your way' : 'One idea at a time'}
            </T>
            <T>{(FORMAT_LINE[fmt] ?? KIND[q.kind ?? 'conceptual']).line} Then talk it through with Coco.</T>
            <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.leaf, marginTop: 4 }}>
              Question {i + 1} of {qs.length}
            </Text>
          </Enter>

          <Enter delay={120}>
            <View style={{ backgroundColor: C.white, borderRadius: 22, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 4, padding: 18 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 18, lineHeight: 26, color: C.teal, textAlign: 'center' }}>{q.q}</Text>
            </View>
          </Enter>

          {!grade && fmt === 'explain' && <Coco src={i === qs.length - 1 ? COCO.pointer : COCO.stand} size={130} />}

          {hint && !grade && (
            <Enter>
              <View style={{ backgroundColor: '#FFF6E3', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.amber }}>
                <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.goldInk }}>{q.hint}</Text>
              </View>
            </Enter>
          )}

          {fmt === 'order' && !!q.steps && <OrderQ steps={q.steps} locked={!!grade} marks={marks.order} onChange={setOrder} />}
          {fmt === 'sort' && !!q.buckets && (
            <SortQ
              buckets={q.buckets}
              locked={!!grade}
              marks={marks.map}
              onChange={(a, done) => (setAssigned(a), setReady(done))}
            />
          )}
          {fmt === 'match' && !!q.pairs && (
            <MatchQ
              pairs={q.pairs}
              locked={!!grade}
              marks={marks.map}
              onChange={(m, done) => (setMatched(m), setReady(done))}
            />
          )}

          {!grade && !marked ? (
            <View style={{ backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.lineStrong, padding: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: F.bold, fontSize: 10, letterSpacing: 0.5, color: C.goldInk }}>{fmt === 'work' ? 'YOUR WORKING' : 'YOU’RE EXPLAINING'}</Text>
                <Text style={{ fontFamily: F.bold, fontSize: 10, color: voice.state === 'recording' ? C.red : C.leaf }}>
                  {voice.state === 'recording' ? `● ${voice.seconds}s · tap ■ to stop` : voice.state === 'writing' ? 'Writing it down…' : '🎤 or just say it'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
                <TextInput
                  ref={answerInput}
                  value={answer}
                  onChangeText={setAnswer}
                  multiline
                  placeholder={fmt === 'work' ? 'Write your working, line by line…' : KIND[q.kind ?? 'conceptual'].placeholder}
                  placeholderTextColor="#A69A8A"
                  style={{ flex: 1, minHeight: fmt === 'work' ? 150 : 90, fontFamily: F.medium, fontSize: 15, lineHeight: 22, color: C.ink, textAlignVertical: 'top' }}
                />
                <MicButton voice={voice} size={44} />
              </View>
              {fmt === 'work' && (
                <View style={{ gap: 8 }}>
                  <Pressable onPress={() => (tap('select'), setSketching((v) => !v))} style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: sketching ? C.teal : C.sand, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 }}>
                    <Ionicons name="brush-outline" size={14} color={sketching ? C.white : C.body} />
                    <Text style={{ fontFamily: F.bold, fontSize: 12, color: sketching ? C.white : C.body }}>{sketching ? 'Hide the sketch pad' : 'Sketch or write by hand'}</Text>
                  </Pressable>
                  {sketching && <SketchPad ref={pad} height={260} onInk={setInk} onDrawing={setDrawing} />}
                </View>
              )}
            </View>
          ) : !grade ? null : (
            <Enter>
              <View style={{ backgroundColor: tone.bg, borderRadius: 20, borderWidth: 2, borderColor: tone.border, padding: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={tone.icon} size={24} color={tone.color} />
                  <Text style={{ fontFamily: F.bold, fontSize: 16, color: tone.text }}>{tone.title}</Text>
                </View>
                <Text style={{ fontFamily: F.medium, fontSize: 14, lineHeight: 21, color: C.ink }}>{grade.feedback}</Text>
                <View style={{ borderTopWidth: 1, borderColor: C.line, paddingTop: 8 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.muted }}>MODEL ANSWER</Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.body, marginTop: 2 }}>{q.ideal}</Text>
                  {fmt === 'order' && !!q.steps && (
                    <Text style={{ fontFamily: F.bold, fontSize: 12, lineHeight: 19, color: C.teal, marginTop: 6 }}>{q.steps.map((x, k) => `${k + 1}. ${x}`).join('\n')}</Text>
                  )}
                  {fmt === 'match' && !!q.pairs && (
                    <Text style={{ fontFamily: F.bold, fontSize: 12, lineHeight: 19, color: C.teal, marginTop: 6 }}>{q.pairs.map((p) => `${p.left}  =  ${p.right}`).join('\n')}</Text>
                  )}
                  {fmt === 'sort' && !!q.buckets && (
                    <Text style={{ fontFamily: F.bold, fontSize: 12, lineHeight: 19, color: C.teal, marginTop: 6 }}>{q.buckets.map((b) => `${b.name}: ${b.items.join(', ')}`).join('\n')}</Text>
                  )}
                </View>
              </View>

              {/* talk it through */}
              <View style={{ marginTop: 12, gap: 8 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 10, letterSpacing: 0.5, color: C.goldInk }}>TALK IT THROUGH WITH COCO</Text>
                {thread.map((m, k) => (
                  <View
                    key={k}
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      backgroundColor: m.role === 'user' ? C.teal : C.white,
                      borderRadius: 16,
                      borderWidth: m.role === 'user' ? 0 : 1,
                      borderColor: C.line,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}>
                    <Text style={{ fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: m.role === 'user' ? C.white : C.ink }}>{m.text}</Text>
                  </View>
                ))}
                {talking && <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Coco is thinking…</Text>}
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                  <TextInput
                    value={reply}
                    onChangeText={setReply}
                    multiline
                    placeholder={grade.correct ? 'Ask why, or go deeper…' : 'Not sure? Ask Coco or try again…'}
                    placeholderTextColor="#A69A8A"
                    style={{ flex: 1, minHeight: 44, maxHeight: 110, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.medium, fontSize: 14, color: C.ink }}
                  />
                  <Pressable
                    onPress={talk}
                    disabled={!reply.trim() || talking}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: reply.trim() && !talking ? C.teal : C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="arrow-up" size={20} color={C.white} />
                  </Pressable>
                </View>
              </View>
            </Enter>
          )}
        </ScrollView>
        <View style={{ padding: 20, gap: 10 }}>
          {!grade ? (
            <>
              {/* shows up once there's an answer to send (like "continue" in onboarding) */}
              {(marked ? fmt === 'order' || ready : (!!answer.trim() || (fmt === 'work' && ink)) && voice.state === 'idle') || busy ? (
                <Enter key="finish">
                  <Btn title={marked ? 'Check my answer' : fmt === 'work' ? 'Check my working' : 'Finish explanation'} iconLeft="checkmark-circle" kind="teal" pill loading={busy} onPress={submit} />
                </Enter>
              ) : null}
              {!hint && (
                <Pressable onPress={() => (tap(), setHint(true))} style={{ alignSelf: 'center', flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: C.sand, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 }}>
                  <Ionicons name="bulb-outline" size={14} color={C.body} />
                  <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.body }}>Need a hint?</Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <Pressable onPress={openHook} style={{ alignSelf: 'center', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.amber, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 }}>
                <Ionicons name="bulb-outline" size={15} color={C.goldInk} />
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.goldInk }}>{existing?.mnemonic ? 'My memory hook' : 'Make a memory hook'}</Text>
              </Pressable>
              <Btn title={i + 1 >= qs.length ? 'Lock it in' : 'Next question'} icon="arrow-forward" kind="teal" pill onPress={next} />
            </>
          )}
        </View>
        <HookSheet card={hook} onClose={() => setHook(undefined)} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
