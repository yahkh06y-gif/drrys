// Home — the forest: swipe left/right between your subject trees (free: 1, Pro: up to 5), each with
// today's session card, and the active subject's learning insights underground.
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Pressable, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COCO, STAT_ICONS, TREE, TREE_ASPECT } from '@/art';
import { HookGallery } from '@/components/HookGallery';
import { KnowledgeTree, type CocoLanding } from '@/components/Tree';
import { Btn, Coco, Enter, Pill, T } from '@/components/ui';
import { haptic, play, tap } from '@/lib/feedback';
import { isResting, LIMITS } from '@/lib/purchases';
import { makeSampleLecture, SAMPLE_PAGES, SAMPLE_TITLE } from '@/lib/sample';
import { checkPdf, keepFile, resumeAt } from '@/lib/session';
import { LECTURE_TYPES } from '@/lib/slides';
import { activeSubject, EMPTY_STATS, isDue, streak, today, uid, useApp, type Chapter, type Material, type Subject } from '@/store';
import { alpha, color, palette, radius } from '@/design/tokens';
import { C, F } from '@/theme';

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// The forest nudges sideways once per app launch so people discover they can swipe to their other trees.
let hinted = false;

export default function TreeScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const subjects = useApp((s) => s.subjects);
  const active = useApp(activeSubject);
  const cards = useApp((s) => s.cards);
  const isPro = useApp((s) => s.isPro);
  const globalStats = useApp((s) => s.stats);
  const set = useApp((s) => s.set);

  // The forest: one page per subject tree, and a last "plant a new tree" page (unless Pro already has 5).
  // Neighbouring trees are joined by the "between" landscape, so a swipe walks you across the meadow.
  const maxTrees = isPro ? LIMITS.proTrees : LIMITS.freeTrees;
  const plantPage = subjects.length < LIMITS.proTrees;
  const pageCount = subjects.length + (plantPage ? 1 : 0);
  const activeIdx = Math.max(0, subjects.findIndex((x) => x.id === active?.id));
  const [page, setPage] = useState(activeIdx);
  const STEP = width * 2; // tree page + between page
  const x = useSharedValue(-activeIdx * STEP);
  const startX = useSharedValue(0);
  const scroller = useRef<ScrollView>(null);
  const [viewH, setViewH] = useState(0);
  // Coco lands on the tree you arrive at; flipping trees quickly makes it a hard landing
  const [landing, setLanding] = useState<CocoLanding>({ n: 0, hard: false });
  const coachSeen = useApp((s) => s.coachSeen);
  const guide = useApp((s) => s.guide);
  const streakGoal = useApp((s) => s.plan.streakGoal);
  // the clock moves on while the tab stays mounted (cards fall due, a new day starts):
  // re-check on every focus, every return from the background and once a minute
  const [clock, setClock] = useState(0);
  useFocusEffect(useCallback(() => setClock((c) => c + 1), []));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (a) => a === 'active' && setClock((c) => c + 1));
    const t = setInterval(() => setClock((c) => c + 1), 60_000);
    return () => (sub.remove(), clearInterval(t));
  }, []);

  // back from a full session on this tree → Coco waters it (once)
  useFocusEffect(
    useCallback(() => {
      const st = useApp.getState();
      if (!st.justWatered) return;
      const here = st.subjects[pageRef.current]?.id ?? st.activeSubjectId;
      if (st.justWatered === here) setLanding((l) => ({ n: l.n + 1, hard: false, water: true }));
      st.set({ justWatered: undefined });
    }, []),
  );
  const lastFlip = useRef(0);
  const pageRef = useRef(activeIdx);
  const raceFrom = useRef(-1);

  // follow the store when the active tree changes elsewhere (e.g. a new tree was just planted)
  useEffect(() => {
    if (page !== activeIdx) {
      setPage(activeIdx);
      pageRef.current = activeIdx;
      x.value = withTiming(-activeIdx * STEP, { duration: 520, easing: Easing.out(Easing.cubic) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, subjects.length]);

  // keep the strip aligned on rotation / resize
  useEffect(() => {
    x.value = -page * STEP;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [STEP]);

  const onPage = useCallback(
    (n: number) => {
      setPage(n);
      play('flip');
      const now = Date.now();
      // Hard landing is rare: ~1 in 50, or when you race through every tree from the first to the last.
      // (Values are read here, before the refs move on; the state updater runs later.)
      const fast = now - lastFlip.current < 1400;
      const prev = pageRef.current;
      if (!fast || n !== prev + 1) raceFrom.current = prev; // a race = quick flips, always forward
      const raced = subjects.length > 1 && n === subjects.length - 1 && raceFrom.current === 0 && fast;
      const hard = raced || Math.random() < 1 / 50;
      setLanding((l) => ({ n: l.n + 1, hard }));
      lastFlip.current = now;
      pageRef.current = n;
      if (n >= subjects.length) scroller.current?.scrollTo({ y: 0, animated: true });
      if (n < subjects.length) set({ activeSubjectId: subjects[n].id });
    },
    [subjects, set],
  );

  const last = pageCount - 1;
  const goTo = (n: number) => {
    const to = Math.max(0, Math.min(last, n));
    if (to === page) return;
    x.value = withTiming(-to * STEP, { duration: 620, easing: Easing.inOut(Easing.cubic) });
    onPage(to);
  };

  // swipe hint: peek at the next tree and spring back
  useEffect(() => {
    if (hinted || pageCount < 2 || page >= last) return;
    hinted = true;
    const home = -page * STEP;
    x.value = withDelay(900, withSequence(withTiming(home - width * 0.28, { duration: 420, easing: Easing.out(Easing.quad) }), withTiming(home, { duration: 520, easing: Easing.inOut(Easing.cubic) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount]);

  const swipe = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-24, 24]) // vertical drags still scroll down to the insights
    .onStart(() => {
      startX.value = x.value;
    })
    .onUpdate((e) => {
      // the meadow moves twice as fast as the finger, so one swipe reaches the next tree
      let v = startX.value + e.translationX * 2;
      const min = -last * STEP;
      if (v > 0) v = v * 0.25;
      if (v < min) v = min + (v - min) * 0.25;
      x.value = v;
    })
    .onEnd((e) => {
      const cur = Math.round(-startX.value / STEP);
      let to = cur;
      if (e.translationX < -width * 0.15 || e.velocityX < -700) to = cur + 1;
      else if (e.translationX > width * 0.15 || e.velocityX > 700) to = cur - 1;
      to = Math.max(0, Math.min(last, to));
      x.value = withTiming(-to * STEP, { duration: 560, easing: Easing.out(Easing.cubic) });
      if (to !== cur) runOnJS(onPage)(to);
    });

  const stripA = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  if (!active) return <EmptyForest />;

  const onPlant = page >= subjects.length;
  const subject = onPlant ? active : subjects[page];
  const subjectCards = cards.filter((c) => c.subjectId === subject.id);
  const mastered = subjectCards.filter((c) => c.reps >= 2).length;
  // each tree keeps its own numbers (an older single-tree install falls back to what it had)
  const stats = subject.stats ?? (subjects.length === 1 ? globalStats : EMPTY_STATS);
  const acc = stats.quizTotal ? Math.round((stats.quizCorrect / stats.quizTotal) * 1000) / 10 : 0;
  const st = streak(stats.studyDays);
  const treeH = width / TREE_ASPECT;
  // the lawn-to-soil edge fills only what's left of the first screen under the tree, so the
  // insights further down sit on plain earth
  const band = Math.max(90, (viewH || treeH + 90) - treeH);
  // a thin strip of lawn under the tree lets today's card sit a little lower, off the trunk,
  // with "Subject insights" right under it
  const lift = 18;
  const pagerH = treeH + lift;

  return (
    <View style={{ flex: 1, backgroundColor: '#241911' }}>
      <ScrollView ref={scroller} onLayout={(e) => setViewH(e.nativeEvent.layout.height)} scrollEnabled={!onPlant} showsVerticalScrollIndicator={false} bounces={false}>
        <GestureDetector gesture={swipe}>
          <View style={{ width, height: pagerH, overflow: 'hidden', backgroundColor: LAWN }}>
            <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: pagerH, width: STEP * pageCount }, stripA]}>
              {subjects.map((s, i) => (
                <View key={s.id} style={{ position: 'absolute', top: 0, left: i * STEP, width, height: pagerH }}>
                  <TreePage clock={clock} subjectId={s.id} width={width} height={pagerH} topInset={insets.top} near={Math.abs(i - page) <= 1} coco={i === page ? landing : undefined} onInsights={() => scroller.current?.scrollTo({ y: pagerH - 30, animated: true })} />
                </View>
              ))}
              {Array.from({ length: pageCount - 1 }, (_, i) => (
                <Image key={`b${i}`} source={TREE.between} style={{ position: 'absolute', top: 0, left: i * STEP + width - 1, width: width + 2, height: treeH }} contentFit="cover" />
              ))}
              {plantPage && (
                <View style={{ position: 'absolute', top: 0, left: subjects.length * STEP, width, height: treeH }}>
                  <PlantPage width={width} height={treeH} topInset={insets.top} locked={subjects.length >= maxTrees} />
                </View>
              )}
            </Animated.View>

            {/* arrows: the obvious way to walk to the neighbouring tree (swiping works too) */}
            {page > 0 && <SideArrow side="left" top={treeH * 0.56} onPress={() => goTo(page - 1)} />}
            {page < last && <SideArrow side="right" top={treeH * 0.56} onPress={() => goTo(page + 1)} plus={plantPage && page + 1 === last} />}

            {/* first visit: Coco explains the daily watering, pointing at the card */}
            {!coachSeen && !guide && !onPlant && <CoachTip width={width} height={pagerH} onDone={() => set({ coachSeen: true })} />}

            {/* right after onboarding: one guided step, done by hand (add a lecture, then how the days work) */}
            {!!guide && !onPlant && <GuideTip subject={subject} step={guide} width={width} height={pagerH} />}

            {/* which tree you're looking at */}
            {pageCount > 1 && (
              <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 54, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                {Array.from({ length: pageCount }, (_, i) =>
                  plantPage && i === pageCount - 1 ? (
                    <Ionicons key={i} name="add-circle" size={13} color={i === page ? C.leaf : alpha(palette.neutral900, 0.35)} />
                  ) : (
                    <View key={i} style={{ height: 8, width: i === page ? 22 : 8, borderRadius: 4, backgroundColor: i === page ? C.ink : alpha(palette.neutral900, 0.3) }} />
                  ),
                )}
              </View>
            )}
          </View>
        </GestureDetector>

        {/* underground: the lawn of the render fades into soil. The empty spot for a new tree has no insights. */}
        {onPlant ? (
          <Soil band={band} />
        ) : (
          <Soil band={band} style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40, gap: 16 }}>
            <View style={{ alignItems: 'center', gap: 2, marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: C.paper, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 }}>
                <Ionicons name="stats-chart" size={13} color={C.bark} />
                <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.bark }}>Subject insights</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={color.overlay.onDark} />
            </View>
            <View style={{ alignItems: 'center' }}>
              <T v="h3" style={{ color: C.white }}>
                {subject.name} Learning Progress
              </T>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Stat icon={STAT_ICONS.fire} label="Daily Study Streak" value={`Day ${st} of ${streakGoal}`} note={stats.studyDays.includes(today()) ? 'Watered today' : 'Study today to keep it'} noteColor={C.orange}>
                <WeekFlames days={stats.studyDays} />
              </Stat>
              <Stat icon={STAT_ICONS.cards} label="Cards Mastered" value={`${mastered} / ${subjectCards.length}`} note={`${subjectCards.length - mastered} remaining in pool`}>
                <Segments value={subjectCards.length ? mastered / subjectCards.length : 0} />
              </Stat>
              <Stat icon={STAT_ICONS.target} label="Quiz Accuracy" value={`${acc}%`} note={`${stats.quizTotal} questions answered`}>
                <Bar value={acc / 100} />
              </Stat>
              <Stat icon={STAT_ICONS.clock} label="Time Studied" value={stats.minutes >= 60 ? `${(stats.minutes / 60).toFixed(1)} hrs` : `${stats.minutes} min`} note={`${stats.xp} XP earned`} noteColor={C.muted}>
                <Ticks days={stats.studyDays} />
              </Stat>
            </View>
            <Btn title="Talk it through with Coco" iconLeft="chatbubble-ellipses" kind="light" height={48} onPress={() => router.navigate('/(tabs)/coco')} />
          </Soil>
        )}
      </ScrollView>
    </View>
  );
}

