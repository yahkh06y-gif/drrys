// The shared building blocks that were still being rebuilt by hand on each screen: layout stacks, surfaces,
// answer feedback, badges, the segmented toggle, text fields, list rows, sheets, tiles and empty states.
// The older blocks (T, Btn, Card, Choice, Coco…) live in components/ui.tsx; '@/design' exports both.
import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import React from 'react';
import { Modal, Pressable, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { Btn, Coco, T } from '@/components/ui';
import { tap } from '@/lib/feedback';

import { autoDir, dirIcon } from './rtl';
import { color, depth, font, layout, radius, S, size, type Space, type Tone } from './tokens';

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
 *   card   : the white clay card with a soft bottom edge (default)
 *   bark   : the bold brown-edged game card (tree, stats, session cards)
 *   sunken : a well inside a card (inputs, quotes, the model answer)
 *   raised : paper-colored, for dialogs and sheets
 *   flat   : a hairline outline, no depth
 *   correct / almost / wrong / info : tinted with that answer state
 */
export function Surface({ kind = 'card', pad = 4, gap, children, style }: { kind?: SurfaceKind; pad?: Space; gap?: Space; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const base: ViewStyle = { padding: S[pad], gap: gap === undefined ? undefined : S[gap] };
  const look: ViewStyle =
    kind === 'card'
      ? { backgroundColor: color.surface.card, borderRadius: radius.xxl, borderWidth: 1, borderColor: color.border.strong, borderBottomWidth: depth.md }
      : kind === 'bark'
        ? { backgroundColor: color.surface.cardWarm, borderRadius: radius.lg, borderWidth: 2, borderColor: color.border.bark, borderBottomWidth: depth.lg }
        : kind === 'sunken'
          ? { backgroundColor: color.bg.sunken, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border.subtle }
          : kind === 'raised'
            ? { backgroundColor: color.bg.raised, borderRadius: radius.xxl, borderWidth: 2, borderColor: color.border.clay }
            : kind === 'flat'
              ? { backgroundColor: color.surface.card, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border.default }
              : { backgroundColor: color.feedback[kind].bg, borderRadius: radius.lg, borderWidth: 2, borderColor: color.feedback[kind].border, borderBottomWidth: depth.md };
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
 * The colors of one answer tile (a word in fill-the-gaps, a card in sort / order / match):
 *   idle: not touched · picked: chosen, not checked yet · correct / wrong: after checking.
 */
export function answerTile(state: 'idle' | 'picked' | 'correct' | 'almost' | 'wrong'): ViewStyle {
  if (state === 'idle') return { backgroundColor: color.surface.card, borderColor: color.border.strong };
  if (state === 'picked') return { backgroundColor: color.feedback.correct.picked, borderColor: color.action.leaf };
  return { backgroundColor: color.feedback[state].bg, borderColor: color.feedback[state].border };
}

/* ---------- Badges ---------- */
type BadgeTone = 'brand' | 'gold' | 'neutral' | 'dark' | Tone;
const BADGE: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
  brand: { bg: color.feedback.correct.bg, fg: color.feedback.correct.text, border: color.feedback.correct.border },
  correct: { bg: color.feedback.correct.bg, fg: color.feedback.correct.text, border: color.feedback.correct.border },
  almost: { bg: color.feedback.almost.bg, fg: color.feedback.almost.text, border: color.feedback.almost.border },
  wrong: { bg: color.feedback.wrong.bg, fg: color.feedback.wrong.text, border: color.feedback.wrong.border },
  info: { bg: color.feedback.info.bg, fg: color.feedback.info.text, border: color.feedback.info.border },
  gold: { bg: color.game.reward, fg: color.text.label, border: color.game.xp },
  neutral: { bg: color.surface.muted, fg: color.text.body, border: color.border.default },
  dark: { bg: color.action.teal, fg: color.text.onAction, border: color.action.teal },
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
/** Two to four options in one track: "Speak / Write", "Monthly / Yearly". */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { key: K; label: string; icon?: IconName; badge?: string }[];
  value: K;
  onChange: (k: K) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: color.bg.sunken, borderRadius: radius.lg, padding: S[1], borderWidth: 1, borderColor: color.border.strong }, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) tap('select');
              onChange(o.key);
            }}
            style={{
              flex: 1,
              minHeight: layout.tapMin,
              flexDirection: 'row',
              gap: S[1.5],
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.md,
              backgroundColor: on ? color.surface.card : 'transparent',
              borderWidth: on ? 1 : 0,
              borderColor: color.border.default,
            }}>
            {o.icon && <Ionicons name={o.icon} size={size.icon.sm} color={on ? color.action.leaf : color.text.body} />}
            <T v="caption" style={{ fontFamily: font.bold, color: on ? color.text.brand : color.text.body }}>
              {o.label}
            </T>
            {o.badge && <Badge text={o.badge} tone="gold" />}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Text field ---------- */
