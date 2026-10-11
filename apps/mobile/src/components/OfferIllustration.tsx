import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { colors } from '../theme/tokens';

export type IllustrationKind = 'flat-white' | 'coffee-pastry' | 'lunch';

type OfferIllustrationProps = {
  height?: number;
  kind: IllustrationKind;
  width?: number;
};

const line = {
  fill: 'none',
  stroke: colors.ink,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: 2.2,
};

export function OfferIllustration({ height = 104, kind, width = 96 }: OfferIllustrationProps) {
  if (kind === 'flat-white') {
    return (
      <Svg height={height} viewBox="0 0 96 104" width={width}>
        <Path d="M9 83c12-10 22-9 31-2s19 9 34-3" stroke={colors.moss} strokeDasharray="3 6" strokeLinecap="round" strokeWidth="2.6" />
        <Circle cx="77" cy="76" fill={colors.brass} r="5" />
        <Ellipse cx="47" cy="53" fill={colors.card} rx="28" ry="22" stroke={colors.ink} strokeWidth="2.2" />
        <Ellipse cx="47" cy="51" fill={colors.brassSoft} rx="21" ry="15" />
        <Path d="M38 52c3-7 8-8 10-2 2-6 7-5 9 1-5 2-9 5-10 9-2-4-5-6-9-8Z" fill={colors.card} stroke={colors.brass} strokeLinejoin="round" strokeWidth="1.5" />
        <Path d="M67 45c12-1 14 16 3 19" {...line} />
        <Path d="M36 25c-5-7 5-9 0-16M48 23c-5-7 5-9 0-16M59 26c-5-7 5-9 0-16" {...line} />
      </Svg>
    );
  }

  if (kind === 'coffee-pastry') {
    return (
      <Svg height={height} viewBox="0 0 96 104" width={width}>
        <Path d="M7 82c18 5 25-12 39-8 14 4 20 14 41 6" stroke={colors.moss} strokeDasharray="3 6" strokeLinecap="round" strokeWidth="2.6" />
        <Circle cx="10" cy="82" fill={colors.brass} r="5" />
        <Path d="M20 37h29l-3 36H23z" fill={colors.card} stroke={colors.ink} strokeLinejoin="round" strokeWidth="2.2" />
        <Path d="M18 36h33M25 29h19l4 7H22z" fill={colors.sky} stroke={colors.ink} strokeLinejoin="round" strokeWidth="2.2" />
        <Rect fill={colors.brass} height="8" rx="4" width="16" x="27" y="47" />
        <Path d="M59 52c1-12 18-18 26-7-1 13-10 25-25 28-5-6-5-14-1-21Z" fill={colors.oat} stroke={colors.ink} strokeLinejoin="round" strokeWidth="2.2" />
        <Path d="M62 48c7 1 13 6 17 13M70 43c3 4 6 7 12 8M59 58c5 0 10 4 13 9" stroke={colors.card} strokeLinecap="round" strokeWidth="2" />
      </Svg>
    );
  }

  return (
    <Svg height={height} viewBox="0 0 96 104" width={width}>
      <Path d="M11 84c12-12 26-3 36-9 9-5 12-15 32-10" stroke={colors.moss} strokeDasharray="3 6" strokeLinecap="round" strokeWidth="2.6" />
      <Circle cx="80" cy="65" fill={colors.brass} r="5" />
      <Circle cx="45" cy="52" fill={colors.card} r="29" stroke={colors.ink} strokeWidth="2.2" />
      <Circle cx="45" cy="52" fill={colors.brassSoft} r="21" />
      <Path d="M28 51c8-9 20-11 33-4-6 12-17 18-31 12Z" fill={colors.moss} stroke={colors.ink} strokeLinejoin="round" strokeWidth="2" />
      <Path d="M30 51c10 2 19 1 30-4" stroke={colors.card} strokeLinecap="round" strokeWidth="2" />
      <Circle cx="38" cy="39" fill={colors.berry} r="5" stroke={colors.ink} strokeWidth="1.5" />
      <Path d="M38 34c0-4 3-6 6-6M68 17v15M62 23h12" {...line} />
    </Svg>
  );
}