const shadowSoft = { shadowColor: palette.neutral900, shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 } as const;

function SideArrow({ side, top, onPress, plus }: { side: 'left' | 'right'; top: number; onPress: () => void; plus?: boolean }) {
  return (
    <Pressable
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={plus ? 'Plant a new tree' : side === 'left' ? 'Previous tree' : 'Next tree'}
      onPress={() => (tap('select'), onPress())}
      style={{
        position: 'absolute',
        top,
        [side]: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: alpha(palette.neutral25, 0.94),
        ...shadowSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={plus ? 'add' : side === 'left' ? 'chevron-back' : 'chevron-forward'} size={22} color={plus ? C.leaf : C.ink} />
    </Pressable>
  );
}

// One subject's tree: header, the Knowledge Tree itself and today's session card on the lawn.
// Trees far from the one on screen render just the tree (no card) to keep the forest light.
function TreePage({ clock, subjectId, width, height, topInset, near, coco, onInsights }: { clock: number; subjectId: string; width: number; height: number; topInset: number; near: boolean; coco?: CocoLanding; onInsights: () => void }) {
  const subject = useApp((s) => s.subjects.find((x) => x.id === subjectId));
  const cards = useApp((s) => s.cards);
  const [sel, setSel] = useState<string>();
  const subjectIdx = useApp((s) => s.subjects.findIndex((x) => x.id === subjectId));
  const isPro = useApp((s) => s.isPro);
  const together = useApp((s) => s.together);
  const due = useMemo(() => cards.filter((c) => c.subjectId === subjectId && isDue(c)), [cards, subjectId, clock]); // eslint-disable-line react-hooks/exhaustive-deps
  // memory hooks the student made on this tree (listed when a branch is held)
  const hooks = useMemo(() => cards.filter((c) => c.subjectId === subjectId && !!c.mnemonic), [cards, subjectId]);
  const [holdId, setHoldId] = useState<string>();
  // days since this tree was last watered → how yellow its leaves are (nothing until the 2nd day away)
  const wilt = useMemo(() => {
    const last = subject?.doneOn;
    if (!last) return 0;
    const [y, m, d] = last.split('-').map(Number);
    const gap = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(y, m - 1, d).getTime()) / 86_400_000);
    return Math.max(0, Math.min(1, (gap - 1) / 5));
  }, [subject?.doneOn, clock]); // eslint-disable-line react-hooks/exhaustive-deps
  const hookTipSeen = useApp((s) => s.hookTipSeen);
  const setApp = useApp((s) => s.set);
  if (!subject) return null;
  // default: the first unfinished branch that isn't resting (Pro ended), else the first branch
  const open = subject.chapters.filter((_, i) => !isResting(subjectIdx, i, isPro, together));
  const chapter = subject.chapters.find((c) => c.id === sel) ?? open.find((c) => c.mastery < 1) ?? open[0] ?? subject.chapters[0];
  return (
    <View style={{ width, height }}>
    <KnowledgeTree width={width} chapters={subject.chapters} wilt={wilt} selected={chapter?.id} coco={coco} onSelect={(id) => (tap('select'), setSel(id))} onHold={(id) => (setHoldId(id), setApp({ hookTipSeen: true }))}>
      <View style={{ position: 'absolute', top: topInset + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable hitSlop={10} onPress={() => (tap(), router.push({ pathname: '/subject', params: { id: subject.id } }))} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="create-outline" size={24} color={C.ink} />
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, marginRight: 40, textAlign: 'center', fontFamily: F.semi, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, color: C.ink }}>
          {subject.name}
        </Text>
      </View>

      {near && hooks.length > 0 && !hookTipSeen && (
        <Enter delay={600} style={{ position: 'absolute', top: topInset + 58, left: 24, right: 24 }}>
          <Pressable onPress={() => setApp({ hookTipSeen: true })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.teal, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.white }}>Hold a branch to see its memory hooks.</Text>
            <Ionicons name="close" size={16} color={C.white} />
          </Pressable>
        </Enter>
      )}

      <HookGallery
        title={holdId ? `Ch ${subject.chapters.findIndex((c) => c.id === holdId) + 1}` : undefined}
        cards={hooks.filter((c) => c.chapterId === holdId)}
        onClose={() => setHoldId(undefined)}
      />
    </KnowledgeTree>
      {near && chapter && (
        <Enter delay={200} style={{ position: 'absolute', bottom: CARD_GAP, left: 20, right: 20 }}>
          <TodayCard subject={subject} chapter={chapter} due={due.length} onInsights={onInsights} />
        </Enter>
      )}
    </View>
  );
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Today's task for this tree, one card of fixed height:
//   lecture day → a full session on the chapter · other days → flashcard review only
//   finished today → "Well done", with what comes next
function TodayCard({ subject, chapter, due, onInsights }: { subject: Subject; chapter: Chapter; due: number; onInsights: () => void }) {
  const startSession = useApp((s) => s.startSession);
  const dow = new Date().getDay();
  const lecture = subject.days.includes(dow);
  const done = subject.doneOn === today();
  const ch = `Ch ${subject.chapters.indexOf(chapter) + 1} · `;
  const cardsLabel = `${due} ${due === 1 ? 'card' : 'cards'}`;

  // what's next, for the done / rest states
  const nextLecture = [1, 2, 3, 4, 5, 6, 7].map((k) => (dow + k) % 7).find((d) => subject.days.includes(d));
  const next = nextLecture === undefined ? 'Next: flashcards tomorrow' : nextLecture === (dow + 1) % 7 ? 'Next: full session tomorrow' : `Next: full session on ${WEEKDAYS[nextLecture]}`;

  const resting = useApp((s) => isResting(s.subjects.findIndex((x) => x.id === subject.id), subject.chapters.indexOf(chapter), s.isPro, s.together));
  // an unfinished session on this chapter that reached the questions: open it again at the same question
  const resume = useApp((s) => resumeAt(s.session, subject.id, chapter.id));
  const total = useApp((s) => s.session?.questions?.length ?? 0);
  const fullSession = () => {
    if (resting) return router.push('/paywall');
    if (resume !== undefined) return router.push('/session/active');
    startSession(subject.id, chapter.id);
    router.push('/session/choose');
  };
  const flashcards = () => router.push({ pathname: '/session/cards', params: { mode: 'review' } });

  let title: React.ReactNode, pill: string, action: React.ReactNode, side: React.ReactNode = null;
  let icon: number | undefined; // what today's session is: the book (lecture) or the water drop (flashcards)
  if (done) {
    title = (
      <>
        <Ionicons name="checkmark-circle" size={17} color={C.leaf} /> Well done!
      </>
    );
    pill = 'Watered today';
    action = <Btn title="See your progress" icon="stats-chart" kind="light" height={46} onPress={onInsights} />;
    if (due > 0) side = <DueBadge count={due} label={cardsLabel} onPress={flashcards} />;
  } else if (lecture) {
    title = (
      <>
        <Text style={{ color: C.leaf }}>{ch}</Text>
        {chapter.title}
      </>
    );
    pill = 'Full session';
    icon = STAT_ICONS.book;
    action = resting ? (
      <Btn title="Resting · renew Pro" icon="lock-closed" kind="light" height={46} onPress={fullSession} />
    ) : (
      <Btn title={resume !== undefined ? `Continue · question ${resume + 1} of ${total}` : 'Start session'} icon="arrow-forward" kind="leaf" height={46} onPress={fullSession} />
    );
    if (due > 0) side = <DueBadge count={due} label={cardsLabel} onPress={flashcards} />;
  } else if (due > 0) {
    title = 'Flashcard review';
    pill = `${cardsLabel} · ${Math.max(2, Math.ceil(due / 2))}m`;
    icon = STAT_ICONS.water;
    action = <Btn title="Start flashcards" icon="albums" kind="leaf" height={46} onPress={flashcards} />;
  } else {
    title = 'Nothing due today';
    pill = 'Rest day';
    action = <Btn title={resting ? 'Resting · renew Pro' : resume !== undefined ? `Continue · question ${resume + 1} of ${total}` : 'Study ahead anyway'} icon={resting ? 'lock-closed' : 'arrow-forward'} kind="light" height={46} onPress={fullSession} />;
  }

  return (
    <View style={{ backgroundColor: done ? color.feedback.correct.bg : color.surface.cardWarm, borderWidth: 2, borderColor: color.border.bark, borderRadius: radius.xl, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {icon !== undefined && <Image source={icon} style={{ width: 24, height: 24, marginRight: -2 }} contentFit="contain" />}
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.semi, fontSize: 16, color: C.ink }}>
          {title}
        </Text>
        <Pill text={pill} />
      </View>
      <WeekStrip subject={subject} next={next} />
      {/* one fixed-height row, so the card never grows over the tree */}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>{action}</View>
        {side}
      </View>
    </View>
  );
}

