// The old short names (C, F, R), kept so every existing screen works unchanged.
// They now come from the design system: src/design/tokens.ts. New code imports from '@/design' instead.
import { font, palette as p } from '@/design/tokens';

export const C = {
  // surfaces
  cream: p.soil300,
  paper: p.soil100,
  card: p.soil200,
  cardSelected: p.soil700,
  sand: p.soil500,
  track: p.soil800,
  white: p.soil0,

  // ink
  ink: p.ink900,
  teal: p.pine600,
  tealSoft: p.pine500,
  body: p.ink700,
  muted: p.ink500,
  mutedLight: p.ink400,
  gold: p.sun300,
  goldInk: p.sun900,

  // brand greens
  title: p.leaf550,
  green: p.leaf500,
  greenShadow: p.leaf750,
  leaf: p.leaf600,
  leafShadow: p.leaf700,
  moss: p.leaf800,
  mossDark: p.leaf900,
  lime: 'rgba(190,243,127,0.6)',
  limeInk: '#457005',
  mint: p.leaf200,
  mintBorder: p.leaf400,

  // browns
  brown: p.bark400,
  bark: p.bark700,
  barkSoft: p.bark600,
  line: 'rgba(90,66,37,0.15)',
  lineStrong: 'rgba(90,66,37,0.2)',
  shadow: 'rgba(90,66,37,0.35)',

  // status
  red: '#EF4444',
  orange: p.ember,
  amber: p.sun400,
  sky: p.sky200,
  tealBg: '#2E7D72',
} as const;

export const F = font;

export const R = { sm: 12, md: 16, lg: 22, xl: 24, pill: 999 } as const;
