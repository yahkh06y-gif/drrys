// The shared building blocks that were still being rebuilt by hand on each screen: layout stacks, surfaces,
// answer feedback, badges, the segmented toggle, text fields, list rows, sheets, tiles and empty states.
// The older blocks (T, Btn, Card, Choice, Coco…) live in components/ui.tsx; '@/design' exports both.
import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import React from 'react';
import { Modal, Pressable, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, Coco, T } from '@/components/ui';
import { tap } from '@/lib/feedback';

import { autoDir, dirIcon } from './rtl';
import { color, depth, font, layout, motion, radius, S, shadow, size, type Space, type Tone } from './tokens';

type IconName = keyof typeof Ionicons.glyphMap;

/* ---------- Layout ---------- */
/** A column (or a row) with token spacing between its children. Replaces View + flexDirection + gap. */
export function Stack({
  children,
  gap = 3,
  row,
  align,
  justify,
  wrap,
  pad,
  flex,
  style,
}: {
  children?: React.ReactNode;
  gap?: Space;
  row?: boolean;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  pad?: Space;
  flex?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: row ? 'row' : 'column',
          gap: S[gap],
          alignItems: align ?? (row ? 'center' : undefined),
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : undefined,
          padding: pad === undefined ? undefined : S[pad],
          flex,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** Stack laid out as a row (it flips by itself in an RTL app). */
export function Row(props: Omit<React.ComponentProps<typeof Stack>, 'row'>) {
  return <Stack gap={2} {...props} row />;
}

export function Divider({ inset = 0, style }: { inset?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: color.border.subtle, marginStart: inset }, style]} />;
}

/* ---------- Surfaces ---------- */
type SurfaceKind = 'card' | 'bark' | 'sunken' | 'raised' | 'flat' | Tone;

/**
 * Anything that sits on the page as a block.
 *   card   : a card you read: white, one hairline, no edge, no shadow (default)
 *   bark   : the tree's bark-edged game card (the one card that keeps a bottom edge)
 *   sunken : a well inside a card (quotes, the model answer)
 *   raised : above the page (dialogs, popovers): paper with a soft wide shadow
 *   flat   : the same as card, with smaller corners
 *   correct / almost / wrong / info : tinted with that answer state
 */
