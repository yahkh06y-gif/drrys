// Drrys design tokens: the one source for every color, size, space, corner, depth and motion in the app.
//
// Three layers (the way Material, Polaris and Duolingo's own system are built):
//   1. palette  : the raw garden colors, named after what they are (leaf, pine, bark, soil, sun, berry, sky).
//                 Screens never use these directly.
//   2. color    : what a color is FOR (text, surface, border, action, feedback…). Screens use these.
//   3. components (src/design/*.tsx) read the semantic tokens, so a whole look changes in one place.
//
// Every value here was taken from the screens as they are today (theme.ts, ui.tsx and the most used
// literals), so moving a screen onto the tokens doesn't change how it looks.

/* ---------- 1. Palette (raw colors) ---------- */
export const palette = {
  // leaf: the brand green, the tree's crown and every "go" action
  leaf50: '#F3F8EA',
  leaf100: '#F0F8E6',
  leaf150: '#E3F1D6',
  leaf200: '#E3EED9',
  leaf300: '#B9DB8C',
  leaf400: '#8EB563',
  leaf500: '#78A83B',
  leaf550: '#7A9C3E',
  leaf600: '#6C8C38',
  leaf700: '#546E2A',
  leaf750: '#4E6D26',
  leaf800: '#4F6F28',
  leaf900: '#3F5920',
  lime: '#BEF37F',

  // pine: the deep teal of titles, primary buttons and Coco's voice
  pine50: '#EAF3F1',
  pine100: '#DCE9E6',
  pine400: '#2F8476',
  pine500: '#216664',
  pine600: '#0E5E53',
  pine700: '#006A62',

  // bark: outlines, the trunk, the clay edges
  bark300: '#835B3F',
  bark400: '#7D4815',
  bark500: '#5A3C20',
  bark600: '#4A3319',
  bark700: '#4A2810',
  bark900: '#241911',

  // soil: the warm paper the whole app is printed on
  soil0: '#FFFFFF',
  soil50: '#FDFCF7',
  soil100: '#FCF9F1',
  soil150: '#FBF9F4',
  soil200: '#FBF8F1',
  soil300: '#F7F2E8',
  soil400: '#F6F3EB',
  soil500: '#F1EEE6',
  soil600: '#EBE8E0',
  soil700: '#EDE7D8',
  soil800: '#E5E2DA',
  soil900: '#DED9CB',

  // ink: text
  ink900: '#2B1B10',
  ink700: '#3F4946',
  ink500: '#6E5D4F',
  ink400: '#7A6A5D',

  // sun: XP, streaks, rewards, "almost there"
  sun100: '#FFF6E3',
  sun150: '#FFF3DC',
  sun200: '#FDE9C4',
  sun300: '#DEC48C',
  sun400: '#F4B266',
  sun500: '#F0A63A',
  sun600: '#E08A00',
  sun700: '#B86A00',
  sun900: '#4B3A0F',

  // berry: mistakes, warnings, recording
  berry100: '#FFF1EC',
  berry150: '#FDECEA',
  berry300: '#F2A58A',
  berry400: '#E8998B',
  berry500: '#E56B6B',
  berry600: '#D9573B',
  berry700: '#C2452B',
  berry800: '#9B2C2C',
  ember: '#BD561D', // the orange of "danger" rows and the reward card

  // sky: the world around the tree
  sky100: '#BEE6F2',
  sky200: '#BDE3F2',
  sky400: '#8FC9EC',
  sky500: '#5FB8DA',
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
    app: p.soil300, // the cream page behind most screens
    raised: p.soil100, // sheets, dialogs, the tab bar
    sunken: p.soil400, // text inputs, wells, segmented tracks
    sky: p.sky400, // behind the forest
    onboarding: p.pine400, // the first teal screens
  },
  surface: {
    card: p.soil0, // the white clay card
    cardWarm: p.soil150, // the bark-edged card (tree, stats)
    choice: p.soil200, // an onboarding answer
    choiceOn: p.soil700, // …when it's picked
    muted: p.soil500, // light buttons, icon buttons
    track: p.soil800, // progress tracks
  },
  text: {
    primary: p.ink900, // body titles, strong text
    body: p.ink700, // paragraphs
    muted: p.ink500, // secondary lines
    subtle: p.ink400, // hints, chevrons
    brand: p.pine600, // titles and Coco's words
    hero: p.leaf550, // the big green onboarding titles
    label: p.sun900, // small CAPS labels
    onAction: p.soil0, // on green / teal buttons
    danger: p.berry700,
  },
  border: {
    subtle: 'rgba(90,66,37,0.1)', // hairlines, dividers
    default: 'rgba(90,66,37,0.15)', // card outlines
    strong: 'rgba(90,66,37,0.2)',
    bark: p.bark700, // the bold brown edge of game cards
    clay: p.bark400, // onboarding choices, dialogs
    focus: p.pine600,
  },
  action: {
    primary: p.leaf500, // the main green "go" button
    primaryEdge: p.leaf750, // its 3D bottom edge
    leaf: p.leaf600,
    leafEdge: p.leaf700,
    teal: p.pine600,
    tealEdge: 'rgba(90,66,37,0.45)',
    quiet: p.soil500,
    quietEdge: 'rgba(90,66,37,0.25)',
    danger: p.ember,
  },
  // answer states: one set of colors for every question format, card and banner
  feedback: {
    correct: { bg: p.leaf100, border: p.leaf400, icon: p.leaf600, text: p.leaf800, picked: p.leaf150 },
    almost: { bg: p.sun150, border: p.sun500, icon: p.sun600, text: p.sun700, picked: p.sun100 },
    wrong: { bg: p.berry100, border: p.berry300, icon: p.berry600, text: p.berry700, picked: p.berry150 },
    info: { bg: p.pine50, border: p.pine100, icon: p.pine600, text: p.pine600, picked: p.pine50 },
  },
  game: {
    xp: p.sun300, // the gold of progress bars and XP
    streak: p.sun500,
    water: p.sky500,
    watered: '#DDEFC4',
    wateredEdge: p.leaf300,
    reward: p.sun200,
  },
  overlay: {
    scrim: 'rgba(24,36,28,0.4)', // behind sheets and dialogs
    scrimStrong: 'rgba(24,36,28,0.55)',
    shade: 'rgba(0,0,0,0.25)', // on top of videos ("Tap to skip")
  },
  shadow: 'rgba(90,66,37,0.35)',
} as const;

