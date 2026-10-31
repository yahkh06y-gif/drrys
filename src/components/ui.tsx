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
  useReducedMotion,
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
import { color, depth, ease, motion, radius, shadow, type } from '@/design/tokens';
import { C, F, R } from '@/theme';

/* ---------- Text ---------- */
// Every variant comes from the type scale in src/design/tokens.ts (one family, Readex Pro, 600 at most).
// The old names stay so every screen keeps working: h1 = the green hero title, h2 = a brand title,
// h3 = a heading, title = a strong line. Pick a variant instead of writing a fontSize.
type V = 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'small' | 'label' | 'mono' | 'display' | 'bodyLg' | 'bodySm' | 'caption' | 'micro' | 'number' | 'subhead';
const TV: Record<V, TextStyle> = {
  h1: { ...type.display, color: color.text.hero },
  h2: { ...type.title, color: color.text.brand },
  h3: { ...type.heading, color: color.text.primary },
  title: { ...type.bodyStrong, fontFamily: F.semi, color: color.text.primary },
  body: { fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: color.text.body },
  small: { ...type.caption, color: color.text.body },
  label: { ...type.subhead, color: color.text.label },
  mono: { fontFamily: F.medium, fontSize: 14, color: color.text.brand, fontVariant: ['tabular-nums'] },
  display: { ...type.display, color: color.text.hero },
  bodyLg: { ...type.body, color: color.text.body },
  bodySm: { ...type.subhead, fontFamily: F.regular, color: color.text.body },
  caption: { ...type.caption, color: color.text.muted },
  subhead: { ...type.subhead, color: color.text.body },
  micro: { ...type.micro, color: color.text.body },
  number: { ...type.number, fontVariant: ['tabular-nums'], color: color.text.primary },
};
/**
 * The app's text. `auto` makes it read in its own direction: use it for anything the student or the AI
 * wrote (recalls, cards, Coco's answers), so Arabic reads right-to-left inside an English screen.
 */
export function T({ v = 'body', auto, style, ...p }: TextProps & { v?: V; auto?: boolean }) {
  return <Text {...p} style={[TV[v], auto && autoDir(p.children), style]} />;
}

