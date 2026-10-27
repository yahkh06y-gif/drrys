// Session step 3 — Coco analyzes the recall against the lecture (Claude reads the PDF).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
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
    // came back to this step without changing anything: the analysis is already made, so show it
    const st0 = useApp.getState().session;
    const key0 = st0 ? `${st0.recall}|${st0.materialId ?? ''}|${st0.fromPage}-${st0.toPage}` : '';
    if (attempt === 0 && st0?.analysis && st0.analyzedFor === key0) {
      router.replace('/session/review');
      return () => {
        alive = false;
      };
    }
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
        const st1 = useApp.getState().session!;
        patchSession({ analysis, analyzedFor: `${st1.recall}|${st1.materialId ?? ''}|${st1.fromPage}-${st1.toPage}`, questions, draftCards: cards, answers: [], correct: 0, newCardIds: [], gapCards: [], results: [], qIndex: 0 });
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
      <SessionHeader step={3} title="Analyze" onBack={() => (router.canGoBack() ? router.back() : router.replace('/session/recall'))} />
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
        <View style={{ backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 12, gap: 0 }}>
          {steps.map((label, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              {i < done ? (
                <Ionicons name="checkmark-circle" size={20} color={C.leaf} />
              ) : i === done ? (
                <ActivityIndicator size="small" color={C.leaf} style={{ width: 20 }} />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={C.mutedLight} />
              )}
              <Text style={{ fontFamily: i === done ? F.medium : F.regular, fontSize: 15, color: i <= done ? C.ink : C.muted }}>{label}</Text>
            </View>
          ))}
        </View>
        {err ? (
          <View style={{ marginTop: 14, gap: 8 }}>
            <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.orange, textAlign: 'center' }}>{err.startsWith('File problem') ? err.slice(0, 240) : `Coco couldn’t reach the cloud: ${err.slice(0, 120)}`}</Text>
            <Btn title="Try again" kind="green" onPress={() => setAttempt((a) => a + 1)} />
          </View>
        ) : (
          <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 14 }}>Your notes and recall are safely stored.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
