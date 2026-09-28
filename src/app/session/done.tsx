// "Coco is proud of today's work." — Coco celebrates (video), rewards, then back to the growing tree.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Motion } from '@/components/Motion';
import { Btn, Enter } from '@/components/ui';
import { haptic, play } from '@/lib/feedback';
import { useApp } from '@/store';
import { C, F } from '@/theme';

export default function Done() {
  const finishSession = useApp((s) => s.finishSession);
  const set = useApp((s) => s.set);
  const [r, setR] = useState({ xp: 0, minutes: 0, accuracy: 0 });

  useEffect(() => {
    setR(finishSession());
    play('celebrate');
    haptic('success');
  }, [finishSession]);

  return (
    <View style={{ flex: 1 }}>
      <Motion video="celebrate" style={{ position: 'absolute', inset: 0 }} />
      <SafeAreaView style={{ flex: 1, padding: 24 }}>
        <Enter>
          <Text style={{ fontFamily: F.bold, fontSize: 40, lineHeight: 42, color: C.teal, textAlign: 'center' }}>Coco is proud of today’s work.</Text>
        </Enter>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatBox icon="⏱" value={`${r.minutes}`} unit="min" label="Time" delay={200} />
          <StatBox icon="🎯" value={`${r.accuracy}%`} label="Today’s accuracy" delay={320} />
          <StatBox icon="✨" value={`+${r.xp}`} unit="XP" label="XP earned" delay={440} gold />
        </View>
        <View style={{ height: 20 }} />
        <Btn
          title="Return to forest"
          kind="teal"
          sfx="grow"
          onPress={() => {
            set({ session: undefined });
            router.dismissTo('/(tabs)/tree');
          }}
        />
        <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 8 }}>🌱 Your branch just grew. Progress saved.</Text>
      </SafeAreaView>
    </View>
  );
}

function StatBox({ icon, value, unit, label, delay, gold }: { icon: string; value: string; unit?: string; label: string; delay: number; gold?: boolean }) {
  return (
    <Enter delay={delay} style={{ flex: 1 }}>
      <View style={{ backgroundColor: gold ? '#FDE9C4' : 'rgba(239,231,214,0.95)', borderRadius: 18, borderBottomWidth: 4, borderColor: 'rgba(90,66,37,0.2)', padding: 12, alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 20, color: C.teal }}>
          {value}
          {unit ? <Text style={{ fontSize: 11 }}> {unit}</Text> : null}
        </Text>
        <Text style={{ fontFamily: F.medium, fontSize: 10, color: C.muted, textAlign: 'center' }}>{label}</Text>
      </View>
    </Enter>
  );
}
