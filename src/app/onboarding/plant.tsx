// "Now let's plant your first subject, <name>".
// One continuous scene built from three Blender clips, all preloaded so the cuts are seamless:
//   agriculture (Coco the farmer, loop) —dissolve→ fallSeed (Coco catches a seed) —instant cut→ seedOpen (the seed glows)
// then on to the subject form.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Motion } from '@/components/Motion';
import { Btn, Enter, OnbBar, T } from '@/components/ui';
import { haptic } from '@/lib/feedback';
import { finishOnboarding } from '@/lib/finish';
import { progressOf } from '@/lib/onboarding';
import { useApp } from '@/store';
import { C } from '@/theme';

type Stage = 'idle' | 'catch' | 'open';

export default function Plant() {
  const [stage, setStage] = useState<Stage>('idle');
  const name = useApp((s) => s.profile.name.trim().split(' ')[0]);
  const catchOpacity = useSharedValue(0);
  const left = useRef(false);

  const toForm = useCallback(() => {
    if (left.current) return;
    left.current = true;
    router.push({ pathname: '/subject', params: { onboarding: '1' } });
  }, []);

  // coming back from the form (its back arrow): the farmer is waiting again
  useFocusEffect(
    useCallback(() => {
      left.current = false;
      setStage('idle');
      catchOpacity.value = 0;
    }, [catchOpacity]),
  );

  const startCatch = () => {
    setStage('catch');
    catchOpacity.value = withTiming(1, { duration: 550 }); // dissolve from the farmer loop
  };

  const onCaught = useCallback(() => setStage((s) => (s === 'catch' ? 'open' : s)), []);

  useEffect(() => {
    if (stage !== 'open') return;
    const t = setTimeout(() => haptic('medium'), 1400); // the seed starts to glow
    return () => clearTimeout(t);
  }, [stage]);

  const catchA = useAnimatedStyle(() => ({ opacity: catchOpacity.value }));
  const fill = { position: 'absolute', inset: 0 } as const;

  return (
    <View style={{ flex: 1 }}>
      {/* layer 1: farmer loop */}
      <Motion video="agriculture" playing={stage === 'idle'} style={fill} />

      {/* UI over the farmer */}
      <SafeAreaView style={{ flex: 1, padding: 20 }} pointerEvents={stage === 'idle' ? 'auto' : 'none'}>
        <OnbBar value={progressOf('plant')} style={{ marginBottom: 20 }} />
        <Enter>
          <T v="h1" style={{ color: C.teal }}>
            Now let’s plant your first subject{name ? `, ${name}` : ''}.
          </T>
        </Enter>
        <View style={{ flex: 1 }} />
        <View style={{ gap: 10 }}>
          <Btn title="Plant Now" kind="leaf" mono onPress={startCatch} />
          <Btn title="Not now" kind="green" height={46} mono onPress={finishOnboarding} />
        </View>
      </SafeAreaView>

      {/* layer 2: the seed falls (preloaded, dissolves in) */}
      <Animated.View style={[fill, catchA]} pointerEvents={stage === 'catch' ? 'auto' : 'none'}>
        <Pressable style={{ flex: 1 }} onPress={onCaught}>
          <Motion video="fallSeed" loop={false} playing={stage === 'catch'} onEnd={stage === 'catch' ? onCaught : undefined} style={{ flex: 1 }} />
        </Pressable>
      </Animated.View>

      {/* layer 3: the seed opens (preloaded, instant cut) */}
      <View style={[fill, { opacity: stage === 'open' ? 1 : 0 }]} pointerEvents={stage === 'open' ? 'auto' : 'none'}>
        <Pressable style={{ flex: 1 }} onPress={toForm}>
          <Motion video="seedOpen" loop={false} playing={stage === 'open'} onEnd={stage === 'open' ? toForm : undefined} style={{ flex: 1 }} />
        </Pressable>
      </View>
    </View>
  );
}