export type Tone = keyof typeof color.feedback;

/* ---------- Space (4-point grid) ---------- */
// S[3] = 12. Halves exist for the tight spots the screens already use (6, 10, 14).
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

/** page gutters: the 20 every screen uses on its sides */
export const layout = {
  gutter: S[5],
  sectionGap: S[6],
  maxContent: 520, // keeps a line readable on tablets and web
  tapMin: 44, // the smallest thing a finger should have to hit
} as const;

/* ---------- Corners ---------- */
export const radius = {
  xs: 4, // dots, thin bars
  sm: 8, // tiny chips
  md: 12, // icon tiles, inner wells
  lg: 16, // inputs, small cards, bark cards
  xl: 20, // the session/stat cards
  xxl: 24, // the main white clay card, dialogs
  sheet: 28, // the top of bottom sheets
  pill: 999,
} as const;

/* ---------- Clay depth (the 3D bottom edge) ---------- */
// Drrys' signature, like Duolingo's: things you can touch have a thicker bottom edge and sink when pressed.
export const depth = {
  none: 0,
  sm: 3, // icon buttons, chips
  md: 4, // cards, buttons
  lg: 6, // bark game cards
  press: 4, // how far a button sinks
} as const;

/* ---------- Type ---------- */
export const font = {
  bold: 'SpaceGrotesk_700Bold',
  semi: 'SpaceGrotesk_600SemiBold',
  medium: 'SpaceGrotesk_500Medium',
  regular: 'SpaceGrotesk_400Regular',
  mono: 'IosevkaCharon_700Bold', // numbers: timers, XP, prices, counters
  monoRegular: 'IosevkaCharon_400Regular',
} as const;

// One scale for the whole app (the screens used 24 different sizes; these 11 cover all of them).
export const type = {
  display: { fontFamily: font.bold, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  h1: { fontFamily: font.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  h2: { fontFamily: font.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  h3: { fontFamily: font.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  title: { fontFamily: font.bold, fontSize: 16, lineHeight: 22 },
  bodyLg: { fontFamily: font.medium, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: font.medium, fontSize: 14, lineHeight: 22 },
  bodySm: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: font.bold, fontSize: 11, lineHeight: 16, letterSpacing: 0.5, textTransform: 'uppercase' },
  micro: { fontFamily: font.bold, fontSize: 10, lineHeight: 14 },
  number: { fontFamily: font.mono, fontSize: 20, lineHeight: 24 },
} as const;
export type TypeStep = keyof typeof type;

/* ---------- Sizes ---------- */
export const size = {
  button: { lg: 56, md: 48, sm: 40 },
  icon: { xs: 12, sm: 14, md: 18, lg: 22, xl: 28 },
  iconTile: { sm: 34, md: 44 },
  avatar: { sm: 32, md: 48, lg: 72 },
} as const;

/* ---------- Motion ---------- */
export const motion = {
  instant: 60, // a button sinking
  fast: 120, // selections, toggles
  base: 220, // most changes
  slow: 420, // entrances (Enter)
  progress: 600, // progress bars filling
  bob: 1400, // Coco's idle bob, one way
  stagger: 70, // the gap between list items entering
  spring: { press: { damping: 12, stiffness: 400 }, pop: { damping: 14, stiffness: 220 } },
  pressScale: 0.96,
} as const;

export const opacity = { disabled: 0.55, pressed: 0.85, hint: 0.6 } as const;