// This week at a glance: lecture days (full session) vs flashcard days, and the days the tree was watered.
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function WeekStrip({ subject, next }: { subject: Subject; next: string }) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const t = today();
  const done = new Set(subject.doneDays ?? (subject.doneOn ? [subject.doneOn] : []));
  return (
    <View accessibilityLabel={`This week. ${next}`} style={{ flexDirection: 'row', gap: 5 }}>
      {DAY_LETTERS.map((letter, i) => {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const key = today(d);
        const isToday = key === t;
        const watered = done.has(key);
        const missed = key < t && !watered;
        const lecture = subject.days.includes(i);
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              backgroundColor: watered ? color.game.watered : C.white,
              borderWidth: isToday ? 2 : 1,
              borderColor: isToday ? C.teal : watered ? color.game.wateredEdge : C.line,
              opacity: missed ? 0.45 : 1,
            }}>
            <Text style={{ fontFamily: F.medium, fontSize: 11, color: isToday ? C.teal : C.muted }}>{letter}</Text>
            {watered ? (
              <Ionicons name="checkmark" size={13} color={C.leaf} />
            ) : (
              <Image source={lecture ? STAT_ICONS.book : STAT_ICONS.water} style={{ width: 16, height: 16 }} contentFit="contain" />
            )}
          </View>
        );
      })}
    </View>
  );
}

