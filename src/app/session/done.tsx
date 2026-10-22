// The finish page: "Coco is proud of today's work" with confetti and the numbers (time, accuracy, XP).
// One tap on "Return to forest" and the student is back at the growing tree.
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import { Motion } from '@/components/Motion';
import { Btn, Enter, XpStars } from '@/components/ui';
import { useBack } from '@/lib/back';
import { haptic, play } from '@/lib/feedback';
import { cloudEnabled } from '@/lib/cloud';
import { completeReferral } from '@/lib/together';
import { useApp } from '@/store';
import { C, F } from '@/theme';

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
  const { height } = useWindowDimensions();
  const [r, setR] = useState({ xp: 0, minutes: 0, accuracy: 0 });
  const done = useRef(false);

  const leave = useCallback(() => {
    const st = useApp.getState();
    set({ session: undefined });
    // after the very first session (value given, now ask): "Save your tree" with an account, once
    if (cloudEnabled && !st.profile.uid && !st.savePrompted) {
      set({ savePrompted: true });
      router.replace({ pathname: '/account', params: { save: '1' } });
    } else router.dismissTo('/(tabs)/tree');
    return true;
  }, [set]);
  useBack(leave); // Android back = return to the forest (never back into the finished session)

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    setR(finishSession());
    completeReferral(); // an invited student's first session unlocks their friend's reward
    haptic('success');
    play('celebrate');
  }, [finishSession]);

  const xp = useCountUp(r.xp, 700);

  return (
    <View style={{ flex: 1 }}>
      <Motion video="celebrate" loop={false} style={{ position: 'absolute', inset: 0 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ flex: 1 }}>
            <Enter>
              <Text style={{ fontFamily: F.bold, fontSize: 38, lineHeight: 40, color: C.teal, textAlign: 'center' }}>Coco is proud of today’s work.</Text>
            </Enter>
            {/* the middle is left free so Coco stays in view */}
            <View style={{ flex: 1, minHeight: Math.max(120, height * 0.32) }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Enter delay={200} style={{ flex: 1 }}>
                <Box icon="time-outline" value={`${r.minutes}`} unit="min" label="Time" />
              </Enter>
              <Enter delay={320} style={{ flex: 1 }}>
                <Box icon="locate-outline" value={`${r.accuracy}%`} label="Accuracy" />
              </Enter>
              <Enter delay={440} style={{ flex: 1 }}>
                <Box stars value={`+${xp}`} unit="XP" label="XP earned" gold />
              </Enter>
            </View>
            <View style={{ height: 14 }} />
            <Btn title="Return to forest" icon="arrow-forward" kind="teal" sfx="grow" onPress={leave} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Box({ icon, stars, value, unit, label, gold }: { icon?: keyof typeof Ionicons.glyphMap; stars?: boolean; value: string; unit?: string; label: string; gold?: boolean }) {
  return (
    <View style={{ backgroundColor: gold ? '#FDE9C4' : 'rgba(239,231,214,0.95)', borderRadius: 18, borderBottomWidth: 4, borderColor: 'rgba(90,66,37,0.2)', padding: 10, alignItems: 'center', gap: 2 }}>
      {stars ? <XpStars size={20} /> : icon ? <Ionicons name={icon} size={18} color={gold ? C.orange : C.teal} /> : null}
      <Text style={{ fontFamily: F.bold, fontSize: 20, color: C.teal }}>
        {value}
        {unit ? <Text style={{ fontSize: 11 }}> {unit}</Text> : null}
      </Text>
      <Text style={{ fontFamily: F.medium, fontSize: 10, color: C.muted, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}
