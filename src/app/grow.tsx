// After a subject is saved: the seed closes, Coco plants it and the tree grows (10.7s video, tap to skip).
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Motion } from '@/components/Motion';
import { useBack } from '@/lib/back';
import { haptic } from '@/lib/feedback';
import { F } from '@/theme';

export default function Grow() {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const done = useRef(false);

  const go = useCallback(() => {
    if (done.current) return;
    done.current = true;
    if (onboarding) router.replace('/onboarding/plan');
    else router.dismissTo('/(tabs)/tree');
  }, [onboarding]);

  // the tree is already saved: back would return to the form and plant it twice, so back = skip
  useBack(
    useCallback(() => {
      go();
      return true;
    }, [go]),
  );

  useEffect(() => {
    // the clip has its own sound design; haptics are timed to its key moments
    const cues = [
      setTimeout(() => haptic('light'), 400), // hands close the seed
      setTimeout(() => haptic('medium'), 5200), // Coco plants it
      setTimeout(() => haptic('success'), 7000), // the tree shoots up
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