function DueBadge({ count, label, onPress }: { count: number; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`${label} ready to review`}
      onPress={() => (tap(), onPress())}
      accessibilityRole="button"
      style={{ width: 50, height: 50, borderRadius: radius.md, borderWidth: 1.5, borderBottomWidth: 4, borderColor: color.border.strong, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={STAT_ICONS.cards} style={{ width: 34, height: 34 }} contentFit="contain" />
      <View style={{ position: 'absolute', top: -7, right: -7, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: F.semi, fontSize: 11, color: C.white, fontVariant: ['tabular-nums'] }}>{count}</Text>
      </View>
    </Pressable>
  );
}

// Coco's one-time explainer over the tree: three short lines, pointing down at today's card.
const COACH_LINES: { text: string; icons?: { src: number; label: string }[] }[] = [
  { text: 'Water your tree a little every day.' },
  { text: 'This card shows what it needs today.' },
  {
    text: 'Here’s the week at a glance:',
    icons: [
      { src: STAT_ICONS.book, label: 'Lecture day: a full session' },
      { src: STAT_ICONS.water, label: 'Other days: a few flashcards' },
    ],
  },
];
const CARD_H = 158; // today's card height, measured from its layout (header + week strip + button + padding)
const CARD_GAP = 10; // space under today's card, above the soil

function CoachTip({ width, height, onDone }: { width: number; height: number; onDone: () => void }) {
  const [i, setI] = useState(0);
  const line = COACH_LINES[i];
  const last = i === COACH_LINES.length - 1;
  const cardTop = height - CARD_GAP - CARD_H;
  const dim = color.overlay.scrimStrong;
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width, height, zIndex: 20 }}>
      {/* dim everything except the card */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: cardTop - 6, backgroundColor: dim }} />
      <View style={{ position: 'absolute', left: 0, width: 14, top: cardTop - 6, bottom: 0, backgroundColor: dim }} />
      <View style={{ position: 'absolute', right: 0, width: 14, top: cardTop - 6, bottom: 0, backgroundColor: dim }} />
      <View style={{ position: 'absolute', left: 14, right: 14, top: height - CARD_GAP + 6, bottom: 0, backgroundColor: dim }} />

      <Enter key={i} style={{ position: 'absolute', left: 28, right: 28, bottom: height - cardTop + 14 }}>
        <View style={{ backgroundColor: C.white, borderRadius: radius.xl, padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Image source={COCO.classic} style={{ width: 40, height: 50 }} contentFit="contain" />
            <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 16, lineHeight: 23, color: C.teal }}>{line.text}</Text>
          </View>
          {line.icons?.map((ic) => (
            <View key={ic.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingLeft: 4 }}>
              <View style={{ width: 26, height: 26, borderRadius: radius.sm, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={ic.src} style={{ width: 20, height: 20 }} contentFit="contain" />
              </View>
              <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.ink }}>{ic.label}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {COACH_LINES.map((_, k) => (
                <View key={k} style={{ width: k === i ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? C.teal : C.line }} />
              ))}
            </View>
            <Pressable
              onPress={() => {
                tap('select');
                if (last) onDone();
                else setI(i + 1);
              }}
              hitSlop={8}
              style={{ backgroundColor: C.green, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: 3, borderColor: C.greenShadow }}>
              <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.white }}>{last ? 'Got it!' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
        {/* pointer down at the card */}
        <View style={{ width: 16, height: 16, backgroundColor: C.white, transform: [{ rotate: '45deg' }], alignSelf: 'center', marginTop: -9 }} />
      </Enter>
    </View>
  );
}

