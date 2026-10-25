// Session step 4 — Active learning: "One idea at a time". Student explains, Coco grades (elaboration + self-explanation).
// Every answer is kept on its question, so the student can step back to an earlier question (and keep asking Coco
// about it), and leaving the session and coming back opens the same question again.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { AskCoco } from '@/components/AskCoco';
import { Btn, Coco, Enter, Pill, SessionHeader, T } from '@/components/ui';
import { MicButton, useVoice, withLive } from '@/components/Voice';
import { gradeAnswer, type ActiveQuestion, type Grade, type QFormat, type QKind } from '@/lib/ai';
import { HookSheet, type HookTarget } from '@/components/HookSheet';
import { SketchPad, type SketchHandle } from '@/components/SketchPad';
import { BlankQ } from '@/components/questions/Blank';
import { MatchQ } from '@/components/questions/Match';
import { OrderQ } from '@/components/questions/Order';
import { SortQ } from '@/components/questions/Sort';
import { gradeBlank, gradeMatch, gradeOrder, gradeSort } from '@/lib/grade';
import { haptic, play, tap } from '@/lib/feedback';
import { onSample, sampleAnswer, typeOut } from '@/lib/sample';
import { firstOpen, missedIdeas, ORGANIZE_MIN, saveResult, sessionContext } from '@/lib/session';
import { useApp, type QResult } from '@/store';
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
  blank: { pill: 'FILL THE GAPS', line: 'Tap the words that belong in the gaps.' },
  match: { pill: 'CONNECT THE PAIRS', line: 'Drag from a card on the left to its partner on the right.' },
  work: { pill: 'WORK IT OUT', line: 'Solve it below. Type your working.' },
};

// right = green, almost (on the right track) = orange, not yet = red
const toneOf = (g: QResult['grade']) =>
  g.correct
    ? { bg: '#F0F8E6', border: C.mintBorder, icon: 'checkmark-circle' as const, color: C.leaf, text: C.moss, title: 'Nailed it!' }
    : g.close
      ? { bg: '#FFF3DC', border: '#F0A63A', icon: 'alert-circle' as const, color: '#E08A00', text: '#B86A00', title: 'Almost there' }
      : { bg: '#FDECEA', border: '#E8998B', icon: 'close-circle' as const, color: '#D9573B', text: '#C2452B', title: 'Not yet' };

// the right answer, written out for each format (shown under the feedback when the student missed it)
const solution = (q: ActiveQuestion) =>
  q.format === 'order' && q.steps
    ? q.steps.map((x, k) => `${k + 1}. ${x}`).join('\n')
    : q.format === 'blank' && q.text
      ? q.text.replace(/\[\[(.+?)\]\]/g, '$1')
      : q.format === 'match' && q.pairs
        ? q.pairs.map((p) => `${p.left}  →  ${p.right}`).join('\n')
        : q.format === 'sort' && q.buckets
          ? q.buckets.map((b) => `${b.name}: ${b.items.join(', ')}`).join('\n')
          : q.ideal;

export default function Active() {
  const qs = useApp((s) => s.session?.questions ?? []);
  const results = useApp((s) => s.session?.results);
  const saved = useApp((s) => s.session?.qIndex);
  const patchSession = useApp((s) => s.patchSession);
  const open = firstOpen(useApp.getState().session); // the furthest the student can go: the first unanswered question
  const i = Math.max(0, Math.min(saved ?? open, qs.length - 1));
  const q = qs[i];
  // no questions this time: go straight on to the flashcards instead of a blank screen
  useEffect(() => {
    if (!q) router.replace('/session/cards');
  }, [q]);

  const go = (k: number) => {
    play('flip');
    patchSession({ qIndex: k });
  };
  // back from the first question: one step back, the organize step (when there were enough missed ideas) or the
  // review. The answers are kept: coming forward again opens the questions where the student left them.
  const goBack = () => {
    const st = useApp.getState().session;
    router.replace(missedIdeas(st?.analysis).length >= ORGANIZE_MIN ? '/session/group' : '/session/review');
  };
  const onBack = () => (i > 0 ? go(i - 1) : goBack());
  const next = () => {
    if (i + 1 < qs.length) return go(i + 1);
    const o = firstOpen(useApp.getState().session);
    if (o < qs.length) go(o); // a question was skipped over somehow: answer it first
    else router.replace('/session/cards');
  };
  if (!q) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <SessionHeader
        step={5}
        title="Active learning"
        onBack={onBack}
        leaveBody="Your tree won’t be watered yet, but your answers are saved. Next time you open today’s session, you’ll pick up at this question."
      />
      <QuestionNav i={i} n={qs.length} open={open} results={results} onGo={go} />
      <QuestionView key={i} i={i} n={qs.length} q={q} res={results?.[i] ?? undefined} onNext={next} />
    </SafeAreaView>
  );
}

