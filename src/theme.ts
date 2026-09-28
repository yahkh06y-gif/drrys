// Design tokens pulled from the Drrys Figma file ("full app" section).
export const C = {
  // surfaces
  cream: '#F7F2E8',
  paper: '#FCF9F1',
  card: '#FBF8F1',
  cardSelected: '#EDE7D8',
  sand: '#F1EEE6',
  track: '#E5E2DA',
  white: '#FFFFFF',

  // ink
  ink: '#2B1B10',
  teal: '#0E5E53',
  tealSoft: '#216664',
  body: '#3F4946',
  muted: '#6E5D4F',
  mutedLight: '#7A6A5D',
  gold: '#DEC48C',
  goldInk: '#4B3A0F',

  // brand greens
  title: '#7A9C3E',
  green: '#78A83B',
  greenShadow: '#4E6D26',
  leaf: '#6C8C38',
  leafShadow: '#546E2A',
  moss: '#4F6F28',
  mossDark: '#3F5920',
  lime: 'rgba(190,243,127,0.6)',
  limeInk: '#457005',
  mint: '#E3EED9',
  mintBorder: '#8EB563',

  // browns
  brown: '#7D4815',
  bark: '#4A2810',
  barkSoft: '#4A3319',
  line: 'rgba(90,66,37,0.15)',
  lineStrong: 'rgba(90,66,37,0.2)',
  shadow: 'rgba(90,66,37,0.35)',

  // status
  red: '#EF4444',
  orange: '#BD561D',
  amber: '#F4B266',
  sky: '#BDE3F2',
  tealBg: '#2E7D72',
} as const;

export const F = {
  bold: 'SpaceGrotesk_700Bold',
  semi: 'SpaceGrotesk_600SemiBold',
  medium: 'SpaceGrotesk_500Medium',
  regular: 'SpaceGrotesk_400Regular',
  mono: 'IosevkaCharon_700Bold',
  monoRegular: 'IosevkaCharon_400Regular',
} as const;

export const R = { sm: 12, md: 16, lg: 22, xl: 24, pill: 999 } as const;
