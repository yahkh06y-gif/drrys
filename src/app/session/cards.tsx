// Session step 5 — "Lock in what matters": flashcards scheduled with spaced repetition (SM-2).
// Also used standalone (mode=review) for cards that are due.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SketchPad, type SketchHandle } from '@/components/SketchPad';
import { Enter, IconBtn, Pill, SessionHeader, T } from '@/components/ui';
import { askAboutCard, describeSketch, levelUp, makeCards, suggestHooks } from '@/lib/ai';
import { saveSketch } from '@/lib/sketch';
import { haptic, play, tap } from '@/lib/feedback';
import { cardContext, sessionContext } from '@/lib/session';
import { isDue, useApp, type Card, type Rating } from '@/store';
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
  const [hook, setHook] = useState<{ card: Card; go: () => void }>();
  const [hookShown, setHookShown] = useState(false); // the card's saved hook is showing as a hint
  const [toast, setToast] = useState<string>();

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

  // 3 right in a row: the card graduates — a harder, apply-it question is added for a few days later
  const graduate = async (c: Card) => {
    try {
      const harder = await levelUp(cardContext(c.subjectId), c);
      const st = useApp.getState();
      const [id] = st.addCards([{ q: harder.q, a: harder.a, subjectId: c.subjectId, chapterId: c.chapterId, level: 2 }]);
      st.patchCard(id, { due: Date.now() + 3 * 86_400_000 });
      st.patchCard(c.id, { leveled: true });
      play('success');
      setToast('Level up! You’ve mastered that card, so Coco added a harder question on it.');
      setTimeout(() => setToast(undefined), 4000);
    } catch {
      // no connection: it will graduate the next time it is answered right
    }
  };

  const rate = (r: Rating) => {
    if (!card) return;
    const res = rateCard(card.id, r);
    play(r === 'forgot' ? 'wrong' : 'select');
    haptic(r === 'forgot' ? 'error' : 'light');
    const advance = () => {
      if (i + 1 >= cards.length) return finish();
      flip.value = 0;
      setRevealed(false);
      setOnBack(false);
      setHookShown(false);
      setI(i + 1);
    };
    if (res && res.wrong >= 3 && res.wrong % 3 === 0 && !card.mnemonic) return setHook({ card, go: advance });
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
        <SessionHeader step={6} title="Lock it in" />
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
                {!!card.mnemonic && (
                  <Pressable
                    onPress={() => (tap('select'), setHookShown((v) => !v))}
                    style={{ marginTop: 14, alignSelf: 'flex-start', backgroundColor: '#FFF6E3', borderWidth: 1, borderColor: C.amber, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 12, lineHeight: 18, color: C.goldInk }}>
                      {hookShown ? `💡 ${card.mnemonic}` : '💡 Show my memory hook'}
                    </Text>
                    {hookShown && !!card.mnemonicImg && <Image source={{ uri: card.mnemonicImg }} style={{ width: 160, height: 100, marginTop: 6, borderRadius: 8, backgroundColor: C.white }} contentFit="contain" />}
                  </Pressable>
                )}
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
      {toast && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: 70, backgroundColor: C.teal, borderRadius: 16, padding: 12 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 13, lineHeight: 19, color: C.white, textAlign: 'center' }}>⬆️ {toast}</Text>
        </View>
      )}
      <HookSheet
        card={hook?.card}
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