export function Surface({ kind = 'card', pad = 4, gap, children, style }: { kind?: SurfaceKind; pad?: Space; gap?: Space; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const base: ViewStyle = { padding: S[pad], gap: gap === undefined ? undefined : S[gap] };
  const look: ViewStyle =
    kind === 'card'
      ? { backgroundColor: color.surface.card, borderRadius: radius.xl, borderWidth: 1, borderColor: color.border.default }
      : kind === 'bark'
        ? { backgroundColor: color.surface.cardWarm, borderRadius: radius.lg, borderWidth: 2, borderColor: color.border.bark, borderBottomWidth: depth.lg }
        : kind === 'sunken'
          ? { backgroundColor: color.bg.sunken, borderRadius: radius.lg }
          : kind === 'raised'
            ? { backgroundColor: color.bg.raised, borderRadius: radius.xxl, ...shadow.float }
            : kind === 'flat'
              ? { backgroundColor: color.surface.card, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border.default }
              : { backgroundColor: color.feedback[kind].bg, borderRadius: radius.lg };
  return <View style={[base, look, style]}>{children}</View>;
}

/* ---------- Answer feedback ---------- */
const TONE_ICON: Record<Tone, IconName> = { correct: 'checkmark-circle', almost: 'alert-circle', wrong: 'close-circle', info: 'information-circle' };
const TONE_TITLE: Record<Tone, string> = { correct: 'Nailed it!', almost: 'Almost there', wrong: 'Not yet', info: 'Good to know' };

/** The colors and words of an answer state, for screens that draw their own (e.g. a grade card). */
export function toneOf(tone: Tone) {
  return { ...color.feedback[tone], name: TONE_ICON[tone], title: TONE_TITLE[tone] };
}

/** The right / almost / wrong / info card under an answer. Same look in every question format. */
export function Feedback({ tone, title, children, style }: { tone: Tone; title?: string; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = color.feedback[tone];
  return (
    <Surface kind={tone} gap={2} style={style}>
      <Row>
        <Ionicons name={TONE_ICON[tone]} size={size.icon.lg} color={t.icon} />
        <T v="title" style={{ color: t.text }}>
          {title ?? TONE_TITLE[tone]}
        </T>
      </Row>
      {typeof children === 'string' ? <T style={{ color: color.text.primary }}>{children}</T> : children}
    </Surface>
  );
}

/**
 * One labeled part of an answer card: "What's missing", "The answer". A hairline in the card's color sits above
 * every part but the first, so the card reads as short, separate pieces instead of one block of text.
 */
export function FeedbackPart({ tone, label, first, children }: { tone: Tone; label: string; first?: boolean; children: React.ReactNode }) {
  const t = color.feedback[tone];
  return (
    <View style={{ gap: S[1], ...(first ? null : { borderTopWidth: 1, borderColor: t.border, paddingTop: S[2] }) }}>
      <T v="label" style={{ color: t.text }}>
        {label}
      </T>
      {typeof children === 'string' ? (
        <T v="bodyLg" auto style={{ color: color.text.primary }}>
          {children}
        </T>
      ) : (
        children
      )}
    </View>
  );
}

/**
 * A sentence written out again with its right words: the words the student got wrong are shown in green (the
 * right word, highlighted), the ones they got right in plain bold. Used after fill-the-gaps.
 *   parts: the sentence in pieces; a gap has `gap` (its number) · marks: right / wrong for each gap
 */
export function FixedSentence({ parts, marks }: { parts: { t: string; gap?: number }[]; marks: boolean[] }) {
  const all = parts.map((p) => p.t).join('');
  const fix = color.feedback.correct;
  return (
    <T v="bodyLg" style={[{ color: color.text.primary }, autoDir(all)]}>
      {parts.map((p, i) =>
        p.gap === undefined ? (
          p.t
        ) : marks[p.gap] ? (
          <T key={i} v="bodyLg" style={{ fontFamily: font.semi, color: color.text.primary }}>
            {p.t}
          </T>
        ) : (
          <T key={i} v="bodyLg" style={{ fontFamily: font.semi, color: fix.text, backgroundColor: fix.picked }}>
            {` ${p.t} `}
          </T>
        ),
      )}
    </T>
  );
}

/**
 * The colors of one answer tile (a word in fill-the-gaps, a card in sort / order / match):
 *   idle: not touched · picked: chosen, not checked yet · correct / wrong: after checking.
 */
export function answerTile(state: 'idle' | 'picked' | 'correct' | 'almost' | 'wrong'): ViewStyle {
  if (state === 'idle') return { backgroundColor: color.surface.card, borderColor: color.border.strong };
  if (state === 'picked') return { backgroundColor: color.selected.bg, borderColor: color.selected.border };
  return { backgroundColor: color.feedback[state].bg, borderColor: color.feedback[state].border };
}

/* ---------- Badges ---------- */
type BadgeTone = 'brand' | 'gold' | 'neutral' | 'dark' | Tone;
// a badge is a tint and a word: no outline (the tint already separates it from the card)
const BADGE: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
  brand: { bg: color.feedback.correct.picked, fg: color.feedback.correct.text, border: color.feedback.correct.picked },
  correct: { bg: color.feedback.correct.picked, fg: color.feedback.correct.text, border: color.feedback.correct.picked },
  almost: { bg: color.feedback.almost.picked, fg: color.feedback.almost.text, border: color.feedback.almost.picked },
  wrong: { bg: color.feedback.wrong.picked, fg: color.feedback.wrong.text, border: color.feedback.wrong.picked },
  info: { bg: color.feedback.info.picked, fg: color.feedback.info.text, border: color.feedback.info.picked },
  gold: { bg: color.game.reward, fg: color.feedback.almost.text, border: color.game.reward },
  neutral: { bg: color.surface.muted, fg: color.text.body, border: color.surface.muted },
  dark: { bg: color.text.brand, fg: color.text.onAction, border: color.text.brand },
};

/** A small status pill: "Full session", "COCO ASKS", "Strong recall", "save 33%". */
export function Badge({ text, tone = 'brand', icon, caps, style }: { text: string; tone?: BadgeTone; icon?: IconName; caps?: boolean; style?: StyleProp<ViewStyle> }) {
  const b = BADGE[tone];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: S[1], alignSelf: 'flex-start', backgroundColor: b.bg, borderWidth: 1, borderColor: b.border, borderRadius: radius.pill, paddingHorizontal: S[2.5], paddingVertical: S[0.5] + 1 }, style]}>
      {icon && <Ionicons name={icon} size={size.icon.xs} color={b.fg} />}
      <T v="micro" style={{ color: b.fg, textTransform: caps ? 'uppercase' : undefined, letterSpacing: caps ? 0.5 : 0 }}>
        {text}
      </T>
    </View>
  );
}

