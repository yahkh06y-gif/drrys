import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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

import { useBack } from '@/lib/back';
import { tap, type Sfx } from '@/lib/feedback';
import { autoDir } from '@/design/rtl';
import { color, type } from '@/design/tokens';
import { C, F, R } from '@/theme';

/* ---------- Text ---------- */
// h1…mono keep the looks the screens were built with; the rest come straight from the type scale
// in src/design/tokens.ts. Pick a variant instead of writing a fontSize.
type V = 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'small' | 'label' | 'mono' | 'display' | 'bodyLg' | 'bodySm' | 'caption' | 'micro' | 'number';
const TV: Record<V, TextStyle> = {
  h1: { fontFamily: F.bold, fontSize: 40, lineHeight: 44, color: C.title },
  h2: { fontFamily: F.bold, fontSize: 26, lineHeight: 32, color: C.teal, letterSpacing: -0.6 },
  h3: { fontFamily: F.bold, fontSize: 18, lineHeight: 24, color: C.ink },
  title: { fontFamily: F.bold, fontSize: 16, lineHeight: 22, color: C.ink },
  body: { fontFamily: F.medium, fontSize: 14, lineHeight: 22, color: C.body },
  small: { fontFamily: F.medium, fontSize: 12, lineHeight: 16, color: C.body },
  label: { fontFamily: F.bold, fontSize: 11, lineHeight: 16, color: C.goldInk, letterSpacing: 0.5, textTransform: 'uppercase' },
  mono: { fontFamily: F.monoRegular, fontSize: 14, color: C.tealSoft },
  display: { ...type.display, color: color.text.hero },
  bodyLg: { ...type.bodyLg, color: color.text.body },
  bodySm: { ...type.bodySm, color: color.text.body },
  caption: { ...type.caption, color: color.text.muted },
  micro: { ...type.micro, color: color.text.body },
  number: { ...type.number, color: color.text.primary },
};
/**
 * The app's text. `auto` makes it read in its own direction: use it for anything the student or the AI
 * wrote (recalls, cards, Coco's answers), so Arabic reads right-to-left inside an English screen.
 */
export function T({ v = 'body', auto, style, ...p }: TextProps & { v?: V; auto?: boolean }) {
  return <Text {...p} style={[TV[v], auto && autoDir(p.children), style]} />;
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
  icon,
}: {
  label: string;
  sub?: string;
  /** optional clay icon: above the label in a grid tile, before it in a row */
  icon?: number;
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
            alignItems: row ? (icon ? 'center' : 'flex-start') : 'center',
            flexDirection: row && icon ? 'row' : 'column',
            gap: icon ? (row ? 12 : 4) : 0,
            justifyContent: row && icon ? 'flex-start' : 'center',
            minHeight: row ? 56 : 132,
            borderBottomWidth: selected ? 5 : 2,
          },
          a,
        ]}>
        {icon !== undefined && <Image source={icon} style={row ? { width: 34, height: 34 } : { width: 62, height: 62, marginTop: 8 }} contentFit="contain" />}
        <Text
          adjustsFontSizeToFit
          numberOfLines={row ? 2 : 1}
          style={{ flexShrink: 1, fontFamily: F.bold, fontSize: row ? 18 : icon ? 20 : 24, color: C.teal, textAlign: row ? 'left' : 'center', letterSpacing: -0.5 }}>
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
      {/* the keyboard pushes the content up instead of covering what you type */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView contentContainerStyle={[{ padding: 20, paddingBottom: 40 }, style]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, padding: 20 }, style]}>{children}</View>
        )}
        {footer && <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, backgroundColor: bg }}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------- Session header ("session setup • 2 of 5") ---------- */
export const SESSION_STEPS = 6; // setup · recall · analyze · organize (only with 4+ missed ideas) · explain · cards

export function SessionHeader({
  step,
  title,
  onClose,
  onBack,
  leaveBody = 'Your tree won’t be watered, and you’ll start this session over next time.',
}: {
  step: number;
  title: string;
  onClose?: () => void;
  onBack?: () => void;
  leaveBody?: string; // what "Leave this session?" says happens (on the questions, the answers are kept)
}) {
  // a stray tap on ✕ shouldn't throw a session away: ask first
  const [asking, setAsking] = useState(false);
  // Android back goes one step back (when there is a step to go back to); on the first step it asks about leaving
  useBack(useCallback(() => (onBack ? onBack() : setAsking(true), true), [onBack]));
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderColor: 'rgba(90,66,37,0.1)', gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {onBack ? <IconBtn name="arrow-back" onPress={onBack} /> : <IconBtn name="close" onPress={() => setAsking(true)} />}
        <View style={{ flex: 1, alignItems: 'center', marginRight: onBack ? 0 : 40 }}>
          <T v="small" style={{ fontFamily: F.semi, fontSize: 11, color: C.goldInk, letterSpacing: 0.5 }}>
            step {step} of {SESSION_STEPS}
          </T>
          <T v="title" style={{ color: C.teal, fontSize: 14 }}>
            {title}
          </T>
        </View>
        {onBack && <IconBtn name="close" onPress={() => setAsking(true)} />}
      </View>
      <Progress value={step / SESSION_STEPS} height={8} track={C.track} />
      <Confirm
        visible={asking}
        title="Leave this session?"
        body={leaveBody}
        yes="Leave"
        no="Keep studying"
        onNo={() => setAsking(false)}
        onYes={() => {
          setAsking(false);
          (onClose ?? (() => router.dismissTo('/(tabs)/tree')))();
        }}
      />
    </View>
  );
}

/** A small "are you sure?" card (works the same on Android, iOS and web). */
export function Confirm({ visible, title, body, yes, no, onYes, onNo }: { visible: boolean; title: string; body?: string; yes: string; no: string; onYes: () => void; onNo: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNo}>
      <Pressable onPress={onNo} style={{ flex: 1, backgroundColor: 'rgba(24,36,28,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Pressable style={{ width: '100%', maxWidth: 360, backgroundColor: C.paper, borderRadius: 24, borderWidth: 2, borderColor: C.brown, padding: 20, gap: 10 }}>
          <T v="h3" style={{ color: C.teal }}>
            {title}
          </T>
          {!!body && <T v="small" style={{ color: C.ink, lineHeight: 20 }}>{body}</T>}
          <View style={{ gap: 10, marginTop: 8 }}>
            <Btn title={no} kind="leaf" height={48} onPress={onNo} />
            <Btn title={yes} kind="light" height={44} onPress={onYes} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Onboarding top bar: a back arrow next to the progress bar. */
export function OnbBar({ value, onBack, style }: { value: number; onBack?: (() => void) | false; style?: StyleProp<ViewStyle> }) {
  const back = onBack === false ? undefined : (onBack ?? (router.canGoBack() ? () => router.back() : undefined));
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}>
      {back ? <IconBtn name="arrow-back" size={36} onPress={back} /> : <View style={{ width: 4 }} />}
      <View style={{ flex: 1 }}>
        <Progress value={value} />
      </View>
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

/** The XP picture: three yellow stars. Used wherever XP is shown (width = height × 1.43). */
export function XpStars({ size = 20 }: { size?: number }) {
  return <Image source={require('../../assets/art/xp-stars.png')} style={{ width: size * 1.43, height: size }} contentFit="contain" accessibilityLabel="XP" />;
}
