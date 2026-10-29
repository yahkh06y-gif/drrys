// Drrys design tokens, version 2: the one source for every color, size, space, corner, depth and motion.
//
// Three layers:
//   1. palette : six ramps (leaf, pine, neutral, sun, berry, sky), each numbered the same way:
//                50 = the lightest tint, 500 = the hue itself, 600 = text on white, 900 = the darkest ink.
//                Screens never use these directly.
//   2. color   : what a color is FOR (text, surface, border, action, feedback…). Screens use these.
//   3. components (src/design/*.tsx, components/ui.tsx) read the semantic tokens.
//
// Every text color here passes WCAG AA (4.5:1) on the surface it's meant for. Rules: src/design/README.md.
import { Easing } from 'react-native-reanimated';

/* ---------- 1. Palette ---------- */
export const palette = {
  // leaf: the one action color, success, growth. 500 is the brand green from Figma.
  leaf50: '#F2F7EA',
  leaf100: '#E3EFD2',
  leaf200: '#C9E0A8',
  leaf300: '#A8CB7A',
  leaf400: '#8DB858',
  leaf500: '#78A83B',
  leaf600: '#567F27',
  leaf700: '#446420',
  leaf800: '#334B19',
  leaf900: '#233411',

  // pine: brand ink, titles, links, focus, "selected". 600 is the brand teal.
  pine50: '#E8F2F0',
  pine100: '#CDE3DF',
  pine200: '#9CC7BF',
  pine300: '#67A79C',
  pine400: '#3A877A',
  pine500: '#1C7062',
  pine600: '#0E5E53',
  pine700: '#0B4B43',
  pine800: '#083932',
  pine900: '#052621',

  // neutral: paper and ink, tinted toward the bark of the tree. 50 is the app's cream page.
  neutral0: '#FFFFFF',
  neutral25: '#FCFAF5',
  neutral50: '#F7F2E8',
  neutral100: '#EFE9DC',
  neutral200: '#E2DACA',
  neutral300: '#CBBFA9',
  neutral400: '#A89A82',
  neutral500: '#85765F',
  neutral600: '#6E5D4F',
  neutral700: '#54443A',
  neutral800: '#3B2C22',
  neutral900: '#2B1B10',

  // bark: the trunk and the bold edge of the tree's game cards
  bark: '#4A2810',
  barkSoft: '#4A3319',

  // sun: XP, streaks, rewards, "almost there"
  sun50: '#FFF7E6',
  sun100: '#FDEBC4',
  sun200: '#F9D894',
  sun300: '#F4C46A',
  sun400: '#EFB244',
  sun500: '#E89F1C',
  sun600: '#C9800C',
  sun700: '#8F5300',
  sun800: '#6B3E00',

  // berry: mistakes, deleting, recording
  berry50: '#FDF0EC',
  berry100: '#FADBD2',
  berry200: '#F4BDAE',
  berry300: '#EE9E89',
  berry400: '#E47A60',
  berry500: '#D9573B',
  berry600: '#C2452B',
  berry700: '#A93A24',
  berry800: '#7E2B1B',

  // sky: information, water, the sky around the tree
  sky50: '#EAF5FB',
  sky100: '#D3EAF7',
  sky200: '#B4DCF2',
  sky300: '#8FC9EC',
  sky400: '#63B3DE',
  sky500: '#3E9CCB',
  sky600: '#2C83AE',
  sky700: '#1F6A90',
} as const;

const p = palette;