// Right after onboarding: the dim falls on the tree and Coco asks for ONE thing, done by hand (a tour
// of every button is skipped and forgotten; one action is remembered). Only once a lecture is in does
// he explain the two kinds of days, because now it means something. Then: the first session.
function GuideTip({ subject, step, width, height }: { subject: Subject; step: 'files' | 'days'; width: number; height: number }) {
  const set = useApp((s) => s.set);
  const updateSubject = useApp((s) => s.updateSubject);
  const startSession = useApp((s) => s.startSession);
  const patchSession = useApp((s) => s.patchSession);
  const minutes = useApp((s) => s.plan.minutes);
  const isPro = useApp((s) => s.isPro);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState(false);
  // first, let Coco water the new sapling
  useEffect(() => {
    const t = setTimeout(() => setShown(true), step === 'files' ? 2600 : 0);
    return () => clearTimeout(t);
  }, [step]);
  const chapter = subject.chapters[0];
  if (!shown || !chapter) return null;

  const addFile = (m: Material, title?: string) => {
    updateSubject(subject.id, {
      chapters: subject.chapters.map((c, i) => (i === 0 ? { ...c, title: title && /^Chapter \d+$/.test(c.title) ? title : c.title, materials: [...c.materials, m] } : c)),
    });
    haptic('success');
    play('grow');
    set({ guide: 'days' });
  };

  const upload = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: LECTURE_TYPES, copyToCacheDirectory: true });
    if (r.canceled) return;
    const f = r.assets[0];
    const bad = await checkPdf(f, { chapter: true, isPro });
    if (bad) return Alert.alert('Can’t use this file', bad);
    addFile({ id: uid(), name: f.name, uri: await keepFile(f.uri, f.name), size: f.size, mime: f.mimeType });
  };

  const sample = async () => {
    setBusy(true);
    try {
      addFile(await makeSampleLecture(), SAMPLE_TITLE);
    } catch {
      Alert.alert('Couldn’t make the sample', 'Please try again, or upload your own lecture.');
    } finally {
      setBusy(false);
    }
  };

  const close = () => set({ guide: undefined, coachSeen: true });

  const start = () => {
    const st = useApp.getState();
    const ch = st.subjects.find((x) => x.id === subject.id)?.chapters[0];
    if (!ch) return close();
    close();
    startSession(subject.id, ch.id);
    const m = ch.materials.at(-1);
    if (m?.sample) patchSession({ fromPage: 1, toPage: SAMPLE_PAGES });
    router.push('/session/choose');
  };

  const dim = color.overlay.scrimStrong;
  const box = { backgroundColor: C.white, borderRadius: radius.xl, padding: 16, gap: 12 } as const;
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width, height, zIndex: 30, backgroundColor: dim, justifyContent: 'flex-end', padding: 20, paddingBottom: 28 }}>
      {step === 'files' && !later && (
        <Pressable onPress={close} hitSlop={10} style={{ position: 'absolute', top: 56, right: 20, padding: 6 }}>
          <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.white }}>Skip</Text>
        </Pressable>
      )}
      <Enter key={`${step}${later}`}>
        <View style={box}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Image source={COCO.classic} style={{ width: 44, height: 55 }} contentFit="contain" />
            <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 16, lineHeight: 23, color: C.teal }}>
              {later
                ? 'After your next lecture, tap the pencil at the top to add it.'
                : step === 'files'
                  ? `This is your ${subject.name} tree. Add your last lecture and I’ll quiz you on it.`
                  : 'Your lecture is in. Here’s your week:'}
            </Text>
          </View>
          {later ? (
            <Btn title="Got it!" kind="green" height={48} onPress={close} />
          ) : step === 'files' ? (
            <View style={{ gap: 10 }}>
              <View style={{ gap: 6 }}>
                <Btn title="Upload a lecture" iconLeft="cloud-upload-outline" kind="green" height={50} disabled={busy} onPress={upload} />
                <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted, textAlign: 'center' }}>PDF or PowerPoint</Text>
              </View>
              <Btn title="Try a sample lecture" iconLeft="sparkles-outline" kind="light" height={48} loading={busy} onPress={sample} />
              <Pressable onPress={() => (tap(), setLater(true))} style={{ alignSelf: 'center', padding: 4 }}>
                <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>Later</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {[
                { src: STAT_ICONS.book, label: `Lecture day: a full session, about ${minutes} min` },
                { src: STAT_ICONS.water, label: 'Other days: a few flashcards' },
              ].map((ic) => (
                <View key={ic.label} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: C.cream, borderRadius: radius.lg, padding: 10 }}>
                  <Image source={ic.src} style={{ width: 30, height: 30 }} contentFit="contain" />
                  <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.ink }}>{ic.label}</Text>
                </View>
              ))}
              <Btn title="Start my first session" icon="arrow-forward" kind="leaf" height={50} onPress={start} />
              <Pressable onPress={close} style={{ alignSelf: 'center', padding: 4 }}>
                <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>Later</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Enter>
    </View>
  );
}

