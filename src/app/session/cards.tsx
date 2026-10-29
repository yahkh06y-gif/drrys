// Session step 5 — "Lock in what matters": flashcards scheduled with spaced repetition (SM-2).
// Also used standalone (mode=review) for cards that are due.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { autoDir } from '@/design/rtl';
import { color, ease, palette, radius, shadow } from '@/design/tokens';
import { CocoChatSheet } from '@/components/AskCoco';
import { HookSheet } from '@/components/HookSheet';
import { Squeeze } from '@/components/SessionMotion';
import { Enter, IconBtn, Pill, SessionHeader, T } from '@/components/ui';
import { askAboutCard, levelUp, makeCards } from '@/lib/ai';
import { haptic, play, tap } from '@/lib/feedback';
import { cardsReady } from '@/lib/prep';
import { cardContext, sessionContext } from '@/lib/session';
import { isDue, useApp, type Card, type ChatMsg, type Rating } from '@/store';
import { C, F } from '@/theme';

// clay icons: refresh = forgot, dumbbell = hard, thumbs up = good, lightning = easy
const RATINGS: { r: Rating; label: string; sub: string; icon: number }[] = [
  { r: 'forgot', label: 'Forgot', sub: 'Again soon', icon: require('../../../assets/art/ratings/forgot.png') },
  { r: 'hard', label: 'Hard', sub: 'With effort', icon: require('../../../assets/art/ratings/hard.png') },
  { r: 'good', label: 'Good', sub: 'Correct', icon: require('../../../assets/art/ratings/good.png') },
  { r: 'easy', label: 'Easy', sub: 'Instant', icon: require('../../../assets/art/ratings/easy.png') },
];