/** The one text input. Arabic and English both read the right way round (direction follows what's typed). */
export function Field({ label, hint, error, style, multiline, value, ...rest }: TextInputProps & { label?: string; hint?: string; error?: string }) {
  return (
    <View style={{ gap: S[1.5] }}>
      {label && <T v="label">{label}</T>}
      <TextInput
        {...rest}
        value={value}
        multiline={multiline}
        placeholderTextColor={color.text.subtle}
        style={[
          {
            minHeight: multiline ? 110 : size.button.md,
            backgroundColor: color.bg.sunken,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: error ? color.feedback.wrong.border : color.border.subtle,
            paddingHorizontal: S[3.5],
            paddingVertical: S[3],
            fontFamily: font.medium,
            fontSize: 15,
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
      ? { bg: color.action.teal, fg: color.text.onAction }
      : tone === 'danger'
        ? { bg: 'rgba(189,86,29,0.1)', fg: color.action.danger }
        : tone === 'muted'
          ? { bg: color.feedback.info.picked, fg: color.text.brand }
          : { bg: color.feedback.correct.picked, fg: color.text.brand };
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
          <T v="title" style={{ fontFamily: font.semi, color: danger ? color.action.danger : color.text.primary }}>
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
      {!last && <View style={{ position: 'absolute', bottom: 0, end: 0, start: hasLead ? 64 : 16, height: 1, backgroundColor: color.border.default }} />}
    </Pressable>
  );
}

/** A white card holding list rows, with an optional caps label above it. */
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
/** "TALK IT THROUGH WITH COCO": the small caps label above a group, with an optional action on the end. */
export function SectionLabel({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <Row justify="space-between" style={{ paddingHorizontal: S[1] }}>
      <T v="label">{text}</T>
      {action && onAction && (
        <Pressable onPress={() => (tap(), onAction())} hitSlop={8}>
          <T v="caption" style={{ fontFamily: font.bold, color: color.text.brand }}>
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
          style={{ width: layout.tapMin, height: layout.tapMin, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface.muted, borderWidth: 1, borderColor: color.border.default, borderBottomWidth: depth.sm }}>
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
        { flex: 1, alignItems: 'center', gap: S[1], padding: S[2.5], borderRadius: radius.xl - 2, backgroundColor: gold ? color.game.reward : 'rgba(239,231,214,0.95)', borderBottomWidth: depth.md, borderColor: color.border.strong },
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
      <T v="h3" style={{ color: color.text.brand, textAlign: 'center' }}>
        {title}
      </T>
      {body && <T style={{ textAlign: 'center', color: color.text.muted }}>{body}</T>}
      {action && onAction && <Btn title={action} kind="leaf" height={size.button.md} onPress={onAction} style={{ alignSelf: 'stretch' }} />}
    </Stack>
  );
}

/* ---------- Sheets ---------- */
/** The bottom sheet: a scrim you can tap to close, a grab handle, a title and anything under it. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: color.overlay.scrim, justifyContent: 'flex-end' }}>
        <Pressable style={{ backgroundColor: color.bg.raised, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: layout.gutter, paddingTop: S[2.5], paddingBottom: S[8] + S[1], gap: S[3.5] }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: color.surface.track }} />
          {title && (
            <T v="h3" style={{ color: color.text.brand, textAlign: 'center' }}>
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