/** ‹ Question 3 of 7 › with one dot per question (coloured once answered). Answered questions can be opened again. */
function QuestionNav({ i, n, open, results, onGo }: { i: number; n: number; open: number; results?: (QResult | null)[]; onGo: (k: number) => void }) {
  const canNext = i < Math.min(open, n - 1);
  const arrow = (name: 'chevron-back' | 'chevron-forward', on: boolean, k: number, label: string) => (
    <Pressable
      accessibilityLabel={label}
      disabled={!on}
      onPress={() => (tap(), onGo(k))}
      hitSlop={8}
      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: on ? C.sand : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: on ? 1 : 0.3 }}>
      <Ionicons name={name} size={18} color={C.teal} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
      {arrow('chevron-back', i > 0, i - 1, 'Previous question')}
      <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.teal }}>
          Question {i + 1} of {n}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5 }}>
          {Array.from({ length: n }, (_, k) => {
            const g = results?.[k]?.grade;
            const color = g ? toneOf(g).color : C.track;
            const reachable = k <= open;
            return (
              <Pressable
                key={k}
                accessibilityLabel={`Question ${k + 1}`}
                disabled={!reachable || k === i}
                onPress={() => (tap(), onGo(k))}
                hitSlop={4}
                style={{ width: k === i ? 18 : 8, height: 8, borderRadius: 4, backgroundColor: k === i && !g ? C.teal : color, borderWidth: k === i && g ? 1.5 : 0, borderColor: C.teal }}
              />
            );
          })}
        </View>
      </View>
      {arrow('chevron-forward', canNext, i + 1, 'Next question')}
    </View>
  );
}

