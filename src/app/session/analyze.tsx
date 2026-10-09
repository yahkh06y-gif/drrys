// Session step 3 — Coco analyzes the recall against the lecture (Claude reads the PDF).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Btn, Coco, Enter, SessionHeader, T } from '@/components/ui';
import { prepareSession } from '@/lib/ai';
import { haptic, play } from '@/lib/feedback';
import { sessionContext } from '@/lib/session';
import { useApp } from '@/store';
import { C, F } from '@/theme';

export default function Analyze() {
  const s = useApp((x) => x.session);
  const patchSession = useApp((x) => x.patchSession);
  const [done, setDone] = useState(0);
  const [err, setErr] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  const pages = s?.materialId ? `pages ${s.fromPage}–${s.toPage}` : 'the topic';
  const steps = [
    'Reading your recall',
    s?.materialId ? `Opening your lecture (${pages})` : 'Recalling the key ideas of the topic',
    `Comparing your recall with ${pages}`,
    'Finding what you nailed',
    'Spotting gaps and mix-ups',
    'Writing your questions',
    'Making your flashcards',
  ];

  useEffect(() => {
    let alive = true;
    setErr(undefined);
    setDone(0);
    // one request does all of this, so the checklist moves on a timer that slows down as it goes
    // (quick at first, then patient), and waits on the last step until the answer is in
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    [2500, 3500, 5000, 7000, 9000, 12000].forEach((gap) => {
      at += gap;
      timers.push(setTimeout(() => alive && setDone((d) => Math.min(d + 1, steps.length - 1)), at));
    });
    const tick = { stop: () => timers.forEach(clearTimeout) };
    (async () => {
      try {
        setTimeout(() => alive && setDone((d) => Math.max(d, 1)), 700);
        const ctx = await sessionContext();
        if (!alive) return;
        setDone((d) => Math.max(d, 2));
        const { analysis, questions, cards } = await prepareSession(ctx, useApp.getState().session!.recall);
        if (!alive) return;
        tick.stop();
        setDone(steps.length);
        // a fresh set of questions: forget any answers / cards from an earlier attempt
        patchSession({ analysis, questions, draftCards: cards, answers: [], correct: 0, newCardIds: [] });
        play('success');
        haptic('success');
        timers.push(setTimeout(() => alive && router.replace('/session/review'), 450));
      } catch (e) {
        tick.stop();
        if (alive) setErr(String((e as Error).message ?? e));
      }
    })();
    return () => {
      alive = false;
      tick.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, patchSession]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <SessionHeader step={3} title="Analyze" />
      <View style={{ flex: 1, padding: 20 }}>
        <Enter>
          <T v="h2" style={{ textAlign: 'center' }}>
            Coco’s analyzing your recall.
          </T>
          <T style={{ textAlign: 'center' }}>This usually takes less than a minute.</T>
        </Enter>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Coco src={COCO.reading} size={190} />
        </View>
        <View style={{ backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.lineStrong, padding: 12, gap: 0 }}>
          {steps.map((label, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              {i < done ? (
                <Ionicons name="checkmark-circle" size={20} color={C.teal} />
              ) : i === done ? (
                <Text style={{ fontFamily: F.bold, color: C.leaf, width: 20, textAlign: 'center' }}>•••</Text>
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={C.lineStrong} />
              )}
              <Text style={{ fontFamily: F.bold, fontSize: 14, color: i <= done ? C.teal : C.muted }}>{label}</Text>
            </View>
          ))}
        </View>
        {err ? (
          <View style={{ marginTop: 14, gap: 8 }}>
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.red, textAlign: 'center' }}>{err.startsWith('File problem') ? err.slice(0, 240) : `Coco couldn’t reach the cloud: ${err.slice(0, 120)}`}</Text>
            <Btn title="Try again" kind="teal" pill onPress={() => setAttempt((a) => a + 1)} />
          </View>
        ) : (
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 14 }}>✓ Your notes and recall are safely stored.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