/* ---------- Segmented toggle ---------- */
/** Two to four options in one track: "Speak / Write", "Monthly / Yearly". One white thumb slides under the
 *  picked option (it is always there, so it never flickers or loses its corners on Android). Labels stay on one line. */
export function Segmented<K extends string | number | boolean>({
  options,
  value,
  onChange,
  disabled,
  role = 'tab',
  height = layout.tapMin,
  style,
}: {
  options: { key: K; label: string; icon?: IconName; badge?: string; badgeTone?: BadgeTone }[];
  value: K;
  onChange: (k: K) => void;
  disabled?: boolean;
  /** 'radio' for a setting (answer length), 'tab' when it switches what is shown */
  role?: 'tab' | 'radio';
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const PAD = S[1];
  const [w, setW] = React.useState(0);
  const reduce = useReducedMotion();
  const i = Math.max(0, options.findIndex((o) => o.key === value));
  const seg = w > 0 ? (w - PAD * 2) / options.length : 0;
  const x = useSharedValue(0);
  const placed = React.useRef(false);
  React.useEffect(() => {
    if (!seg) return;
    // the first placement is instant; after that the thumb glides to the new option
    x.value = !placed.current || reduce ? i * seg : withSpring(i * seg, motion.spring.slide);
    placed.current = true;
  }, [i, seg, reduce, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ flexDirection: 'row', backgroundColor: color.bg.sunken, borderRadius: radius.lg, padding: PAD, opacity: disabled ? 0.6 : 1 }, style]}
      accessibilityRole={role === 'radio' ? 'radiogroup' : 'tablist'}>
      {seg > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: PAD, left: PAD, width: seg, height, borderRadius: radius.md, backgroundColor: color.surface.card, ...shadow.lift }, thumb]}
        />
      )}
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={String(o.key)}
            disabled={disabled}
            accessibilityRole={role}
            accessibilityState={role === 'radio' ? { checked: on } : { selected: on }}
            onPress={() => {
              if (!on) tap('select');
              onChange(o.key);
            }}
            style={{ flex: 1, minWidth: 0, height, flexDirection: 'row', gap: S[1.5], alignItems: 'center', justifyContent: 'center', paddingHorizontal: S[2] }}>
            {o.icon && <Ionicons name={o.icon} size={size.icon.sm} color={on ? color.text.brand : color.text.muted} />}
            <T v="subhead" numberOfLines={1} style={{ flexShrink: 1, color: on ? color.text.primary : color.text.muted }}>
              {o.label}
            </T>
            {o.badge && <Badge text={o.badge} tone={o.badgeTone ?? 'gold'} style={{ alignSelf: 'center', flexShrink: 0 }} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Text field ---------- */
/** The one text input. Arabic and English both read the right way round (direction follows what's typed). */
export function Field({ label, hint, error, style, multiline, value, onFocus, onBlur, ...rest }: TextInputProps & { label?: string; hint?: string; error?: string }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: S[1.5] }}>
      {label && <T v="label">{label}</T>}
      <TextInput
        {...rest}
        value={value}
        onFocus={(e) => (setFocused(true), onFocus?.(e))}
        onBlur={(e) => (setFocused(false), onBlur?.(e))}
        multiline={multiline}
        placeholderTextColor={color.text.subtle}
        style={[
          {
            minHeight: multiline ? 110 : size.button.lg,
            backgroundColor: color.surface.card,
            borderRadius: radius.lg,
            borderWidth: 1.5,
            borderColor: error ? color.feedback.wrong.icon : focused ? color.border.focus : color.border.strong,
            paddingHorizontal: S[3.5],
            paddingVertical: S[3],
            fontFamily: font.regular,
            fontSize: 16,
            lineHeight: 22,
            color: color.text.primary,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          autoDir(value),
          style,
        ]}
      />
      {(error || hint) && (
        <T v="caption" style={{ color: error ? color.text.danger : color.text.muted }}>
          {error || hint}
        </T>
      )}
    </View>
  );
}

