// A burst of falling confetti for the end-of-session reward. Change `burst` to fire it again.
import { useEffect, useMemo } from 'react';
import { Text, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const BITS = ['🎉', '✨', '🌿', '⭐', '🍃', '💚'];

function Bit({ x, delay, dur, spin, glyph, size, fall }: { x: number; delay: number; dur: number; spin: number; glyph: string; size: number; fall: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withDelay(delay, withTiming(1, { duration: dur, easing: Easing.in(Easing.quad) }));
  }, [t, delay, dur]);
  const st = useAnimatedStyle(() => ({
    opacity: t.value > 0 && t.value < 0.92 ? 1 : 0,
    transform: [{ translateY: -40 + t.value * fall }, { translateX: Math.sin(t.value * 6 + x) * 18 }, { rotate: `${t.value * spin}deg` }],
  }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: x }, st]}><Text style={{ fontSize: size }}>{glyph}</Text></Animated.View>;
}

export function Confetti({ burst, count = 26 }: { burst: number; count?: number }) {
  const { width, height } = useWindowDimensions();
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        key: `${burst}-${i}`,
        x: Math.random() * (width - 24),
        delay: Math.random() * 700,
        dur: 1800 + Math.random() * 1800,
        spin: (Math.random() - 0.5) * 720,
        glyph: BITS[i % BITS.length],
        size: 16 + Math.random() * 14,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burst, count, width],
  );
  return (
    <>
      {bits.map((b) => (
        <Bit key={b.key} x={b.x} delay={b.delay} dur={b.dur} spin={b.spin} glyph={b.glyph} size={b.size} fall={height + 60} />
      ))}
    </>
  );
}