// The empty spot at the end of the forest: plant another subject here (Pro unlocks up to 5 trees).
function PlantPage({ width, height, topInset, locked }: { width: number; height: number; topInset: number; locked: boolean }) {
  return (
    <View style={{ width, height }}>
      <Image pointerEvents="none" source={TREE.empty} style={{ position: 'absolute', left: 0, top: 0, width, height }} contentFit="cover" />
      <View style={{ position: 'absolute', top: topInset + 8, left: 24, right: 24, height: 40, justifyContent: 'center' }}>
        <Text accessibilityRole="header" style={{ textAlign: 'center', fontFamily: F.semi, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, color: C.ink }}>New tree</Text>
      </View>
      <View style={{ position: 'absolute', top: topInset + 84, left: 32, right: 32, alignItems: 'center', gap: 6 }}>
        <T v="h2" style={{ textAlign: 'center' }}>
          {locked ? 'Grow a whole forest' : 'Room for another tree'}
        </T>
        <T style={{ textAlign: 'center', color: C.ink }}>
          {locked ? 'Pro gives you up to 5 trees.' : 'Plant a new subject here.'}
        </T>
      </View>
      <Coco src={COCO.shovel} size={Math.min(190, width * 0.48)} style={{ position: 'absolute', top: height * 0.4, alignSelf: 'center' }} />
      <View style={{ position: 'absolute', bottom: 28, left: 24, right: 24 }}>
        <Btn
          title={locked ? 'Unlock more trees' : 'Plant a new tree'}
          icon={locked ? 'lock-open' : 'leaf'}
          kind="leaf"
          sfx="grow"
          onPress={() => router.push(locked ? '/paywall' : '/subject')}
        />
      </View>
    </View>
  );
}