/* ---------- Lists ---------- */
/** A rounded tile holding one icon (settings rows, chapter rows, plan features). */
export function IconTile({ name, tone = 'brand', sz = 'sm' }: { name: IconName; tone?: 'brand' | 'teal' | 'danger' | 'muted'; sz?: 'sm' | 'md' }) {
  const d = size.iconTile[sz];
  const look =
    tone === 'teal'
      ? { bg: color.text.brand, fg: color.text.onAction }
      : tone === 'danger'
        ? { bg: color.feedback.wrong.bg, fg: color.text.danger }
        : tone === 'muted'
          ? { bg: color.feedback.info.picked, fg: color.text.brand }
          : { bg: color.selected.bg, fg: color.text.brand };
  return (
    <View style={{ width: d, height: d, borderRadius: sz === 'md' ? radius.md : 10, backgroundColor: look.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={sz === 'md' ? size.icon.lg : size.icon.md} color={look.fg} />
    </View>
  );
}

/** One row of a settings-style list. Put several inside <ListGroup>. */
export function ListRow({
  label,
  sub,
  value,
  icon,
  leading,
  trailing,
  danger,
  selected,
  onPress,
  last,
}: {
  label: string;
  sub?: string;
  value?: string;
  icon?: IconName;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  danger?: boolean;
  /** a checkmark row in a pick-one list */
  selected?: boolean;
  onPress?: () => void;
  last?: boolean;
}) {
  const hasLead = !!(leading || icon);
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: S[3.5], paddingHorizontal: S[4], paddingVertical: S[3] }, pressed && { backgroundColor: color.bg.sunken }]}>
      {leading ?? (icon && <IconTile name={icon} tone={danger ? 'danger' : 'brand'} />)}
      <View style={{ flex: 1, gap: S[0.5] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S[2.5] }}>
          <T v="title" style={{ fontFamily: font.medium, color: danger ? color.text.danger : color.text.primary }}>
            {label}
          </T>
          <View style={{ flex: 1 }} />
          {!!value && (
            <T numberOfLines={1} style={{ flexShrink: 1, color: color.text.muted }}>
              {value}
            </T>
          )}
        </View>
        {!!sub && <T v="bodySm" style={{ color: color.text.muted }}>{sub}</T>}
      </View>
      {trailing ??
        (selected !== undefined ? (
          selected ? <Ionicons name="checkmark" size={20} color={color.text.brand} /> : <View style={{ width: 20 }} />
        ) : (
          onPress && !danger && <Ionicons name={dirIcon('chevron-forward')} size={size.icon.md} color={color.text.subtle} />
        ))}
      {!last && <View style={{ position: 'absolute', bottom: 0, end: 0, start: hasLead ? 64 : 16, height: 1, backgroundColor: color.border.subtle }} />}
    </Pressable>
  );
}

/** A white card holding list rows, with an optional label above it. */
export function ListGroup({ label, children, style }: { label?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: S[2] }, style]}>
      {label && <SectionLabel text={label} />}
      <Surface kind="card" pad={0} style={{ overflow: 'hidden' }}>
        {children}
      </Surface>
    </View>
  );
}

