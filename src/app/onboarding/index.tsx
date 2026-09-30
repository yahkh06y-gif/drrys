// Splash — Coco peeks over the hill ("Drrys · Grow what you know"), then the teal hill rises (Blender video).
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Motion } from '@/components/Motion';
import { play } from '@/lib/feedback';
import { C, F } from '@/theme';

export default function Splash() {
  const { height } = useWindowDimensions();
  const [rolling, setRolling] = useState(false);
  const title = useSharedValue(0);

  const left = useRef(false);
  const next = useCallback(() => {
    if (left.current) return;
    left.current = true;
    router.replace('/onboarding/intro');
  }, []);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    title.value = withDelay(250, withTiming(1, { duration: 700 }));
    const t = setTimeout(() => {
      title.value = withTiming(0, { duration: 250 });
      setRolling(true);
      play('grow');
    }, 2200);
    return () => clearTimeout(t);
  }, [title]);

  const titleA = useAnimatedStyle(() => ({ opacity: title.value, transform: [{ translateY: (1 - title.value) * 12 }] }));

  return (
    <Pressable style={{ flex: 1, backgroundColor: '#2F8476' }} onPress={next}>
      <Motion video="splash" loop={false} playing={rolling} onEnd={next} style={{ flex: 1 }} />
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: height * 0.7, left: 0, right: 0, alignItems: 'center' }, titleA]}>
        <Text style={{ fontFamily: F.bold, fontSize: 64, color: C.white, letterSpacing: 1 }}>Drrys</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 20, color: C.white, marginTop: 6 }}>Grow what you know</Text>
      </Animated.View>
    </Pressable>
  );
}
