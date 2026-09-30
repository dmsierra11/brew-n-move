export const colors = {
  field: '#F3F4F1',
  card: '#FFFFFF',
  ink: '#1A1814',
  muted: '#706D66',
  line: '#DDDCD5',
  moss: '#315C47',
  mossSoft: '#DDE9E1',
  brass: '#A6844A',
  brassSoft: '#F1E8D5',
  oat: '#EBCB9A',
  sky: '#AFCED0',
  berry: '#B96D70',
  blocked: '#8C2F2F',
} as const;

export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displayExtra: 'BricolageGrotesque_800ExtraBold',
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
} as const;

export const typography = {
  hero: {
    fontFamily: fonts.displayExtra,
    fontSize: 74,
    lineHeight: 84,
    letterSpacing: -4,
  },
  display: {
    fontFamily: fonts.displayExtra,
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: -1.8,
  },
  title: {
    fontFamily: fonts.displayExtra,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
  },
  stat: {
    fontFamily: fonts.displayExtra,
    fontSize: 38,
    lineHeight: 40,
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 24,
  },
  action: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
} as const;

export type TypographyRole = keyof typeof typography;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
} as const;
