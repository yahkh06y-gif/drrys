import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { tap, type Sfx } from '@/lib/feedback';
import { C, F, R } from '@/theme';

/* ---------- Text ---------- */
type V = 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'small' | 'label' | 'mono';
const TV: Record<V, TextStyle> = {
  h1: { fontFamily: F.bold, fontSize: 40, lineHeight: 44, color: C.title },
  h2: { fontFamily: F.bold, fontSize: 26, lineHeight: 32, color: C.teal, letterSpacing: -0.6 },
  h3: { fontFamily: F.bold, fontSize: 18, lineHeight: 24, color: C.ink },
  title: { fontFamily: F.bold, fontSize: 16, lineHeight: 22, color: C.ink },
  body: { fontFamily: F.medium, fontSize: 14, lineHeight: 22, color: C.body },
  small: { fontFamily: F.medium, fontSize: 12, lineHeight: 16, color: C.body },
  label: { fontFamily: F.bold, fontSize: 11, lineHeight: 16, color: C.goldInk, letterSpacing: 0.5, textTransform: 'uppercase' },
  mono: { fontFamily: F.monoRegular, fontSize: 14, color: C.tealSoft },
};
export function T({ v = 'body', style, ...p }: TextProps & { v?: V }) {
  return <Text {...p} style={[TV[v], style]} />;
}

/* ---------- Clay button (the 3D pressable from Figma) ---------- */
type BtnKind = 'green' | 'teal' | 'leaf' | 'dark' | 'light' | 'white';
const KIND: Record<BtnKind, { bg: string; sh: string; fg: string; border?: string }> = {
  green: { bg: C.green, sh: C.greenShadow, fg: C.white },
  leaf: { bg: C.leaf, sh: C.leafShadow, fg: C.white },
  teal: { bg: C.teal, sh: 'rgba(90,66,37,0.45)', fg: C.white },
  dark: { bg: '#1F1F1F', sh: '#000', fg: C.white },
  light: { bg: C.sand, sh: 'rgba(90,66,37,0.25)', fg: C.teal, border: C.line },
  white: { bg: C.white, sh: 'rgba(90,66,37,0.18)', fg: C.ink, border: C.line },
};

export function Btn({
  title,
  onPress,
  kind = 'green',
  icon,
  iconLeft,
  loading,
  disabled,
  sfx = 'tap',
  style,
  pill,
  height = 56,
  mono,
}: {
  title: string;
  onPress?: () => void;
  kind?: BtnKind;
  icon?: keyof typeof Ionicons.glyphMap;
  iconLeft?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  sfx?: Sfx;
  style?: StyleProp<ViewStyle>;
  pill?: boolean;
  height?: number;
  mono?: boolean;
}) {
  const k = KIND[kind];
  const y = useSharedValue(0);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const off = disabled || loading;
  return (
    <Pressable
      disabled={off}
      onPressIn={() => (y.value = withTiming(4, { duration: 60 }))}
      onPressOut={() => (y.value = withSpring(0, { damping: 12, stiffness: 400 }))}
      onPress={() => {
        tap(sfx);
        onPress?.();
      }}
      style={[{ height: height + 4, opacity: off ? 0.55 : 1 }, style]}>
      <View style={[StyleSheet.absoluteFill, { top: 4, backgroundColor: k.sh, borderRadius: pill ? R.pill : 18 }]} />
      <Animated.View
        style={[
          {
            height,
            backgroundColor: k.bg,
            borderRadius: pill ? R.pill : 18,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 18,
            borderWidth: k.border ? 1 : 0,
            borderColor: k.border,
          },
          a,
        ]}>
        {loading ? (
          <ActivityIndicator color={k.fg} />
        ) : (
          <>
            {iconLeft && <Ionicons name={iconLeft} size={18} color={k.fg} />}
            <Text style={{ color: k.fg, fontFamily: mono ? F.mono : F.bold, fontSize: mono ? 20 : 16, letterSpacing: 0.3 }}>{title}</Text>
            {icon && <Ionicons name={icon} size={18} color={k.fg} />}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

/* ---------- Choice card (onboarding answers) ---------- */
export function Choice({
  label,
  sub,
  selected,
  onPress,
  style,
  row,
}: {
  label: string;
  sub?: string;
  selected?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  row?: boolean;
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPressIn={() => (s.value = withTiming(0.96, { duration: 80 }))}
      onPressOut={() => (s.value = withSpring(1))}
      onPress={() => {
        tap('select');
        onPress();
      }}
      style={style}>
      <Animated.View
        style={[
          {
            backgroundColor: selected ? C.cardSelected : C.card,
            borderWidth: 2,
            borderColor: C.brown,
            borderRadius: row ? 14 : 21.6,
            paddingVertical: row ? 14 : 0,
            paddingHorizontal: 12,
            alignItems: row ? 'flex-start' : 'center',
            justifyContent: 'center',
            minHeight: row ? 56 : 132,
            borderBottomWidth: selected ? 5 : 2,
          },
          a,
        ]}>
        <Text
          adjustsFontSizeToFit
          numberOfLines={row ? 2 : 1}
          style={{ fontFamily: F.bold, fontSize: row ? 18 : 24, color: C.teal, textAlign: row ? 'left' : 'center', letterSpacing: -0.5 }}>
          {label}
        </Text>
        {sub && <Text style={{ fontFamily: F.medium, fontSize: 10, color: C.teal, marginTop: 4, textAlign: 'center' }}>{sub}</Text>}
      </Animated.View>
    </Pressable>
  );
}

/* ---------- Progress ---------- */
export function Progress({ value, height = 10, track = C.white, fill = C.gold }: { value: number; height?: number; track?: string; fill?: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0.03, Math.min(1, value)), { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [value, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: R.pill, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: R.pill, backgroundColor: fill }, a]} />
    </View>
  );
}

/* ---------- Screen ---------- */
export function Screen({
  children,
  bg = C.cream,
  scroll,
  style,
  edges = ['top', 'bottom'],
  footer,
}: {
  children: React.ReactNode;
  bg?: string;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom')[];
  footer?: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[{ padding: 20, paddingBottom: 40 }, style]} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: 20 }, style]}>{children}</View>
      )}
      {footer && <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, backgroundColor: bg }}>{footer}</View>}
    </SafeAreaView>
  );
}

