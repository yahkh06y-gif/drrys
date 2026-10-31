// The old short names (C, F, R), kept so every existing screen works unchanged.
// They now come from the design system (v2): src/design/tokens.ts. New code imports from '@/design' instead.
import { alpha, color, font, palette as p } from '@/design/tokens';

export const C = {
  // surfaces
  cream: color.bg.app,
  paper: color.bg.raised,
  card: color.surface.choice,
  cardSelected: color.surface.choiceOn,
  sand: color.surface.muted,
  track: color.surface.track,
  white: p.neutral0,

  // ink
  ink: color.text.primary,
  teal: color.text.brand,
  tealSoft: p.pine500,
  body: color.text.body,
  muted: color.text.muted,
  mutedLight: color.text.subtle,
  gold: color.game.xp,
  goldInk: color.text.label,

  // brand greens (one green for every main button)
  title: color.text.hero,
  green: color.action.primary,
  greenShadow: color.action.primaryEdge,
  leaf: color.action.primary,
  leafShadow: color.action.primaryEdge,
  moss: p.leaf800,
  mossDark: p.leaf900,
  lime: alpha(p.leaf200, 0.6),
  limeInk: p.leaf700,
  mint: p.leaf100,
  mintBorder: p.leaf300,

  // browns
  brown: color.border.edge,
  bark: color.border.bark,
  barkSoft: p.barkSoft,
  line: color.border.default,
  lineStrong: color.border.strong,
  shadow: color.shadow,

  // status
  red: p.berry500,
  orange: p.berry600,
  amber: p.sun400,
  sky: p.sky200,
  tealBg: p.pine500,
} as const;

// Readex Pro tops out at 600 on screen: "bold" is the semi-bold cut, so headings stay calm.
export const F = { ...font, bold: font.semi } as const;

export const R = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 } as const;
