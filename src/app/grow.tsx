// After a subject is saved: the seed closes, Coco plants it and the tree grows (18s video, tap to skip).
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Motion } from '@/components/Motion';
import { haptic, play } from '@/lib/feedback';
import { F } from '@/theme';

export default function Grow() {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const done = useRef(false);

  const go = useCallback(() => {
    if (done.current) return;
    done.current = true;
    if (onboarding) router.replace('/onboarding/signin');
    else router.dismissTo('/(tabs)/tree');
  }, [onboarding]);

  useEffect(() => {
    // sound cues timed to the render: seed closes, lands in the soil, tree bursts out
    const cues = [
      setTimeout(() => play('flip'), 3000),
      setTimeout(() => (play('tap'), haptic('medium')), 8200),
      setTimeout(() => (play('grow'), haptic('success')), 11600),
      setTimeout(() => play('celebrate'), 13400),
    ];
    return () => cues.forEach(clearTimeout);
  }, []);

  return (
    <Pressable style={{ flex: 1 }} onPress={go}>
      <Motion video="seedClose" loop={false} onEnd={go} style={{ flex: 1 }} />
      <SafeAreaView pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 16 }}>
        <View style={{ backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 12, color: '#fff' }}>Tap to skip</Text>
        </View>
      </SafeAreaView>
    </Pressable>
  );
}