/** a color with some transparency: alpha('#000000', 0.4) */
export function alpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const n = parseInt(f.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ---------- 2. Semantic colors (use these in screens) ---------- */
export const color = {
  bg: {
    app: p.neutral50, // the cream page behind most screens
    raised: p.neutral25, // sheets, dialogs, the tab bar
    sunken: p.neutral100, // segmented tracks, wells
    sky: p.sky300, // behind the forest
    onboarding: p.pine400, // the first teal screens
  },
  surface: {
    card: p.neutral0, // a card you read (flat: hairline, no edge)
    cardWarm: p.neutral25, // the tree's bark-edged game card
    choice: p.neutral0, // an answer or option you can pick
    choiceOn: p.pine50, // …when it's picked
    muted: p.neutral100, // quiet buttons, icon buttons
    track: p.neutral200, // progress tracks
  },
  text: {
    primary: p.neutral900, // titles, strong text (14.9:1 on the page)
    body: p.neutral700, // paragraphs
    muted: p.neutral600, // secondary lines (5.6:1)
    subtle: p.neutral500, // placeholders, chevrons, meta (4.4:1 on white)
    brand: p.pine600, // brand titles, links, Coco's words (6.9:1)
    hero: p.leaf700, // the big green onboarding titles
    label: p.neutral600, // small section labels
    onAction: p.neutral0, // on the green button (4.7:1)
    danger: p.berry700,
  },
  border: {
    subtle: 'rgba(59,44,34,0.08)', // dividers inside a card
    default: 'rgba(59,44,34,0.12)', // the hairline of a flat card
    strong: p.neutral200, // inputs, choices, secondary buttons
    edge: p.neutral300, // the bottom edge of a pressable neutral thing
    bark: p.bark, // the tree's game cards
    focus: p.pine600,
  },
  action: {
    primary: p.leaf600, // the one main button
    primaryEdge: p.leaf800, // its 3D bottom edge
    secondary: p.neutral0,
    secondaryEdge: p.neutral300,
    secondaryText: p.pine600,
    danger: p.berry500,
    dangerEdge: p.berry700,
    disabled: p.neutral200,
    disabledText: p.neutral500,
  },
  // answer states: one set of colors for every question format, card and banner
  feedback: {
    correct: { bg: p.leaf50, border: p.leaf300, icon: p.leaf600, text: p.leaf800, picked: p.leaf100 },
    almost: { bg: p.sun50, border: p.sun300, icon: p.sun500, text: p.sun700, picked: p.sun100 },
    wrong: { bg: p.berry50, border: p.berry300, icon: p.berry500, text: p.berry700, picked: p.berry100 },
    info: { bg: p.sky50, border: p.sky200, icon: p.sky500, text: p.sky700, picked: p.sky100 },
  },
  selected: { bg: p.pine50, border: p.pine500, text: p.pine700 }, // picked, not checked yet
  game: {
    xp: p.sun400, // XP and rewards
    streak: p.sun500,
    progress: p.leaf500, // progress bars: the brand green, as a fill
    water: p.sky400,
    watered: p.leaf100,
    wateredEdge: p.leaf300,
    reward: p.sun100,
  },
  overlay: {
    scrim: 'rgba(43,27,16,0.32)', // behind sheets and dialogs
    scrimStrong: 'rgba(43,27,16,0.5)',
    shade: 'rgba(0,0,0,0.25)', // on top of videos ("Tap to skip")
    onDark: 'rgba(255,255,255,0.7)', // secondary marks on a dark or green surface
    viewer: 'rgba(23,15,9,0.94)', // behind a picture opened full screen (a lecture figure)
    viewerButton: 'rgba(255,255,255,0.16)', // the round close button on that dark backdrop
  },
  shadow: 'rgba(43,27,16,0.12)',
} as const;

export type Tone = keyof typeof color.feedback;

/* ---------- Space (4-point grid) ---------- */
// S[3] = 12. Halves exist for the tight spots (2, 6, 10, 14).
export const S = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
} as const;
export type Space = keyof typeof S;

export const layout = {
  gutter: S[5], // page sides
  sectionGap: S[8], // between sections of a screen
  maxContent: 520, // keeps a line readable on tablets and web
  tapMin: 44, // the smallest thing a finger should have to hit
} as const;

/* ---------- Corners ---------- */
export const radius = {
  xs: 4, // dots, thin bars
  sm: 8, // chips, keys
  md: 12, // icon tiles, inner wells
  lg: 16, // inputs, buttons, choices, cards
  xl: 20, // big cards
  xxl: 24, // dialogs
  sheet: 28, // the top of bottom sheets
  pill: 999,
} as const;

