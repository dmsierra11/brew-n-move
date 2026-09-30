import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '../../theme/tokens';

export type CommunityIllustrationKind = 'canal' | 'park' | 'docklands';

type CommunityIllustrationProps = Readonly<{
  kind: CommunityIllustrationKind;
}>;

export function CommunityIllustration({ kind }: CommunityIllustrationProps) {
  if (kind === 'park') {
    return (
      <Svg height="100%" viewBox="0 0 360 180" width="100%">
        <Rect fill={colors.oat} height="180" width="360" />
        <Circle cx="290" cy="42" fill={colors.card} opacity={0.55} r="25" />
        <Path d="M0 146C72 109 124 164 190 126s101-28 170-6v60H0z" fill={colors.mossSoft} />
        <Path d="M135 180c24-42 43-65 91-83" fill="none" stroke={colors.card} strokeLinecap="round" strokeWidth="28" />
        <Path d="M49 123V73M28 83c15-37 30-42 43 0M306 130V68M280 83c17-45 38-50 53 0" fill="none" stroke={colors.moss} strokeLinecap="round" strokeWidth="10" />
        <Circle cx="205" cy="100" fill={colors.berry} r="9" />
        <Path d="m205 112-7 27m7-19 15 10m-19 9-12 20m9-20 14 19" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth="7" />
      </Svg>
    );
  }

  if (kind === 'docklands') {
    return (
      <Svg height="100%" viewBox="0 0 360 180" width="100%">
        <Rect fill={colors.berry} height="180" opacity={0.72} width="360" />
        <Circle cx="55" cy="45" fill={colors.card} opacity={0.45} r="27" />
        <Path d="M0 133c82-25 130 21 205-4s112-9 155 4v47H0z" fill={colors.sky} />
        <Path d="M40 124V65h54v59m20 0V44h75v80m23 0V76h48v48m22 0V57h44v67" fill={colors.card} opacity={0.72} />
        <Path d="M0 141c69-17 117 20 189 0s117-17 171 0" fill="none" stroke={colors.card} strokeLinecap="round" strokeWidth="8" />
        <Circle cx="244" cy="98" fill={colors.oat} r="8" />
        <Path d="m244 108-4 25m4-17 14 8m-18 9-12 21m12-21 13 19" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth="7" />
      </Svg>
    );
  }

  return (
    <Svg height="100%" viewBox="0 0 360 180" width="100%">
      <Rect fill={colors.sky} height="180" width="360" />
      <Circle cx="302" cy="42" fill={colors.card} opacity={0.55} r="24" />
      <Path d="M0 112c61 20 104-8 166 8s116 9 194-13v73H0z" fill={colors.moss} opacity={0.86} />
      <Path d="M0 133c66 19 107-12 169 5s116 9 191-14" fill="none" stroke={colors.card} strokeLinecap="round" strokeWidth="13" />
      <Path d="M34 105V65h58v43m181-1V56h53v43" fill={colors.card} opacity={0.7} />
      <Circle cx="176" cy="95" fill={colors.oat} r="9" />
      <Path d="m176 106 5 26m-3-18-14 9m17 9 13 18m-13-18-8 22" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth="7" />
      <Path d="M217 91c9-4 13-10 10-18m-1 18c10-5 15-13 12-23" fill="none" stroke={colors.card} strokeLinecap="round" strokeWidth="4" />
    </Svg>
  );
}