/* ---------- Button (the pressable with a bottom edge) ---------- */
// One main color: every "go" button is leaf green, whatever kind a screen asks for (green, leaf, teal).
// light / white are the secondary button; dark is for the photo and video screens.
type BtnKind = 'green' | 'teal' | 'leaf' | 'dark' | 'light' | 'white' | 'danger';
const PRIMARY = { bg: color.action.primary, sh: color.action.primaryEdge, fg: color.text.onAction };
const KIND: Record<BtnKind, { bg: string; sh: string; fg: string; border?: string }> = {
  green: PRIMARY,
  leaf: PRIMARY,
  teal: PRIMARY,
  dark: { bg: C.ink, sh: '#000', fg: C.white },
  danger: { bg: color.action.danger, sh: color.action.dangerEdge, fg: C.white },
  light: { bg: color.action.secondary, sh: color.action.secondaryEdge, fg: color.action.secondaryText, border: color.border.strong },
  white: { bg: color.action.secondary, sh: color.action.secondaryEdge, fg: color.text.primary, border: color.border.strong },
};
// disabled has no edge at all: it sits pressed-in, flat and grey
const OFF = { bg: color.action.disabled, sh: color.action.disabled, fg: color.action.disabledText };

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
  height = 52,
  mono,
  label,
}: {
  /** empty for an icon-only button (then give it a `label`) */
  title: string;
  label?: string;
  onPress?: () => void;
  kind?: BtnKind;
  icon?: keyof typeof Ionicons.glyphMap;
  iconLeft?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  /** false when onPress plays its own sound */
  sfx?: Sfx | false;
  style?: StyleProp<ViewStyle>;
  pill?: boolean;
  height?: number;
  mono?: boolean;
}) {
  // disabled is grey (not see-through), so it never reads as "almost ready"; loading keeps its color
  const k = disabled ? OFF : KIND[kind];
  // disabled sits pressed-in (no edge); becoming ready it rises onto its edge
  const y = useSharedValue(disabled ? depth.press : 0);
  useEffect(() => {
    y.value = withTiming(disabled ? depth.press : 0, { duration: motion.fast, easing: ease.out });
  }, [disabled, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const off = disabled || loading;
  const r = pill ? radius.pill : radius.lg;
  return (
    <Pressable
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPressIn={() => (y.value = withTiming(depth.press, { duration: motion.press, easing: ease.out }))}
      onPressOut={() => (y.value = withSpring(0, motion.spring.press))}
      onPress={() => {
        if (sfx) tap(sfx);
        onPress?.();
      }}
      style={[{ height: height + depth.press }, style]}>
      {/* The edge is its own rounded slab under the face. It is remounted (key) whenever the kind or
          disabled state changes: Android drops the corner radius when a background goes from none to a color. */}
      {!disabled && (
        <View
          key={kind}
          style={{ position: 'absolute', left: 0, right: 0, top: depth.press, height, backgroundColor: k.sh, borderRadius: r, overflow: 'hidden' }}
        />
      )}
      <Animated.View
        style={[
          {
            height,
            backgroundColor: k.bg,
            borderRadius: r,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: title ? 18 : 0,
            borderWidth: 'border' in k && k.border ? 1 : 0,
            borderColor: 'border' in k ? k.border : undefined,
          },
          a,
        ]}>
        {loading ? (
          <ActivityIndicator color={k.fg} />
        ) : (
          <>
            {iconLeft && <Ionicons name={iconLeft} size={18} color={k.fg} />}
            {/* one line, always: a long title shrinks a little instead of wrapping out of the button */}
            {!!title && <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[{ flexShrink: 1, textAlign: 'center' }, mono ? { ...type.number, fontVariant: ['tabular-nums'], color: k.fg } : { color: k.fg, fontFamily: F.semi, fontSize: 16 }]}>
              {title}
            </Text>}
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
  // picking it: a small check pops in at the corner
  const still = useReducedMotion();
  const chk = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    chk.value = selected ? (still ? withTiming(1, { duration: motion.fast }) : withSpring(1, motion.spring.bouncy)) : withTiming(0, { duration: motion.fast, easing: ease.out });
  }, [selected, still, chk]);
  const ca = useAnimatedStyle(() => ({ opacity: Math.min(1, chk.value * 1.5), transform: [{ scale: 0.4 + chk.value * 0.6 }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPressIn={() => (s.value = withTiming(motion.pressScale, { duration: motion.press, easing: ease.out }))}
      onPressOut={() => (s.value = withSpring(1, motion.spring.press))}
      onPress={() => {
        tap('select');
        onPress();
      }}
      style={style}>
      <Animated.View
        style={[
          {
            backgroundColor: selected ? color.selected.bg : color.surface.choice,
            borderWidth: 1.5,
            borderColor: selected ? color.selected.border : color.border.strong,
            borderRadius: radius.lg,
            paddingVertical: row ? 14 : 0,
            paddingHorizontal: 12,
            alignItems: row ? (icon ? 'center' : 'flex-start') : 'center',
            flexDirection: row && icon ? 'row' : 'column',
            gap: icon ? (row ? 12 : 4) : 0,
            justifyContent: row && icon ? 'flex-start' : 'center',
            minHeight: row ? 56 : 132,
            borderBottomWidth: depth.md,
          },
          a,
        ]}>
        {icon !== undefined && <Image source={icon} style={row ? { width: 34, height: 34 } : { width: 62, height: 62, marginTop: 8 }} contentFit="contain" />}
        <Text
          adjustsFontSizeToFit
          numberOfLines={row ? 2 : 1}
          style={{ flexShrink: 1, fontFamily: F.semi, fontSize: row ? 17 : icon ? 18 : 22, color: selected ? color.selected.text : color.text.primary, textAlign: row ? 'left' : 'center', letterSpacing: row ? 0 : -0.3 }}>
          {label}
        </Text>
        {sub && <Text style={{ ...type.caption, color: selected ? color.selected.text : color.text.muted, marginTop: 4, textAlign: 'center' }}>{sub}</Text>}
        {!row && (
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 8, right: 8 }, ca]}>
            <Ionicons name="checkmark-circle" size={20} color={color.selected.border} />
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

/* ---------- Progress ---------- */
export function Progress({ value, height = 10, track = color.surface.track, fill = color.game.progress }: { value: number; height?: number; track?: string; fill?: string }) {
  const w = useSharedValue(0);
  const still = useReducedMotion();
  useEffect(() => {
    const to = Math.max(0.03, Math.min(1, value));
    w.value = still ? to : withTiming(to, { duration: motion.progress, easing: ease.out });
  }, [value, w, still]);
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
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderColor: color.border.subtle, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {onBack ? <IconBtn name="arrow-back" onPress={onBack} /> : <IconBtn name="close" onPress={() => setAsking(true)} />}
        <View style={{ flex: 1, alignItems: 'center', marginRight: onBack ? 0 : 40 }}>
          <T v="caption" style={{ fontVariant: ['tabular-nums'] }}>
            Step {step} of {SESSION_STEPS}
          </T>
          <T v="title" style={{ color: color.text.brand, fontSize: 15, lineHeight: 20 }}>
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
      <Pressable onPress={onNo} style={{ flex: 1, backgroundColor: color.overlay.scrimStrong, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Pressable style={{ width: '100%', maxWidth: 360, backgroundColor: color.bg.raised, borderRadius: radius.xxl, padding: 20, gap: 8, ...shadow.float }}>
          <T v="h3">{title}</T>
          {!!body && <T v="body">{body}</T>}
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

export function IconBtn({ name, onPress, size = 40, color: tint = C.teal }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void; size?: number; color?: string }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={name.replace(/-outline$/, '').replace(/-/g, ' ')}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: pressed ? color.surface.track : color.surface.muted,
        alignItems: 'center',
        justifyContent: 'center',
      })}>
      <Ionicons name={name} size={size * 0.45} color={tint} />
    </Pressable>
  );
}

/* ---------- Pills / cards ---------- */
export function Pill({ text, bg = C.mint, fg = C.mossDark, border = C.mintBorder, icon }: { text: string; bg?: string; fg?: string; border?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      <Text style={{ ...type.micro, color: fg }}>{text}</Text>
    </View>
  );
}

export function Card({ children, style, bark }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; bark?: boolean }) {
  return (
    <View
      style={[
        {
          // a card you read is flat (one hairline); the bark card is the tree's game card and keeps its edge
          backgroundColor: bark ? color.surface.cardWarm : color.surface.card,
          borderRadius: bark ? radius.lg : radius.xl,
          borderWidth: bark ? 2 : 1,
          borderColor: bark ? color.border.bark : color.border.default,
          borderBottomWidth: bark ? depth.lg : 1,
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
  const still = useReducedMotion();
  useEffect(() => {
    if (!bob || still) return;
    y.value = withRepeat(withSequence(withTiming(-6, { duration: motion.bob, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: motion.bob, easing: Easing.inOut(Easing.sin) })), -1);
    r.value = withRepeat(withSequence(withTiming(1.5, { duration: 2100 }), withTiming(-1.5, { duration: 2100 })), -1, true);
  }, [bob, still, y, r]);
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
      <View style={{ backgroundColor: color.surface.card, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: color.border.strong, maxWidth: 260 }}>
        <Text style={{ ...type.subhead, fontSize: 15, lineHeight: 21, color: color.text.brand, textAlign: 'center' }}>{text}</Text>
      </View>
      <View style={{ width: 14, height: 14, backgroundColor: color.surface.card, transform: [{ rotate: '45deg' }], alignSelf: 'center', marginTop: -8, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: color.border.strong }} />
    </View>
  );
}

/* Fade/slide in wrapper for staggered entrances */
export function Enter({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0);
  const still = useReducedMotion();
  useEffect(() => {
    const t = setTimeout(() => (o.value = withTiming(1, { duration: still ? motion.fast : motion.enter, easing: ease.out })), delay);
    return () => clearTimeout(t);
  }, [delay, o, still]);
  // a short rise (8, not 16): it should feel like the screen settling, not things flying in
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: still ? 0 : (1 - o.value) * 8 }] }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}

/** The XP picture: three yellow stars. Used wherever XP is shown (width = height × 1.43). */
export function XpStars({ size = 20 }: { size?: number }) {
  return <Image source={require('../../assets/art/xp-stars.png')} style={{ width: size * 1.43, height: size }} contentFit="contain" accessibilityLabel="XP" />;
}
