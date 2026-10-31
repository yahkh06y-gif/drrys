// Session step 3 — Coco analyzes the recall against the lecture (Claude reads the PDF).
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Btn, Coco, Enter, SessionHeader, T } from '@/components/ui';
import { analyse, analysisKey } from '@/lib/prep';
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
  const [clock, setClock] = useState({ step: -1, secs: 0 }); // time on the current step

  const pages = s?.materialId ? `pages ${s.fromPage}–${s.toPage}` : 'the topic';
  // the real parts of the work, in order: each one is ticked when it is actually done
  const steps = [
    'Reading your recall',
    s?.materialId ? `Opening your lecture (${pages})` : 'Getting the topic ready',
    `Comparing your recall with ${pages}: what you nailed, missed and mixed up`,
  ];
  const working = !err && done < steps.length;
  useEffect(() => {
    if (!working) return;
    const t0 = Date.now();
    const t = setInterval(() => setClock({ step: done, secs: Math.floor((Date.now() - t0) / 1000) }), 1000);
    return () => clearInterval(t);
  }, [done, working]);
  const secs = clock.step === done ? clock.secs : 0;

  useEffect(() => {
    let alive = true;
    // came back to this step without changing anything: the analysis is already made, so show it
    const st0 = useApp.getState().session;
    const key0 = st0 ? analysisKey(st0) : '';
    if (attempt === 0 && st0?.analysis && st0.analyzedFor === key0) {
      router.replace('/session/review');
      return () => {
        alive = false;
      };
    }
    setErr(undefined);
    setDone(1); // the recall is already here
    // each step is ticked when that part of the work is really done (lib/prep tells us). The questions and the
    // flashcards are written afterwards, in the background, while the student reads the analysis (lib/prep).
    const timers: ReturnType<typeof setTimeout>[] = [];
    const tick = { stop: () => timers.forEach(clearTimeout) };
    (async () => {
      try {
        await analyse(analysisKey(useApp.getState().session!), (step) => alive && setDone(step + 1));
        if (!alive) return;
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
          <T style={{ textAlign: 'center' }}>Longer lectures take a little longer.</T>
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
              <Text style={{ flex: 1, fontFamily: i === done ? F.medium : F.regular, fontSize: 15, color: i <= done ? C.ink : C.muted }}>{label}</Text>
              {i === done && working && secs >= 3 && <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, fontVariant: ['tabular-nums'] }}>{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</Text>}
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
          <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 14 }}>
            {working && done === steps.length - 1 && secs >= 45 ? 'Coco is still reading carefully. Your recall is saved.' : 'Your recall is saved.'}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
