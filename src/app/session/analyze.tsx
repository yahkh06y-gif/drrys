// Session step 3 — Coco analyzes the recall against the lecture (Claude reads the PDF).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Btn, Coco, Enter, SessionHeader, T } from '@/components/ui';
import { analyse } from '@/lib/prep';
import { haptic, play } from '@/lib/feedback';
import { color } from '@/design/tokens';
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
    // (quick at first, then patient), and waits on the last step until the answer is in. The questions and the
    // flashcards are written afterwards, in the background, while the student reads the analysis (lib/prep).
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    [2500, 3500, 5000, 7000].forEach((gap) => {
      at += gap;
      timers.push(setTimeout(() => alive && setDone((d) => Math.min(d + 1, steps.length - 1)), at));
    });
    const tick = { stop: () => timers.forEach(clearTimeout) };
    (async () => {
      try {
        setTimeout(() => alive && setDone((d) => Math.max(d, 1)), 700);
        const st1 = useApp.getState().session!;
        await analyse(`${st1.recall}|${st1.materialId ?? ''}|${st1.fromPage}-${st1.toPage}`);
        if (!alive) return;
        tick.stop();
        setDone(steps.length);
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

  const fileErr = !!err?.startsWith('File problem');
  const reason = (fileErr ? /\(([^)]*)\)/.exec(err ?? '')?.[1] : err) ?? '';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <SessionHeader step={3} title="Analyze" onBack={() => (router.canGoBack() ? router.back() : router.replace('/session/recall'))} />
      <View style={{ flex: 1, padding: 20 }}>
        <Enter>
          <T v="h2" style={{ textAlign: 'center' }}>
            Coco’s analyzing your recall.
          </T>
          <T style={{ textAlign: 'center' }}>Usually under a minute.</T>
        </Enter>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Coco src={COCO.reading} size={190} />
        </View>
        <View style={{ backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 12, gap: 0 }}>
          {steps.map((label, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              {i < done ? (
                <Ionicons name="checkmark-circle" size={20} color={C.leaf} />
              ) : i === done && err ? (
                <Ionicons name="alert-circle" size={20} color={color.feedback.wrong.icon} />
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
          <Enter style={{ marginTop: 14, gap: 10 }}>
            {/* short and plain; the technical reason stays in small print for when something needs fixing */}
            <View style={{ backgroundColor: color.feedback.wrong.bg, borderRadius: 16, padding: 14, gap: 4 }}>
              <T v="subhead" style={{ color: color.feedback.wrong.text }}>
                {fileErr ? 'Coco couldn’t open your lecture file' : 'Coco couldn’t connect'}
              </T>
              <T v="caption">{fileErr ? 'Add the file again, then continue. Your recall is saved.' : 'Check your internet and try again. Your recall is saved.'}</T>
              <T v="caption" numberOfLines={2} style={{ color: C.mutedLight }}>
                {reason}
              </T>
            </View>
            {fileErr ? (
              <>
                <Btn title="Choose the file again" iconLeft="document-attach-outline" kind="green" onPress={() => router.dismissTo('/session/choose')} />
                <Btn title="Try again" kind="light" height={46} onPress={() => setAttempt((a) => a + 1)} />
              </>
            ) : (
              <Btn title="Try again" kind="green" onPress={() => setAttempt((a) => a + 1)} />
            )}
          </Enter>
        ) : (
          <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 14 }}>Your recall is saved.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
