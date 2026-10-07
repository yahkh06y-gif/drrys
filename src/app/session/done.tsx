// "Coco is proud of today's work." — the reward moment: confetti, XP counting up, the streak, the branch
// visibly growing, then a reward chest the student opens for a bonus (the size is a surprise; a strong
// session gives better odds). Then back to the growing tree.
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Confetti } from '@/components/Confetti';
import { Motion } from '@/components/Motion';
import { Btn, Enter } from '@/components/ui';
import { useBack } from '@/lib/back';
import { haptic, play } from '@/lib/feedback';
import { completeReferral } from '@/lib/together';
import { streak, useApp } from '@/store';
import { C, F } from '@/theme';

// the chest: mostly small, sometimes big, rarely a jackpot. A session with 80%+ accuracy gets better odds.
function rollChest(accuracy: number): { xp: number; label: string } {
  const lucky = accuracy >= 80;
  const r = Math.random();
  if (r < (lucky ? 0.1 : 0.05)) return { xp: 50, label: 'JACKPOT!' };
  if (r < (lucky ? 0.4 : 0.3)) return { xp: 20, label: 'Big one!' };
  return { xp: 5 + Math.floor(Math.random() * 6), label: 'Nice!' };
}

/** 0 → target over `ms`, starting after `delay` (a light tick on the way). */
function useCountUp(target: number, delay: number, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) return setV(0);
    let raf = 0;
    let t0 = 0;
    let lastTick = 0;
    const start = setTimeout(() => {
      const step = (now: number) => {
        t0 ||= now;
        const p = Math.min(1, (now - t0) / ms);
        const val = Math.round(target * (1 - Math.pow(1 - p, 3)));
        setV(val);
        if (val >= lastTick + Math.max(1, Math.round(target / 6))) {
          lastTick = val;
          haptic('light');
        }
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => (clearTimeout(start), cancelAnimationFrame(raf));
  }, [target, delay, ms]);
  return v;
}

