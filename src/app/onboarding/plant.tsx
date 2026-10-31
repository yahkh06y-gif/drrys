// "Now let's plant your first subject, <name>".
// One continuous scene built from two Blender clips, both preloaded so the cut is seamless:
//   plantLoop (the seed waits, loops) —"Plant now": hurries on to its last frame→ plantOpen (the seed opens → cream)
// then on to the subject form. plantOpen's first frame is plantLoop's last, so the cut doesn't show.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Motion } from '@/components/Motion';
import { Btn, Enter, OnbBar, T } from '@/components/ui';
import { motion } from '@/design/tokens';
import { finishOnboarding } from '@/lib/finish';
import { progressOf } from '@/lib/onboarding';
import { useApp } from '@/store';
import { C } from '@/theme';

type Stage = 'idle' | 'hurry' | 'open';

/** How much faster the loop plays once "Plant now" is pressed, on its way to its last frame. */
const HURRY = 4;

export default function Plant() {
  const [stage, setStage] = useState<Stage>('idle');
  const name = useApp((s) => s.profile.name.trim().split(' ')[0]);
  const ui = useSharedValue(1);
  const left = useRef(false);

  const toForm = useCallback(() => {
    if (left.current) return;
    left.current = true;
    router.push({ pathname: '/subject', params: { onboarding: '1' } });
  }, []);

  // coming back from the form (its back arrow): the seed is waiting again
  useFocusEffect(
    useCallback(() => {
      left.current = false;
      setStage('idle');
      ui.value = 1;
    }, [ui]),
  );

  const plantNow = () => {
    setStage('hurry');
    ui.value = withTiming(0, { duration: motion.base }); // the field is left clear for the seed
  };

  const onLoopEnd = useCallback(() => setStage((s) => (s === 'hurry' ? 'open' : s)), []);

  const uiA = useAnimatedStyle(() => ({ opacity: ui.value }));
  const fill = { position: 'absolute', inset: 0 } as const;

  return (
    <View style={{ flex: 1 }}>
      {/* layer 1: the seed waits; "Plant now" stops the loop and speeds it to its last frame */}
      <Motion
        video="plantLoop"
        loop={stage === 'idle'}
        rate={stage === 'hurry' ? HURRY : 1}
        playing={stage !== 'open'}
        onEnd={stage === 'hurry' ? onLoopEnd : undefined}
        style={fill}
      />

      {/* UI over the field */}
      <Animated.View style={[{ flex: 1 }, uiA]} pointerEvents={stage === 'idle' ? 'auto' : 'none'}>
        <SafeAreaView style={{ flex: 1, padding: 20 }}>
          <OnbBar value={progressOf('plant')} style={{ marginBottom: 20 }} />
          <Enter>
            <T v="h1" style={{ color: C.teal }}>
              Now let’s plant your first subject{name ? `, ${name}` : ''}.
            </T>
          </Enter>
          <View style={{ flex: 1 }} />
          <View style={{ gap: 10 }}>
            <Btn title="Plant now" kind="leaf" mono onPress={plantNow} />
            <Btn title="Not now" kind="light" height={46} mono onPress={finishOnboarding} />
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* layer 2: the seed opens (preloaded, instant cut from the loop's last frame) */}
      <View style={[fill, { opacity: stage === 'open' ? 1 : 0 }]} pointerEvents={stage === 'open' ? 'auto' : 'none'}>
        <Pressable style={{ flex: 1 }} onPress={toForm}>
          <Motion video="plantOpen" loop={false} playing={stage === 'open'} onEnd={stage === 'open' ? toForm : undefined} style={{ flex: 1 }} />
        </Pressable>
      </View>
    </View>
  );
}