// "Stuck on this one?" — the student makes a memory hook (their own, or one of Coco's ideas to start from).
// A saved hook comes back as a hint on the card, and is listed when the student holds that chapter's branch.
function HookSheet({ card, onClose }: { card?: Card; onClose: () => void }) {
  const [text, setText] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [draw, setDraw] = useState(false); // the drawing pad is open
  const [ink, setInk] = useState(false); // something is drawn
  const [drawing, setDrawing] = useState(false); // a stroke is in progress (the sheet must not scroll)
  const [look, setLook] = useState<{ saw: string; caption: string }>();
  const [looking, setLooking] = useState(false);
  const pad = useRef<SketchHandle>(null);
  const tried = text.trim().split(/\s+/).filter(Boolean).length >= 3; // your own first try comes before Coco's ideas
  useEffect(() => {
    setText('');
    setIdeas([]);
    setBusy(false);
    setDraw(false);
    setInk(false);
    setLook(undefined);
  }, [card?.id]);
  if (!card) return null;
  const getIdeas = async () => {
    setBusy(true);
    try {
      setIdeas(await suggestHooks(cardContext(card.subjectId), card));
    } catch {
      setIdeas([]);
    }
    setBusy(false);
  };
  const askLook = async () => {
    setLooking(true);
    try {
      const img = await pad.current?.capture();
      setLook(img ? await describeSketch(cardContext(card.subjectId), card, img) : { saw: 'I couldn’t read the drawing this time, but you can still save it.', caption: '' });
    } catch {
      setLook({ saw: 'I couldn’t look just now — you can still save your drawing.', caption: '' });
    }
    setLooking(false);
  };
  const plant = async () => {
    if (!text.trim() && !ink) return;
    setBusy(true);
    const img = ink ? await pad.current?.capture() : undefined;
    const uri = img ? await saveSketch(card.id, img) : undefined;
    useApp.getState().saveHook(card.id, text.trim() || look?.caption || 'My drawing', uri);
    setBusy(false);
    play('grow');
    haptic('success');
    onClose();
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,36,28,0.35)' }}>
        <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 10, maxHeight: '90%' }}>
          <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled" scrollEnabled={!drawing}>
            <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.teal }}>This one keeps slipping 💡</Text>
            <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.body }}>
              Make a memory hook for it: a picture, a rhyme, a silly sentence. It’s saved with this branch and comes back as a hint on this card.
            </Text>
            <View style={{ backgroundColor: '#F0F8E6', borderRadius: 14, borderWidth: 1, borderColor: C.mintBorder, padding: 12 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.ink }}>{card.q}</Text>
              <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.teal, marginTop: 4 }}>{card.a}</Text>
            </View>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder="My hook is…"
              placeholderTextColor="#A69A8A"
              style={{ minHeight: 70, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.medium, fontSize: 15, color: C.ink, textAlignVertical: 'top' }}
            />
            <Pressable onPress={() => (tap('select'), setDraw((v) => !v))} style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: draw ? C.teal : C.sand, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 }}>
              <Ionicons name="brush-outline" size={14} color={draw ? C.white : C.body} />
              <Text style={{ fontFamily: F.bold, fontSize: 12, color: draw ? C.white : C.body }}>{draw ? 'Hide the drawing pad' : 'Draw it instead (or as well)'}</Text>
            </Pressable>
            {draw && (
              <View style={{ gap: 8 }}>
                <SketchPad ref={pad} height={220} onInk={setInk} onDrawing={setDrawing} />
                <Pressable
                  onPress={askLook}
                  disabled={!ink || looking}
                  style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: C.sand, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, opacity: ink ? 1 : 0.6 }}>
                  {looking ? <ActivityIndicator size="small" color={C.teal} /> : <Ionicons name="eye-outline" size={14} color={C.body} />}
                  <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.body }}>Ask Coco what she sees</Text>
                </Pressable>
                {look && (
                  <View style={{ backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 10, gap: 6 }}>
                    <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.ink }}>{look.saw}</Text>
                    {!!look.caption && (
                      <Pressable onPress={() => (tap('select'), setText((t) => t || look.caption))}>
                        <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.leaf }}>Use as caption: “{look.caption}”</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            )}
            {ideas.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.muted }}>COCO’S IDEAS — TAP ONE, THEN MAKE IT YOURS</Text>
                {ideas.map((h, k) => (
                  <Pressable key={k} onPress={() => (tap('select'), setText(h))} style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10 }}>
                    <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.ink }}>{h}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {!ideas.length && (
              <Pressable onPress={getIdeas} disabled={busy || !tried} style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: C.sand, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, opacity: tried ? 1 : 0.6 }}>
                {busy ? <ActivityIndicator size="small" color={C.teal} /> : <Ionicons name="bulb-outline" size={14} color={C.body} />}
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.body }}>{tried ? 'Give me ideas' : 'Try one yourself first, then Coco can add ideas'}</Text>
              </Pressable>
            )}
          </ScrollView>
          <Pressable
            onPress={plant}
            disabled={(!text.trim() && !ink) || busy}
            style={{ height: 52, borderRadius: 26, backgroundColor: text.trim() || ink ? C.teal : C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.white }}>Save my hook</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={10} style={{ alignSelf: 'center' }}>
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Not now</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
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