/* ---------- Session header ("session setup • 2 of 5") ---------- */
export function SessionHeader({ step, title, onClose }: { step: number; title: string; onClose?: () => void }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderColor: 'rgba(90,66,37,0.1)', gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconBtn name="close" onPress={onClose ?? (() => router.dismissTo('/(tabs)/tree'))} />
        <View style={{ flex: 1, alignItems: 'center', marginRight: 40 }}>
          <T v="small" style={{ fontFamily: F.semi, fontSize: 11, color: C.goldInk, letterSpacing: 0.5 }}>
            session setup • {step} of 5
          </T>
          <T v="title" style={{ color: C.teal, fontSize: 14 }}>
            {title}
          </T>
        </View>
      </View>
      <Progress value={step / 5} height={8} track={C.track} />
    </View>
  );
}

export function IconBtn({ name, onPress, size = 40, color = C.teal }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void; size?: number; color?: string }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.sand,
        borderWidth: 1,
        borderColor: C.line,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 3,
      }}>
      <Ionicons name={name} size={size * 0.45} color={color} />
    </Pressable>
  );
}

/* ---------- Pills / cards ---------- */
export function Pill({ text, bg = C.mint, fg = C.mossDark, border = C.mintBorder, icon }: { text: string; bg?: string; fg?: string; border?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }}>
      {icon && <Ionicons name={icon} size={11} color={fg} />}
      <Text style={{ fontFamily: F.bold, fontSize: 10, color: fg }}>{text}</Text>
    </View>
  );
}

export function Card({ children, style, bark }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; bark?: boolean }) {
  return (
    <View
      style={[
        {
          backgroundColor: bark ? '#FBF9F4' : C.white,
          borderRadius: bark ? 16 : 24,
          borderWidth: bark ? 2 : 1,
          borderColor: bark ? C.bark : C.lineStrong,
          borderBottomWidth: bark ? 6 : 4,
          padding: 16,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/* ---------- Coco (idle bobbing mascot) ---------- */
export function Coco({ src, size = 220, style, bob = true }: { src: ImageSource | number; size?: number; style?: StyleProp<ViewStyle>; bob?: boolean }) {
  const y = useSharedValue(0);
  const r = useSharedValue(0);
  useEffect(() => {
    if (!bob) return;
    y.value = withRepeat(withSequence(withTiming(-6, { duration: 1400, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })), -1);
    r.value = withRepeat(withSequence(withTiming(1.5, { duration: 2100 }), withTiming(-1.5, { duration: 2100 })), -1, true);
  }, [bob, y, r]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={[{ width: size, height: size * 1.25, alignSelf: 'center' }, a, style]}>
      <Image source={src} style={{ width: '100%', height: '100%' }} contentFit="contain" />
    </Animated.View>
  );
}

export function Bubble({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ alignSelf: 'center' }, style]}>
      <View style={{ backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.line, maxWidth: 260 }}>
        <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.teal, textAlign: 'center' }}>{text}</Text>
      </View>
      <View style={{ width: 14, height: 14, backgroundColor: C.white, transform: [{ rotate: '45deg' }], alignSelf: 'center', marginTop: -8, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.line }} />
    </View>
  );
}

/* Fade/slide in wrapper for staggered entrances */
export function Enter({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => (o.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })), delay);
    return () => clearTimeout(t);
  }, [delay, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: (1 - o.value) * 16 }] }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}