/* ---------- Depth ---------- */
// Depth means "you can press this". Three layers only:
//   press : a bottom edge that disappears when pressed (buttons, choices, the tree's chapter card)
//   flat  : a card you read: white, one hairline, no edge, no shadow
//   float : something above the page (sheets, popovers, dialogs): a soft, wide shadow
export const depth = {
  none: 0,
  sm: 3, // icon buttons, keys
  md: 4, // buttons, choices
  lg: 6, // the tree's bark game cards
  press: 4, // how far a button sinks
} as const;

export const shadow = {
  lift: { shadowColor: '#2B1B10', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, // the picked tab of a segmented toggle
  float: { shadowColor: '#2B1B10', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  sheet: { shadowColor: '#2B1B10', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 12 },
} as const;

/* ---------- Type ---------- */
// One family: Readex Pro (Arabic and Latin; built on Lexend, designed for reading ease).
export const font = {
  bold: 'ReadexPro_700Bold',
  semi: 'ReadexPro_600SemiBold',
  medium: 'ReadexPro_500Medium',
  regular: 'ReadexPro_400Regular',
  light: 'ReadexPro_300Light',
  // numbers (timers, XP, prices) use the same family with tabular figures (see type.number)
  mono: 'ReadexPro_600SemiBold',
  monoRegular: 'ReadexPro_400Regular',
} as const;

// Seven sizes, 12 to 32, plus `micro` (11) for badges only. Big headings are tightened (about -2%).
export const type = {
  display: { fontFamily: font.semi, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: font.semi, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  heading: { fontFamily: font.semi, fontSize: 19, lineHeight: 26, letterSpacing: -0.2 },
  reading: { fontFamily: font.regular, fontSize: 17, lineHeight: 28 }, // lectures, recalls, Coco's answers
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: font.medium, fontSize: 16, lineHeight: 24 },
  subhead: { fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: font.medium, fontSize: 11, lineHeight: 14 },
  number: { fontFamily: font.semi, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
} as const;
export type TypeStep = keyof typeof type;

/* ---------- Sizes ---------- */
export const size = {
  button: { lg: 52, md: 46, sm: 38 },
  icon: { xs: 12, sm: 14, md: 18, lg: 22, xl: 28 },
  iconTile: { sm: 34, md: 44 },
  avatar: { sm: 32, md: 48, lg: 72 },
} as const;

/* ---------- Motion ---------- */
// Ask first: how often does the student see it? Tabs (tens a day): no motion. Presses: 100ms.
// Results and sheets: 240-420ms. Watering, streaks, the end of a session: the whole celebration.
export const ease = {
  out: Easing.bezier(0.23, 1, 0.32, 1), // entering, pressing, results
  inOut: Easing.bezier(0.77, 0, 0.175, 1), // moving on screen (progress bars)
  drawer: Easing.bezier(0.32, 0.72, 0, 1), // sheets
} as const;

export const motion = {
  press: 100, // a button sinking
  fast: 120, // selections, toggles
  base: 240, // most changes, a sheet closing
  result: 280, // the answer panel sliding up
  sheet: 420, // a sheet opening
  enter: 260, // a screen's first entrance
  progress: 400, // progress bars filling
  bob: 1400, // Coco's idle bob, one way
  stagger: 50, // the gap between list items entering
  spring: {
    press: { damping: 20, stiffness: 500 },
    pop: { damping: 16, stiffness: 260 },
    /** a thumb or panel gliding into place: quick, no visible bounce */
    slide: { damping: 26, stiffness: 320, mass: 0.9 },
    /** something alive (the mic, a correct-answer pop): one small overshoot */
    bouncy: { damping: 11, stiffness: 220 },
  },
  pressScale: 0.98,
} as const;

export const opacity = { disabled: 1, pressed: 0.85, hint: 0.6 } as const;