/* ---------- Headings ---------- */
/** "Talk it through with Coco": the small label above a group (sentence case), with an optional action on the end. */
export function SectionLabel({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <Row justify="space-between" style={{ paddingHorizontal: S[1] }}>
      <T v="label">{text}</T>
      {action && onAction && (
        <Pressable onPress={() => (tap(), onAction())} hitSlop={8}>
          <T v="subhead" style={{ color: color.text.brand }}>
            {action}
          </T>
        </Pressable>
      )}
    </Row>
  );
}

/** A tab's big title with up to a few icon actions on the end (Coco, Profile…). */
export function ScreenTitle({ title, sub, actions }: { title: string; sub?: string; actions?: { icon: IconName; label: string; onPress: () => void }[] }) {
  return (
    <Row justify="space-between" align="flex-start">
      <View style={{ flex: 1, gap: S[1] }}>
        <T v="h2">{title}</T>
        {sub && <T style={{ color: color.text.muted }}>{sub}</T>}
      </View>
      {actions?.map((a) => (
        <Pressable
          key={a.label}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          onPress={() => (tap(), a.onPress())}
          hitSlop={8}
          style={{ width: layout.tapMin, height: layout.tapMin, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface.muted }}>
          <Ionicons name={a.icon} size={size.icon.md} color={color.text.brand} />
        </Pressable>
      ))}
    </Row>
  );
}

/* ---------- Game pieces ---------- */
/** One number with its name: "31 day streak", "120 XP", "4 cards due". */
export function StatTile({ value, label, icon, gold, style }: { value: string | number; label: string; icon?: React.ReactNode; gold?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { flex: 1, alignItems: 'center', gap: S[1], padding: S[2.5], borderRadius: radius.lg, backgroundColor: gold ? color.game.reward : color.surface.muted },
        style,
      ]}>
      {icon}
      <T v="number" style={{ color: color.text.primary }}>
        {value}
      </T>
      <T v="caption" style={{ color: color.text.muted, textAlign: 'center' }}>
        {label}
      </T>
    </View>
  );
}

/** Nothing here yet: Coco, one line of why, and the one thing to do about it. */
export function EmptyState({ coco, title, body, action, onAction }: { coco?: ImageSource | number; title: string; body?: string; action?: string; onAction?: () => void }) {
  return (
    <Stack gap={3} align="center" pad={6}>
      {coco !== undefined && <Coco src={coco} size={120} />}
      <T v="h3" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {body && <T style={{ textAlign: 'center', color: color.text.muted }}>{body}</T>}
      {action && onAction && <Btn title={action} kind="leaf" height={size.button.md} onPress={onAction} style={{ alignSelf: 'stretch' }} />}
    </Stack>
  );
}

/* ---------- Recall ---------- */
/**
 * What a memory hook is for: the answer to remember, big, with the question it answers above it in small type.
 * `compact` (while the student types): only the answer, on two lines at most, so the writing has the room.
 */
export function RecallCard({ q, a, compact, style }: { q: string; a: string; compact?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Surface kind="sunken" pad={3} gap={1} style={style}>
      {!compact && (
        <T v="caption" auto numberOfLines={3}>
          {q}
        </T>
      )}
      <Row gap={1.5} align="flex-start">
        <Ionicons name="bookmark" size={size.icon.sm} color={color.text.brand} style={{ marginTop: 4 }} />
        <T v="subhead" auto numberOfLines={compact ? 2 : 6} style={{ flex: 1, color: color.text.primary }}>
          {a}
        </T>
      </Row>
    </Surface>
  );
}

/* ---------- Sheets ---------- */
/** The bottom sheet: a scrim you can tap to close, a grab handle, a title and anything under it. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: color.overlay.scrim, justifyContent: 'flex-end' }}>
        <Pressable style={{ ...shadow.sheet, backgroundColor: color.bg.raised, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: layout.gutter, paddingTop: S[2.5], paddingBottom: S[8] + S[1], gap: S[3.5] }}>
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: radius.xs, backgroundColor: color.surface.track }} />
          {title && (
            <T v="h3" style={{ textAlign: 'center' }}>
              {title}
            </T>
          )}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------- Pictures ---------- */
