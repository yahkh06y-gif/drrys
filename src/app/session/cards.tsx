// Session step 5 — "Lock in what matters": flashcards scheduled with spaced repetition (SM-2).
// Also used standalone (mode=review) for cards that are due.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Enter, IconBtn, Pill, SessionHeader, T } from '@/components/ui';
import { askAboutCard, makeCards } from '@/lib/ai';
import { haptic, play, tap } from '@/lib/feedback';
import { sessionContext } from '@/lib/session';
import { isDue, useApp, type Rating } from '@/store';
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

  useEffect(() => {
    if (!loading || !session?.analysis) return;
    (async () => {
      try {
        // usually ready already (made with the analysis); otherwise ask Coco now
        const general = session.draftCards?.length ? session.draftCards : await makeCards(await sessionContext(false), session.analysis!);
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
    flip.value = withTiming(toBack ? 1 : 0, { duration: 380 });
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

  const rate = (r: Rating) => {
    if (!card) return;
    rateCard(card.id, r);
    play(r === 'forgot' ? 'wrong' : 'select');
    haptic(r === 'forgot' ? 'error' : 'light');
    if (i + 1 >= cards.length) return finish();
    flip.value = 0;
    setRevealed(false);
    setOnBack(false);
    setI(i + 1);
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
        <SessionHeader step={5} title="Active learning" />
      )}
      <View style={{ flex: 1, padding: 20, gap: 14 }}>
        <Enter>
          <Pill text={review ? 'SPACED REPETITION' : 'MADE FROM TODAY’S SESSION'} bg={C.sand} border={C.line} fg={C.goldInk} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
            <T v="h2">Lock in what matters</T>
            {!!cards.length && <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.muted }}>{i + 1} / {cards.length}</Text>}
          </View>
        </Enter>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <ActivityIndicator color={C.teal} />
            <Text style={{ fontFamily: F.medium, color: C.muted }}>Coco is writing your cards…</Text>
          </View>
        ) : !card ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.teal }}>No cards due — your memory is fresh 🌿</Text>
            <Pressable onPress={finish}>
              <Text style={{ fontFamily: F.bold, color: C.leaf }}>Continue</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable onPress={reveal} style={{ height: 300 }}>
              <Animated.View style={[cardStyle, front]}>
                <Pill text={card.reps ? 'REVIEW' : 'NEW'} bg="#FDE7C8" border={C.amber} fg="#8A4B0F" />
                <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.muted, marginTop: 14 }}>QUESTION</Text>
                <Text style={{ fontFamily: F.bold, fontSize: 21, lineHeight: 28, color: C.ink, marginTop: 4 }}>{card.q}</Text>
                <View style={{ flex: 1 }} />
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Ionicons name="hand-left-outline" size={20} color={C.leaf} />
                  <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.leaf }}>{revealed ? 'Tap to see the answer again' : 'Tap card to reveal answer'}</Text>
                  {!revealed && <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>Recall it first, then check.</Text>}
                </View>
              </Animated.View>
              <Animated.View style={[cardStyle, back, { backgroundColor: '#F0F8E6', borderColor: C.mintBorder }]}>
                <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.leaf }}>ANSWER</Text>
                <Text style={{ fontFamily: F.bold, fontSize: 20, lineHeight: 28, color: C.teal, marginTop: 6 }}>{card.a}</Text>
                <View style={{ flex: 1 }} />
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, textAlign: 'center' }}>How well did you remember?</Text>
                <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.leaf, textAlign: 'center', marginTop: 4 }}>Tap to see the question again</Text>
              </Animated.View>
            </Pressable>

            {revealed && (
              <Pressable
                onPress={() => (tap('select'), setAsk(true))}
                style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={15} color={C.teal} />
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.teal }}>Ask Coco about this card</Text>
              </Pressable>
            )}
            {/* the ratings show up once the answer has been seen */}
            {revealed && (
              <Enter key="rate" style={{ gap: 14 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.teal, textAlign: 'center' }}>Rate your answer</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                {RATINGS.map((x) => (
                  <Pressable
                    key={x.r}
                    onPress={() => rate(x.r)}
                    style={{ flex: 1, alignItems: 'center', gap: 2, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 4, borderRadius: 14, paddingVertical: 10 }}>
                    <Image source={x.icon} style={{ width: 30, height: 30, marginBottom: 2 }} contentFit="contain" />
                    <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.ink }}>{x.label}</Text>
                    <Text style={{ fontFamily: F.medium, fontSize: 9, color: C.muted }}>{x.sub}</Text>
                  </Pressable>
                ))}
                </View>
              </Enter>
            )}
          </>
        )}
      </View>
      {card && <AskCard visible={ask} card={card} subjectId={card.subjectId} onClose={() => setAsk(false)} />}
    </SafeAreaView>
  );
}

// A small chat about the current flashcard (opened after the answer is revealed).
function AskCard({ visible, card, subjectId, onClose }: { visible: boolean; card: { q: string; a: string }; subjectId: string; onClose: () => void }) {
  const [thread, setThread] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(card.q); // replies for a card you've moved past are dropped
  cardRef.current = card.q;
  useEffect(() => {
    setThread([]);
    setText('');
    setBusy(false);
  }, [card.q]);
  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    const next = [...thread, { role: 'user' as const, text: t }];
    setThread(next);
    setText('');
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
      if (cardRef.current === at) setThread([...next, { role: 'assistant', text: 'I lost the connection for a second — try again?' }]);
    }
    if (cardRef.current === at) setBusy(false);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,36,28,0.35)' }}>
        <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 10, maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.teal }}>Ask Coco</Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={22} color={C.muted} />
            </Pressable>
          </View>
          <View style={{ backgroundColor: '#F0F8E6', borderRadius: 14, borderWidth: 1, borderColor: C.mintBorder, padding: 12 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.ink }}>{card.q}</Text>
            <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.teal, marginTop: 4 }}>{card.a}</Text>
          </View>
          <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 8 }}>
            {!thread.length && <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>Why is this the answer? Want an example? Ask anything about this card.</Text>}
            {thread.map((m, k) => (
              <View key={k} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: m.role === 'user' ? C.teal : C.white, borderRadius: 16, borderWidth: m.role === 'user' ? 0 : 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: m.role === 'user' ? C.white : C.ink }}>{m.text}</Text>
              </View>
            ))}
            {busy && <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Coco is thinking…</Text>}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder="Ask about this card…"
              placeholderTextColor="#A69A8A"
              style={{ flex: 1, minHeight: 44, maxHeight: 110, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.medium, fontSize: 14, color: C.ink }}
            />
            <Pressable onPress={send} disabled={!text.trim() || busy} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() && !busy ? C.teal : C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-up" size={20} color={C.white} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const cardStyle = {
  position: 'absolute',
  inset: 0,
  backgroundColor: C.white,
  borderRadius: 24,
  borderWidth: 1.5,
  borderColor: C.lineStrong,
  borderBottomWidth: 5,
  padding: 20,
} as const;