/** One question. Keyed by the question, so everything typed here starts fresh on the next one. */
function QuestionView({ i, n, q, res, onNext }: { i: number; n: number; q: ActiveQuestion; res?: QResult; onNext: () => void }) {
  // a memory hook for this question: it lives on a flashcard made from it (made when the hook is saved)
  const [hook, setHook] = useState<HookTarget>();
  const cards = useApp((s) => s.cards);
  const sess = useApp((s) => s.session);
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  // "Ask Coco" opens as its own page; `voice`: opened from the mic, so it starts listening
  const [ask, setAsk] = useState<{ voice?: boolean }>();
  // answers for the formats the app marks itself
  const [order, setOrder] = useState<string[]>([]);
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [gapWords, setGapWords] = useState<string[]>([]);
  const [ready, setReady] = useState(false); // the sort / match is filled in
  // set when marked here and now: the drag/tap answer is still on screen with its ticks. Opened again later, the
  // answer is shown written out instead.
  const [marks, setMarks] = useState<{ order?: boolean[]; map?: Record<string, boolean>; gaps?: boolean[] }>();
  const [sketching, setSketching] = useState(false); // the sketch pad is open (work questions)
  const [ink, setInk] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const pad = useRef<SketchHandle>(null);
  const answerInput = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const sample = useApp(onSample); // the sample lecture: "Fill sample answer" types a ready-made (imperfect) answer
  const stopTyping = useRef<() => void>(undefined);
  useEffect(() => () => stopTyping.current?.(), []);
  const voice = useVoice(
    useCallback((t: string) => setAnswer((a) => (a.trim() ? `${a.trim()} ${t}` : t)), []),
    () => answerInput.current?.focus(),
  );

  const fmt: QFormat = q.format ?? 'explain';
  const marked = fmt === 'order' || fmt === 'sort' || fmt === 'match' || fmt === 'blank'; // the app marks these itself
  const grade = res?.grade;
  const tone = grade ? toneOf(grade) : undefined;
  const live = !grade || !!marks; // the drag/tap answer is on screen (not answered yet, or marked just now)
  const talks = res?.thread?.filter((m) => m.role === 'user').length ?? 0;
  const last = i + 1 >= n;

  const existing = cards.find((c) => c.subjectId === sess?.subjectId && c.chapterId === sess?.chapterId && c.q === q.q);
  const openHook = () => {
    if (!sess) return;
    tap('select');
    setHook(existing ?? { subjectId: sess.subjectId, chapterId: sess.chapterId, q: q.q, a: q.ideal });
  };

  // keep the grade on this question, count it, and turn a gap into a flashcard (added to the deck at the end)
  const record = (g: Grade, summary: string, shown: string) => {
    const gap = g.card?.q && g.card?.a ? g.card : !g.correct ? { q: q.q, a: q.ideal } : undefined;
    saveResult(i, { answer: shown, summary, grade: { correct: g.correct, close: g.close, feedback: g.feedback }, ...(gap ? { gap: { q: gap.q, a: gap.a } } : {}), thread: [] });
    if (g.correct) {
      play('right');
      haptic('success');
    } else if (g.close) {
      play('half'); // on the right track
      haptic('light');
    } else {
      play('miss');
      haptic('error');
    }
    setTimeout(() => scroll.current?.scrollTo({ y: 0, animated: true }), 60);
  };

  const submit = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      if (fmt === 'order') {
        const r = gradeOrder(q, order);
        setMarks({ order: r.marks });
        record(r, order.join(' → '), order.map((x, k) => `${k + 1}. ${x}`).join('\n'));
      } else if (fmt === 'sort') {
        const r = gradeSort(q, assigned);
        setMarks({ map: r.marks });
        const shown = (q.buckets ?? []).map((b) => `${b.name}: ${Object.keys(assigned).filter((it) => assigned[it] === b.name).join(', ') || '—'}`).join('\n');
        record(r, JSON.stringify(assigned), shown);
      } else if (fmt === 'blank') {
        const r = gradeBlank(q, gapWords);
        setMarks({ gaps: r.marks });
        let k = 0;
        record(r, gapWords.join(' | '), (q.text ?? '').replace(/\[\[(.+?)\]\]/g, () => `[${gapWords[k++] || '___'}]`));
      } else if (fmt === 'match') {
        const r = gradeMatch(q, matched);
        setMarks({ map: r.marks });
        record(r, JSON.stringify(matched), Object.entries(matched).map(([l, rr]) => `${l}  =  ${rr}`).join('\n'));
      } else {
        const img = fmt === 'work' && ink ? await pad.current?.capture() : undefined;
        const g = await gradeAnswer(await sessionContext(false), q, answer, img);
        const said = answer || (img ? '(sketch)' : '');
        record(g, said, said);
      }
    } catch {
      // nothing is counted: the answer stays, and checking again is one tap
      setErr('Coco lost connection. Check your internet and tap check again.');
    }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView ref={scroll} scrollEnabled={!drawing} contentContainerStyle={{ padding: 20, paddingTop: 6, gap: 14 }} keyboardShouldPersistTaps="handled">
        {!grade && (
          <Enter>
            <Pill text={(FORMAT_LINE[fmt] ?? KIND[q.kind ?? 'conceptual']).pill} />
            {marked && <T style={{ marginTop: 8 }}>{FORMAT_LINE[fmt]?.line}</T>}
          </Enter>
        )}

        {/* 1 · the question */}
        <Enter delay={grade ? 0 : 120}>
          <View style={{ backgroundColor: C.white, borderRadius: 22, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 4, padding: 18 }}>
            <Text style={{ fontFamily: F.bold, fontSize: grade ? 16 : 18, lineHeight: grade ? 23 : 26, color: C.teal, textAlign: 'center' }}>{q.q}</Text>
          </View>
        </Enter>

        {!grade && fmt === 'explain' && <Coco src={last ? COCO.pointer : COCO.stand} size={130} />}

        {hint && !grade && (
          <Enter>
            <View style={{ backgroundColor: '#FFF6E3', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.amber }}>
              <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.goldInk }}>{q.hint}</Text>
            </View>
          </Enter>
        )}

        {/* 2 · the answer: drag / tap formats */}
        {live && fmt === 'order' && !!q.steps && <OrderQ steps={q.steps} locked={!!grade} marks={marks?.order} onChange={setOrder} />}
        {live && fmt === 'sort' && !!q.buckets && (
          <SortQ buckets={q.buckets} locked={!!grade} marks={marks?.map} onChange={(a, done) => (setAssigned(a), setReady(done))} />
        )}
        {live && fmt === 'blank' && !!q.text && <BlankQ text={q.text} extras={q.extras} locked={!!grade} marks={marks?.gaps} onChange={(w, done) => (setGapWords(w), setReady(done))} />}
        {live && fmt === 'match' && !!q.pairs && (
          <MatchQ pairs={q.pairs} locked={!!grade} marks={marks?.map} onChange={(m, done) => (setMatched(m), setReady(done))} />
        )}

        {/* 2 · the answer: written */}
        {!grade && !marked && (
          <View style={{ backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.lineStrong, padding: 12, gap: 8 }}>
            {voice.state !== 'idle' && (
              <Text style={{ fontFamily: F.bold, fontSize: 11, color: voice.state === 'recording' ? C.red : C.leaf }}>
                {voice.state === 'recording' ? `● ${voice.seconds}s · tap ■ to stop` : 'Writing it down…'}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
              <TextInput
                ref={answerInput}
                value={withLive(answer, voice.live)}
                onChangeText={(t) => voice.state !== 'recording' && setAnswer(t)}
                multiline
                placeholder={fmt === 'work' ? 'Write your working, line by line…' : `${KIND[q.kind ?? 'conceptual'].placeholder}  (or tap the mic)`}
                placeholderTextColor="#A69A8A"
                style={{ flex: 1, minHeight: fmt === 'work' ? 150 : 90, fontFamily: F.medium, fontSize: 15, lineHeight: 22, color: C.ink, textAlignVertical: 'top' }}
              />
              <MicButton voice={voice} size={44} />
            </View>
            {sample && !answer && voice.state === 'idle' && (
              <Pressable
                onPress={() => (tap('select'), (stopTyping.current = typeOut(sampleAnswer(q, i), setAnswer)))}
                style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: C.mint, borderWidth: 1, borderColor: C.mintBorder, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.mossDark }}>✨ Fill sample answer</Text>
              </Pressable>
            )}
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
        )}
        {!!err && <Text style={{ fontFamily: F.bold, fontSize: 12, color: '#C2452B', textAlign: 'center' }}>{err}</Text>}

        {grade && tone && res && (
          <Enter style={{ gap: 12 }}>
            {/* 3 · how it went (and the right answer, only when it was missed) */}
            <View style={{ backgroundColor: tone.bg, borderRadius: 20, borderWidth: 2, borderColor: tone.border, padding: 16, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name={tone.icon} size={24} color={tone.color} />
                <Text style={{ fontFamily: F.bold, fontSize: 17, color: tone.text }}>{tone.title}</Text>
              </View>
              <Text style={{ fontFamily: F.medium, fontSize: 14, lineHeight: 21, color: C.ink }}>{grade.feedback}</Text>
              {!grade.correct && (
                <View style={{ borderTopWidth: 1, borderColor: tone.border, paddingTop: 8, gap: 2 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 11, color: tone.text }}>The answer</Text>
                  <Text style={{ fontFamily: F.semi, fontSize: 14, lineHeight: 20, color: C.ink }}>{solution(q)}</Text>
                </View>
              )}
            </View>

            {/* 4 · still unsure: Ask Coco opens its own page, so it's never mixed up with moving on */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => (tap('select'), setAsk({}))}
                accessibilityRole="button"
                style={{ flex: 1, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: C.teal, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={C.teal} />
                <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.teal }}>{talks ? 'Continue with Coco' : 'Ask Coco'}</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Ask Coco by voice"
                onPress={() => (tap('select'), setAsk({ voice: true }))}
                style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: C.teal, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="mic-outline" size={20} color={C.teal} />
              </Pressable>
            </View>

            <Pressable onPress={openHook} style={{ alignSelf: 'center', flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6 }}>
              <Ionicons name="bulb-outline" size={15} color={C.goldInk} />
              <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.goldInk }}>{existing?.mnemonic ? 'My memory hook' : 'Make a memory hook'}</Text>
            </Pressable>
          </Enter>
        )}
      </ScrollView>

      {/* the one main action of the screen, always in the same place */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, gap: 10, borderTopWidth: grade ? 1 : 0, borderColor: C.line }}>
        {!grade ? (
          <>
            {/* shows up once there's an answer to send (like "continue" in onboarding) */}
            {(marked ? fmt === 'order' || ready : (!!answer.trim() || (fmt === 'work' && ink)) && voice.state === 'idle') || busy ? (
              <Enter key="finish">
                <Btn title={marked ? 'Check my answer' : fmt === 'work' ? 'Check my working' : 'Check my answer'} iconLeft="checkmark-circle" kind="teal" pill loading={busy} onPress={submit} />
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
          <Btn title={last ? 'Lock it in' : 'Next question'} icon="arrow-forward" kind="teal" pill onPress={onNext} />
        )}
      </View>
      <HookSheet card={hook} onClose={() => setHook(undefined)} />
      {!!res && <AskCoco index={i} q={q} open={!!ask} withVoice={ask?.voice} onClose={() => setAsk(undefined)} />}
    </KeyboardAvoidingView>
  );
}