export default function Cards() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const review = mode === 'review';
  const session = useApp((s) => s.session);
  const allCards = useApp((s) => s.cards);
  const activeId = useApp((s) => s.activeSubjectId);
  const addCards = useApp((s) => s.addCards);
  const rateCard = useApp((s) => s.rateCard);
  const patchSession = useApp((s) => s.patchSession);

  const [ids, setIds] = useState<string[]>(() =>
    review ? allCards.filter((c) => (!activeId || c.subjectId === activeId) && isDue(c)).map((c) => c.id) : (session?.newCardIds ?? []),
  );
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(!review && !(session?.newCardIds.length));
  const flip = useSharedValue(0);
  const [revealed, setRevealed] = useState(false); // the answer has been seen (unlocks rating)
  const [onBack, setOnBack] = useState(false); // which side is showing now
  const [ask, setAsk] = useState(false);
  // a card that slipped 3 times in a row offers a memory hook (the student's choice); `go` carries on afterwards
  const [hook, setHook] = useState<{ card: Card; go: () => void; auto?: boolean }>();
  const [toast, setToast] = useState<string>();

  useEffect(() => {
    if (!loading || !session?.analysis) return;
    (async () => {
      try {
        // usually ready already (written in the background while the student practised); otherwise ask Coco now
        await cardsReady();
        const drafts = useApp.getState().session?.draftCards;
        const general = drafts?.length ? drafts : await makeCards(await sessionContext(false), session.analysis!);
        // the gaps from active learning come first, then the lecture cards (without repeating a question)
        const gaps = session.gapCards ?? [];
        const seen = new Set(gaps.map((c) => c.q.trim().toLowerCase()));
        const made = [...gaps, ...general.filter((c) => !seen.has(c.q.trim().toLowerCase()))];
        const newIds = addCards(made.map((c) => ({ ...c, subjectId: session.subjectId, chapterId: session.chapterId })));
        patchSession({ newCardIds: newIds });
        setIds(newIds);
      } catch {
        setIds([]);
      }
      setLoading(false);
    })();
  }, [loading, session, addCards, patchSession]);

  const cards = useMemo(() => ids.map((id) => allCards.find((c) => c.id === id)).filter(Boolean), [ids, allCards]);
  const card = cards[i];

  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }], backfaceVisibility: 'hidden' }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }], backfaceVisibility: 'hidden' }));

  // tap flips the card either way, so the question can be read again after the answer
  const reveal = () => {
    const toBack = !onBack;
    play('flip');
    haptic('light');
    flip.value = withTiming(toBack ? 1 : 0, { duration: 360, easing: ease.inOut });
    setOnBack(toBack);
    if (toBack) setRevealed(true);
  };

  const finish = () => {
    if (review) {
      useApp.getState().logReview(activeId, ids.length);
      // on a day without a lecture, the flashcard review IS the day's session for this tree
      const sub = useApp.getState().subjects.find((x) => x.id === activeId);
      if (sub && !sub.days.includes(new Date().getDay())) useApp.getState().markDone(sub.id);
      play('celebrate');
      router.back();
    } else router.replace('/session/done');
  };

  // 3 right in a row: the card graduates — a harder, apply-it question is added for a few days later
  const graduate = async (c: Card) => {
    try {
      const harder = await levelUp(cardContext(c.subjectId), c);
      const st = useApp.getState();
      const [id] = st.addCards([{ q: harder.q, a: harder.a, subjectId: c.subjectId, chapterId: c.chapterId, level: 2 }]);
      st.patchCard(id, { due: Date.now() + 3 * 86_400_000 });
      st.patchCard(c.id, { leveled: true });
      play('success');
      setToast('Mastered! Coco added a harder version of that card.');
      setTimeout(() => setToast(undefined), 4000);
    } catch {
      // no connection: it will graduate the next time it is answered right
    }
  };

  const rate = (r: Rating) => {
    if (!card) return;
    const res = rateCard(card.id, r);
    // every rating has its sound: easy / good = right, hard = half right, forgot = wrong
    play(r === 'forgot' ? 'wrong' : r === 'hard' ? 'half' : 'right');
    haptic(r === 'forgot' ? 'error' : r === 'hard' ? 'light' : 'success');
    const advance = () => {
      if (i + 1 >= cards.length) return finish();
      flip.value = 0;
      setRevealed(false);
      setOnBack(false);
      setI(i + 1);
    };
    if (res && res.wrong >= 3 && res.wrong % 3 === 0 && !card.mnemonic) return setHook({ card, go: advance, auto: true });
    if (res && res.right === 3 && !card.leveled) graduate(card);
    advance();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      {review ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
          <IconBtn name="close" onPress={() => router.back()} />
          <T v="title" style={{ color: C.teal }}>
            Daily review
          </T>
        </View>
      ) : (
        <>
          {/* back to the questions: the answers are kept, and it opens on the last question */}
          <SessionHeader step={6} title="Lock it in" onBack={() => router.replace('/session/active')} />
        </>
      )}
      <View style={{ flex: 1, padding: 20, gap: 14 }}>
        <Enter>
          <Pill text={review ? 'Spaced repetition' : 'Made from today’s session'} bg={C.sand} border={C.sand} fg={C.body} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
            <T v="h2">Lock in what matters</T>
            {!!cards.length && <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted, fontVariant: ['tabular-nums'] }}>{i + 1} / {cards.length}</Text>}
          </View>
        </Enter>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <ActivityIndicator color={C.teal} />
            <Text style={{ fontFamily: F.medium, color: C.muted }}>Coco is writing your cards…</Text>
          </View>
        ) : !card ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Text style={{ fontFamily: F.semi, fontSize: 17, color: C.ink }}>No cards due — your memory is fresh </Text>
            <Pressable onPress={finish}>
              <Text style={{ fontFamily: F.bold, color: C.leaf }}>Continue</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Enter key={card.id}>
            <Pressable onPress={reveal} style={{ height: 300 }}>
              <Animated.View style={[cardStyle, front]}>
                <Pill text={card.reps ? 'Review' : 'New'} bg={color.feedback.almost.picked} border={color.feedback.almost.picked} fg={color.feedback.almost.text} />
                <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted, marginTop: 14 }}>Question</Text>
                <Text style={[{ fontFamily: F.medium, fontSize: 21, lineHeight: 29, color: C.ink, marginTop: 4, letterSpacing: -0.2 }, autoDir(card.q)]}>{card.q}</Text>
                <View style={{ flex: 1 }} />
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Ionicons name="hand-left-outline" size={20} color={C.leaf} />
                  <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.leaf }}>{revealed ? 'Tap to see the answer again' : 'Tap card to reveal answer'}</Text>
                </View>
              </Animated.View>
              <Animated.View style={[cardStyle, back, { backgroundColor: color.feedback.correct.bg, borderColor: C.mintBorder }]}>
                <Text style={{ fontFamily: F.medium, fontSize: 13, color: color.feedback.correct.text }}>Answer</Text>
                <Text style={[{ fontFamily: F.medium, fontSize: 20, lineHeight: 28, color: C.ink, marginTop: 6 }, autoDir(card.a)]}>{card.a}</Text>
                <View style={{ flex: 1 }} />
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.leaf, textAlign: 'center' }}>Tap to see the question again</Text>
              </Animated.View>
            </Pressable>
            </Enter>

            {(revealed || !!card.mnemonic) && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                {revealed && (
                <Pressable
                  onPress={() => (tap('select'), setAsk(true))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={15} color={C.teal} />
                  <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.teal }}>Ask Coco</Text>
                </Pressable>
                )}
                <Squeeze
                  onPress={() => (tap('select'), setHook({ card, go: () => {} }))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.sun50, borderWidth: 1, borderColor: palette.sun200, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 }}>
                  <Ionicons name={card.mnemonic ? 'bulb' : 'bulb-outline'} size={15} color={palette.sun700} />
                  <Text style={{ fontFamily: F.medium, fontSize: 12, color: palette.sun800 }}>{card.mnemonic ? 'My memory hook' : 'Make a memory hook'}</Text>
                </Squeeze>
              </View>
            )}
            {/* the ratings show up once the answer has been seen */}
            {revealed && (
              <Enter key="rate" style={{ gap: 14 }}>
                <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.ink, textAlign: 'center' }}>Rate your answer</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                {RATINGS.map((x, k) => (
                  <Enter key={x.r} delay={k * 50} style={{ flex: 1 }}>
                  <Squeeze
                    onPress={() => rate(x.r)}
                    style={{ alignItems: 'center', gap: 2, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.lineStrong, borderBottomWidth: 4, borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 2 }}>
                    <Image source={x.icon} style={{ width: 30, height: 30, marginBottom: 2 }} contentFit="contain" />
                    <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: F.medium, fontSize: 12, color: C.ink }}>{x.label}</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: F.regular, fontSize: 11, color: C.muted }}>{x.sub}</Text>
                  </Squeeze>
                  </Enter>
                ))}
                </View>
              </Enter>
            )}
          </>
        )}
      </View>
      {toast && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: 70, backgroundColor: C.ink, borderRadius: radius.lg, padding: 12, ...shadow.float }}>
          <Text style={{ fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.white, textAlign: 'center' }}>{toast}</Text>
        </View>
      )}
      <HookSheet
        card={hook?.card}
        slipping={hook?.auto}
        onClose={() => {
          const go = hook?.go;
          setHook(undefined);
          go?.();
        }}
      />
      {card && <AskCard visible={ask} card={card} subjectId={card.subjectId} onClose={() => setAsk(false)} />}
    </SafeAreaView>
  );
}