// Lawn → soil, matching the Figma "under ground" gradient: the first `band` px carry the lawn-to-earth
// edge, then the earth darkens down to the bottom of the page.
const LAWN = '#C8F197'; // the colour at the very bottom of the tree render

function Soil({ band, style, children }: { band: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  return (
    <View style={[{ minHeight: band, backgroundColor: '#241911' }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={[LAWN, '#A9D179', '#95B96C', '#6E8852', '#787249', '#7E6644', '#835B3F']}
        locations={[0, 0.37, 0.5, 0.74, 0.81, 0.85, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: band }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['#835B3F', '#5A3C26', '#241911']}
        locations={[0, 0.35, 0.85]}
        style={{ position: 'absolute', left: 0, right: 0, top: band - 1, bottom: 0 }}
      />
      {children}
    </View>
  );
}

function EmptyForest() {
  return (
    <LinearGradient colors={['#8CC8EC', '#CFE9F4', '#B9DC7A']} style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <T v="h1" style={{ color: C.teal, textAlign: 'center' }}>
        Your forest is waiting
      </T>
      <T style={{ textAlign: 'center', marginTop: 8 }}>One tree per subject, one branch per chapter.</T>
      <Coco src={COCO.shovel} size={220} />
      <Btn title="Plant my first tree" kind="leaf" icon="leaf" sfx="grow" onPress={() => router.push('/subject')} />
    </LinearGradient>
  );
}

function Stat({ icon, label, value, note, noteColor = C.moss, children }: { icon: number; label: string; value: string; note: string; noteColor?: string; children: React.ReactNode }) {
  return (
    <View style={{ width: '47.5%', backgroundColor: color.surface.cardWarm, borderWidth: 2, borderColor: C.bark, borderBottomWidth: 6, borderRadius: radius.lg, padding: 14, gap: 4 }}>
      {/* clay icon (Blender render) perched on the card's corner */}
      <Image source={icon} style={{ position: 'absolute', top: -14, right: -8, width: 44, height: 44, transform: [{ rotate: '8deg' }] }} contentFit="contain" />
      <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, paddingRight: 30 }}>{label}</Text>
      <Text style={{ fontFamily: F.semi, fontSize: 18, color: C.ink, letterSpacing: -0.2, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 11, color: noteColor }}>{note}</Text>
      <View style={{ borderTopWidth: 1, borderColor: color.border.subtle, paddingTop: 7, marginTop: 4 }}>{children}</View>
    </View>
  );
}

function lastWeek() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
}

