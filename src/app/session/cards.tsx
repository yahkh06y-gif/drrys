// Session step 5 — "Lock in what matters": flashcards scheduled with spaced repetition (SM-2).
// Also used standalone (mode=review) for cards that are due.
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Enter, IconBtn, Pill, SessionHeader, T } from '@/components/ui';
import { makeCards } from '@/lib/ai';
import { haptic, play } from '@/lib/feedback';
import { sessionContext } from '@/lib/session';
import { today, useApp, type Rating } from '@/store';
import { C, F } from '@/theme';

const RATINGS: { r: Rating; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { r: 'forgot', label: 'Forgot', sub: 'Again soon', icon: 'refresh', color: '#E56B6B' },
  { r: 'hard', label: 'Hard', sub: 'With effort', icon: 'barbell-outline', color: C.orange },
  { r: 'good', label: 'Good', sub: 'Correct', icon: 'thumbs-up-outline', color: C.leaf },
  { r: 'easy', label: 'Easy', sub: 'Instant', icon: 'flash-outline', color: C.teal },
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
    review ? allCards.filter((c) => (!activeId || c.subjectId === activeId) && c.due <= Date.now()).map((c) => c.id) : (session?.newCardIds ?? []),
  );
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(!review && !(session?.newCardIds.length));
  const flip = useSharedValue(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!loading || !session?.analysis) return;
    (async () => {
      try {
        const made = await makeCards(await sessionContext(false), session.analysis!);
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

  const reveal = () => {
    if (revealed) return;
    play('flip');
    haptic('light');
    flip.value = withTiming(1, { duration: 380 });
    setRevealed(true);
  };

  const finish = () => {
    if (review) {
      const st = useApp.getState().stats;
      useApp.getState().set({ stats: { ...st, xp: st.xp + ids.length * 2, studyDays: st.studyDays.includes(today()) ? st.studyDays : [...st.studyDays, today()] } });
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
                  <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.leaf }}>Tap card to reveal answer</Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>Recall it first, then check.</Text>
                </View>
              </Animated.View>
              <Animated.View style={[cardStyle, back, { backgroundColor: '#F0F8E6', borderColor: C.mintBorder }]}>
                <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.leaf }}>ANSWER</Text>
                <Text style={{ fontFamily: F.bold, fontSize: 20, lineHeight: 28, color: C.teal, marginTop: 6 }}>{card.a}</Text>
                <View style={{ flex: 1 }} />
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, textAlign: 'center' }}>How well did you remember?</Text>
              </Animated.View>
            </Pressable>

            <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.teal, textAlign: 'center' }}>Rate your answer</Text>
            <View style={{ flexDirection: 'row', gap: 8, opacity: revealed ? 1 : 0.35 }}>
              {RATINGS.map((x) => (
                <Pressable
                  key={x.r}
                  disabled={!revealed}
                  onPress={() => rate(x.r)}
                  style={{ flex: 1, alignItems: 'center', gap: 2, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 4, borderRadius: 14, paddingVertical: 10 }}>
                  <Ionicons name={x.icon} size={18} color={x.color} />
                  <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.ink }}>{x.label}</Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 9, color: C.muted }}>{x.sub}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted, textAlign: 'center' }}>Ratings unlock after you reveal the answer.</Text>
          </>
        )}
      </View>
    </SafeAreaView>
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
