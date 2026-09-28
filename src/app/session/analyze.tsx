// Session step 3 — Coco analyzes the recall against the lecture (Claude reads the PDF).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Btn, Coco, Enter, SessionHeader, T } from '@/components/ui';
import { analyzeRecall, makeQuestions } from '@/lib/ai';
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

  const steps = ['Reading your recall', s?.materialId ? `Comparing it with pages ${s.fromPage}–${s.toPage}` : 'Comparing it with the topic', 'Finding strengths and gaps'];

  useEffect(() => {
    let alive = true;
    setErr(undefined);
    setDone(0);
    (async () => {
      try {
        const t = setTimeout(() => alive && setDone(1), 700);
        const ctx = await sessionContext();
        if (!alive) return;
        setDone(2);
        const analysis = await analyzeRecall(ctx, useApp.getState().session!.recall);
        if (!alive) return;
        setDone(3);
        const questions = await makeQuestions(ctx, analysis);
        clearTimeout(t);
        if (!alive) return;
        patchSession({ analysis, questions });
        play('success');
        haptic('success');
        router.replace('/session/review');
      } catch (e) {
        if (alive) setErr(String((e as Error).message ?? e));
      }
    })();
    return () => {
      alive = false;
    };
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
          <Coco src={COCO.reading} size={250} />
        </View>
        <View style={{ backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.lineStrong, padding: 12, gap: 4 }}>
          {steps.map((label, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
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
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.red, textAlign: 'center' }}>Coco couldn’t reach the cloud: {err.slice(0, 120)}</Text>
            <Btn title="Try again" kind="teal" pill onPress={() => setAttempt((a) => a + 1)} />
          </View>
        ) : (
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 14 }}>✓ Your notes and recall are safely stored.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