function WeekFlames({ days }: { days: string[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {lastWeek().map((d, i) => (
        <View key={i} style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: F.medium, fontSize: 10, color: C.muted }}>{DAY_NAMES[d.getDay()]}</Text>
          <Image source={STAT_ICONS.fire} style={{ width: 13, height: 13, marginTop: 2, opacity: days.includes(today(d)) ? 1 : 0.22 }} contentFit="contain" />
        </View>
      ))}
    </View>
  );
}

function Segments({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, height: 8 }}>
      {Array.from({ length: 5 }, (_, i) => {
        const f = Math.max(0, Math.min(1, value * 5 - i));
        return (
          <View key={i} style={{ flex: 1, backgroundColor: C.track, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ width: `${f * 100}%`, height: '100%', backgroundColor: C.moss }} />
          </View>
        );
      })}
    </View>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <View style={{ height: 8, backgroundColor: C.track, borderRadius: 99, overflow: 'hidden' }}>
      <View style={{ width: `${value * 100}%`, height: '100%', backgroundColor: C.moss, borderRadius: 99 }} />
    </View>
  );
}

function Ticks({ days }: { days: string[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 14, paddingHorizontal: 4 }}>
      {lastWeek().map((d, i) => (
        <View key={i} style={{ width: 4, height: days.includes(today(d)) ? 14 : 5, borderRadius: 9, backgroundColor: days.includes(today(d)) ? C.moss : palette.neutral400 }} />
      ))}
    </View>
  );
}
