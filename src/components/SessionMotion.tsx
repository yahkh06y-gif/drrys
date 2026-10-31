// Small motion pieces shared by the session screens: a pressable that squeezes, the verdict panel that lands
// after "Check my answer" (the icon pops; a miss gives a short head-shake; a right answer sends out a few sparks),
// and the memory-hook entry. Durations and springs come from the design tokens; reduced motion keeps only fades.
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Pressable, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { color, ease, motion, palette, radius, S } from '@/design/tokens';
import { F } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** A Pressable that squeezes to 0.97 while held and springs back: the press is felt, not just seen. */
export function Squeeze({
  style,
  outer,
  children,
  onPressIn,
  onPressOut,
  ...p
}: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; /** layout of the touch area (alignSelf, flex…) */ outer?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      {...p}
      style={outer}
      onPressIn={(e) => ((s.value = withTiming(0.97, { duration: motion.press, easing: ease.out })), onPressIn?.(e))}
      onPressOut={(e) => ((s.value = withSpring(1, motion.spring.press)), onPressOut?.(e))}>
      <Animated.View style={[style, a]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Six little sparks flying out of the verdict icon (right answers only). */
function Sparks({ tint }: { tint: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(80, withTiming(1, { duration: 520, easing: ease.out }));
  }, [t]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 12, top: 12, width: 0, height: 0 }}>
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <Spark key={k} t={t} angle={(k / 6) * Math.PI * 2 - Math.PI / 2} tint={k % 2 ? palette.sun400 : tint} />
      ))}
    </View>
  );
}
function Spark({ t, angle, tint }: { t: ReturnType<typeof useSharedValue<number>>; angle: number; tint: string }) {
  const a = useAnimatedStyle(() => {
    const d = interpolate(t.value, [0, 1], [6, 26]);
    return {
      opacity: interpolate(t.value, [0, 0.2, 1], [0, 1, 0]),
      transform: [{ translateX: Math.cos(angle) * d - 3 }, { translateY: Math.sin(angle) * d - 3 }, { scale: interpolate(t.value, [0, 1], [1, 0.4]) }],
    };
  });
  return <Animated.View style={[{ position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: tint }, a]} />;
}

/** The verdict panel: lands with a soft spring, its icon pops in, and a miss shakes once (like a gentle "no"). */
export function Verdict({
  kind,
  tone,
  children,
}: {
  kind: 'correct' | 'almost' | 'wrong';
  tone: { bg: string; border: string; icon: IconName; color: string; text: string; title: string };
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const land = useSharedValue(0);
  const icon = useSharedValue(0);
  const shake = useSharedValue(0);
  useEffect(() => {
    land.value = withSpring(1, motion.spring.slide);
    icon.value = reduce ? withTiming(1, { duration: motion.fast }) : withDelay(90, withSpring(1, motion.spring.bouncy));
    if (kind === 'wrong' && !reduce) {
      const step = { duration: 55, easing: ease.inOut };
      shake.value = withDelay(140, withSequence(withTiming(-7, step), withTiming(6, step), withTiming(-4, step), withTiming(2, step), withTiming(0, step)));
    }
  }, [kind, reduce, land, icon, shake]);
  const panel = useAnimatedStyle(() => ({
    opacity: interpolate(land.value, [0, 0.6], [0, 1], 'clamp'),
    transform: [{ translateY: reduce ? 0 : (1 - land.value) * 14 }, { scale: reduce ? 1 : 0.97 + land.value * 0.03 }, { translateX: shake.value }],
  }));
  const ic = useAnimatedStyle(() => ({ opacity: Math.min(1, icon.value * 2), transform: [{ scale: 0.5 + icon.value * 0.5 }, { rotate: `${(1 - icon.value) * (kind === 'correct' ? -25 : 0)}deg` }] }));
  return (
    <Animated.View style={[{ backgroundColor: tone.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: tone.border, padding: 16, gap: 8 }, panel]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 24, height: 24 }}>
          {kind === 'correct' && !reduce && <Sparks tint={tone.color} />}
          <Animated.View style={ic}>
            <Ionicons name={tone.icon} size={24} color={tone.color} />
          </Animated.View>
        </View>
        <Text style={{ flex: 1, fontFamily: F.semi, fontSize: 18, lineHeight: 24, color: tone.text }}>{tone.title}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

/** "Make a memory hook": a warm, clearly tappable row (not a faint link), with what the hook is for. */
export function HookEntry({ mnemonic, onPress }: { mnemonic?: string; onPress: () => void }) {
  const has = !!mnemonic;
  return (
    <Squeeze
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={has ? 'Open my memory hook' : 'Make a memory hook'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: S[3],
        backgroundColor: palette.sun50,
        borderWidth: 1,
        borderColor: palette.sun200,
        borderRadius: radius.lg,
        paddingVertical: S[3],
        paddingHorizontal: S[3],
      }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.sun100, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={has ? 'bulb' : 'bulb-outline'} size={20} color={palette.sun700} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: F.semi, fontSize: 15, color: color.text.primary }}>{has ? 'My memory hook' : 'Make a memory hook'}</Text>
        <Text numberOfLines={1} style={{ fontFamily: F.regular, fontSize: 13, color: color.text.muted }}>
          {has ? mnemonic : 'A picture or a silly line, so this one sticks'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={palette.sun700} />
    </Squeeze>
  );
}