// A small chat about the current flashcard (opened after the answer is revealed), in the same sheet as everywhere else.
function AskCard({ visible, card, subjectId, onClose }: { visible: boolean; card: { q: string; a: string }; subjectId: string; onClose: () => void }) {
  const [thread, setThread] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(card.q); // replies for a card you've moved past are dropped
  cardRef.current = card.q;
  const [forCard, setForCard] = useState(card.q);
  if (forCard !== card.q) {
    // a new card: a new chat
    setForCard(card.q);
    setThread([]);
    setBusy(false);
  }
  const send = async (t: string, voice?: boolean) => {
    if (busy) return;
    const next: ChatMsg[] = [...thread, { role: 'user', text: t, ...(voice ? { voice: true } : {}) }];
    setThread(next);
    setBusy(true);
    const at = card.q;
    try {
      const st = useApp.getState();
      const subject = st.subjects.find((x) => x.id === subjectId);
      const reply = await askAboutCard(
        {
          subject: subject?.name ?? 'General',
          chapter: '',
          interests: st.coco.memory ? st.profile.interests : [],
          style: { friendly: 'friendly coach', calm: 'calm tutor', direct: 'direct & focused', playful: 'playful buddy' }[st.coco.style],
          depth: st.coco.depth,
        },
        card,
        next,
      );
      if (cardRef.current === at) setThread([...next, { role: 'assistant', text: reply.trim() }]);
    } catch {
      if (cardRef.current === at) setThread([...next, { role: 'assistant', text: 'I lost the connection for a second. Try again?' }]);
    }
    if (cardRef.current === at) setBusy(false);
  };
  return (
    <CocoChatSheet
      open={visible}
      about={card.q}
      thread={thread}
      waiting={busy}
      starters={['Why is this the answer?', 'Give me an example']}
      onSend={send}
      onClose={onClose}
    />
  );
}

const cardStyle = {
  position: 'absolute',
  inset: 0,
  backgroundColor: C.white,
  borderRadius: radius.xl,
  borderWidth: 1.5,
  borderColor: C.lineStrong,
  borderBottomWidth: 4,
  padding: 20,
} as const;