export default function Done() {
  const finishSession = useApp((s) => s.finishSession);
  const set = useApp((s) => s.set);
  const [r, setR] = useState({ xp: 0, minutes: 0, accuracy: 0 });
  const [days, setDays] = useState(0); // streak after today
  const [growth, setGrowth] = useState({ from: 0, to: 0 });
  const [burst, setBurst] = useState(1);
  const [chest, setChest] = useState<{ xp: number; label: string } | undefined>(() => {
    const c = useApp.getState().session?.chest;
    return c ? { xp: c, label: '' } : undefined;
  });
  const before = useRef<number | undefined>(undefined);

  const leave = useCallback(() => {
    set({ session: undefined });
    router.dismissTo('/(tabs)/tree');
    return true;
  }, [set]);
  useBack(leave); // Android back = return to the forest (never back into the finished session)

  useEffect(() => {
    const st = useApp.getState();
    const s = st.session;
    const chapterOf = (subs: typeof st.subjects) => subs.find((x) => x.id === s?.subjectId)?.chapters.find((c) => c.id === s?.chapterId)?.mastery ?? 0;
    before.current ??= chapterOf(st.subjects);
    const res = finishSession();
    setR(res);
    const now = useApp.getState();
    const sub = now.subjects.find((x) => x.id === s?.subjectId);
    setDays(streak(sub?.stats?.studyDays ?? now.stats.studyDays));
    setGrowth({ from: s?.result ? chapterOf(now.subjects) : before.current, to: chapterOf(now.subjects) });
    completeReferral(); // an invited student's first session unlocks their friend's reward
    haptic('success');
    play('celebrate');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishSession]);

  const xp = useCountUp(r.xp, 700);
  const bonus = useCountUp(chest?.xp ?? 0, 600, 900);

  // the branch bar fills from where it was to where it is now
  const bar = useSharedValue(0);
  useEffect(() => {
    bar.value = growth.from;
    bar.value = withDelay(1500, withTiming(growth.to, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [growth, bar]);
  const barStyle = useAnimatedStyle(() => ({ width: `${Math.max(2, bar.value * 100)}%` }));

  // chest: wobbles until opened, then pops
  const wob = useSharedValue(0);
  const pop = useSharedValue(1);
  useEffect(() => {
    wob.value = withRepeat(withSequence(withTiming(-1, { duration: 140 }), withTiming(1, { duration: 140 }), withTiming(0, { duration: 140 }), withDelay(1400, withTiming(0, { duration: 1 }))), -1);
  }, [wob]);
  const chestStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chest ? 0 : wob.value * 7}deg` }, { scale: pop.value }] }));
  const open = () => {
    if (chest) return;
    const res = rollChest(r.accuracy);
    setChest(res);
    const st = useApp.getState();
    st.bonusXp(st.session?.subjectId ?? '', res.xp);
    st.patchSession({ chest: res.xp });
    pop.value = withSequence(withTiming(1.35, { duration: 160 }), withSpring(1, { damping: 6 }));
    setBurst((b) => b + 1);
    play(res.xp >= 50 ? 'celebrate' : 'success');
    haptic('success');
  };

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <View style={{ flex: 1 }}>
      <Motion video="celebrate" loop={false} style={{ position: 'absolute', inset: 0 }} />
      <Confetti burst={burst} count={burst === 1 ? 28 : 40} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} showsVerticalScrollIndicator={false}>
          <Enter>
            <Text style={{ fontFamily: F.bold, fontSize: 38, lineHeight: 40, color: C.teal, textAlign: 'center' }}>Coco is proud of today’s work.</Text>
          </Enter>
          <View style={{ flex: 1, minHeight: 80 }} />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Enter delay={200} style={{ flex: 1 }}>
              <Box icon="⏱" value={`${r.minutes}`} unit="min" label="Time" />
            </Enter>
            <Enter delay={320} style={{ flex: 1 }}>
              <Box icon="🎯" value={`${r.accuracy}%`} label="Accuracy" />
            </Enter>
            <Enter delay={440} style={{ flex: 1 }}>
              <Box icon="✨" value={`+${xp}`} unit="XP" label="XP earned" gold />
            </Enter>
          </View>

          {/* streak + branch growth */}
          <Enter delay={900}>
            <View style={{ marginTop: 10, backgroundColor: 'rgba(239,231,214,0.95)', borderRadius: 18, borderBottomWidth: 4, borderColor: 'rgba(90,66,37,0.2)', padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.teal }}>🔥 {days}-day streak</Text>
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>
                  {days > 1 ? 'Keep it burning' : 'Day one — it starts here'}
                </Text>
              </View>
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.ink }}>🌱 Your branch grew</Text>
                  <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.leaf }}>
                    {pct(growth.from)} → {pct(growth.to)}
                  </Text>
                </View>
                <View style={{ height: 12, borderRadius: 6, backgroundColor: C.track, overflow: 'hidden' }}>
                  <Animated.View style={[{ height: 12, borderRadius: 6, backgroundColor: C.leaf }, barStyle]} />
                </View>
              </View>
            </View>
          </Enter>

          {/* reward chest */}
          <Enter delay={1500}>
            <Pressable onPress={open} disabled={!!chest} style={{ marginTop: 10, backgroundColor: chest ? '#FDE9C4' : 'rgba(255,246,227,0.97)', borderRadius: 18, borderWidth: 2, borderColor: C.amber, borderBottomWidth: 4, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Animated.Text style={[{ fontSize: 46 }, chestStyle]}>{chest ? '🎁' : '🎁'}</Animated.Text>
              <View style={{ flex: 1 }}>
                {chest ? (
                  <>
                    <Text style={{ fontFamily: F.bold, fontSize: 22, color: C.teal }}>+{bonus} bonus XP</Text>
                    {!!chest.label && <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.goldInk }}>{chest.label}</Text>}
                  </>
                ) : (
                  <>
                    <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.teal }}>Tap to open your reward</Text>
                    <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>
                      {r.accuracy >= 80 ? 'Great session — better odds for you.' : 'What’s inside today?'}
                    </Text>
                  </>
                )}
              </View>
            </Pressable>
          </Enter>

          <View style={{ height: 16 }} />
          <Btn title="Return to forest" kind="teal" sfx="grow" onPress={leave} />
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 8 }}>🌱 Your branch just grew. Progress saved.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Box({ icon, value, unit, label, gold }: { icon: string; value: string; unit?: string; label: string; gold?: boolean }) {
  return (
    <View style={{ backgroundColor: gold ? '#FDE9C4' : 'rgba(239,231,214,0.95)', borderRadius: 18, borderBottomWidth: 4, borderColor: 'rgba(90,66,37,0.2)', padding: 12, alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={{ fontFamily: F.bold, fontSize: 20, color: C.teal }}>
        {value}
        {unit ? <Text style={{ fontSize: 11 }}> {unit}</Text> : null}
      </Text>
      <Text style={{ fontFamily: F.medium, fontSize: 10, color: C.muted, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}