/** A clay picture (icons from assets/art) at one of the standard sizes. */
export function ClayIcon({ src, sz = 34 }: { src: ImageSource | number; sz?: number }) {
  return <Image source={src} style={{ width: sz, height: sz }} contentFit="contain" />;
}

/* ---------- Lecture pictures ---------- */
/** A picture from the student's lecture (a diagram, an automaton, a chart, a table…) shown with a question.
 *  A flat card you can tap: the picture opens full screen, where it can be pinched and moved.
 *  `ratio`: width / height, when known (otherwise it is read from the picture once it loads). */
export function Figure({ source, ratio, style }: { source: ImageSource | string | number; ratio?: number; style?: StyleProp<ViewStyle> }) {
  const [open, setOpen] = React.useState(false);
  const [found, setFound] = React.useState<number>();
  const r = Math.max(0.6, Math.min(2.4, ratio ?? found ?? 4 / 3)); // very tall or very wide pictures stay readable
  return (
    <>
      <Pressable
        onPress={() => (tap('select'), setOpen(true))}
        accessibilityRole="imagebutton"
        accessibilityLabel="Picture from your lecture. Double tap to open it full screen."
        style={({ pressed }) => [{ transform: [{ scale: pressed ? motion.pressScale : 1 }] }, style]}>
        <Surface kind="card" pad={2} gap={1.5}>
          <Image
            source={source}
            style={{ width: '100%', aspectRatio: r, borderRadius: radius.md }}
            contentFit="contain"
            onLoad={(e) => !ratio && e.source.height > 0 && setFound(e.source.width / e.source.height)}
          />
          <Row gap={1} justify="center">
            <Ionicons name="expand-outline" size={size.icon.sm} color={color.text.muted} />
            <T v="caption" style={{ color: color.text.muted }}>
              Tap to see it bigger
            </T>
          </Row>
        </Surface>
      </Pressable>
      <FigureViewer source={source} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** A picture full screen on a dark backdrop: pinch to zoom, drag to move, double tap to zoom in or back out. */
export function FigureViewer({ source, visible, onClose }: { source: ImageSource | string | number; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const start = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const settle = (to: number) => {
    'worklet';
    const t = { duration: reduce ? 0 : motion.result };
    scale.value = withTiming(to, t);
    if (to === 1) {
      x.value = withTiming(0, t);
      y.value = withTiming(0, t);
    }
  };
  const pinch = Gesture.Pinch()
    .onStart(() => {
      start.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.8, Math.min(5, start.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1) settle(1);
    });
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      sx.value = x.value;
      sy.value = y.value;
    })
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      x.value = sx.value + e.translationX;
      y.value = sy.value + e.translationY;
    });
  const twice = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => settle(scale.value > 1 ? 1 : 2.5));
  const look = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));
  const close = () => {
    scale.set(1);
    x.set(0);
    y.set(0);
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.overlay.viewer }}>
        <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, twice)}>
          <Animated.View style={[{ flex: 1, paddingTop: insets.top + S[12], paddingBottom: insets.bottom + S[8], paddingHorizontal: S[2] }, look]}>
            <Image source={source} style={{ flex: 1 }} contentFit="contain" accessibilityLabel="Picture from your lecture" />
          </Animated.View>
        </GestureDetector>
        <Pressable
          onPress={() => (tap(), close())}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close the picture"
          style={{ position: 'absolute', top: insets.top + S[2], end: layout.gutter, width: layout.tapMin, height: layout.tapMin, borderRadius: radius.pill, backgroundColor: color.overlay.viewerButton, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={size.icon.lg} color={color.text.onAction} />
        </Pressable>
        <T v="caption" style={{ position: 'absolute', bottom: insets.bottom + S[3], alignSelf: 'center', color: color.overlay.onDark }}>
          Pinch to zoom · double tap to zoom in
        </T>
      </GestureHandlerRootView>
    </Modal>
  );
}
