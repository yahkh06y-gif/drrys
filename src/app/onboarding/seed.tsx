// The seed opens in Coco's hands and glows → fades to cream → the subject form.
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable } from 'react-native';

import { Motion } from '@/components/Motion';
import { haptic, play } from '@/lib/feedback';

export default function Seed() {
  const done = useRef(false);
  const go = useCallback(() => {
    if (done.current) return;
    done.current = true;
    router.replace({ pathname: '/subject', params: { onboarding: '1' } });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      play('grow');
      haptic('medium');
    }, 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <Pressable style={{ flex: 1 }} onPress={go}>
      <Motion video="seedOpen" loop={false} onEnd={go} style={{ flex: 1 }} />
    </Pressable>
  );
}
