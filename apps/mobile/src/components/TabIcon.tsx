import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '../theme/tokens';

export type TabIconName = 'home' | 'rewards' | 'discover' | 'communities' | 'profile';

type TabIconProps = {
  color: string;
  focused: boolean;
  name: TabIconName;
};

export function TabIcon({ color, focused, name }: TabIconProps) {
  return (
    <Svg height={24} viewBox="0 0 24 24" width={24}>
      {name === 'home' ? (
        <>
          <Path
            d="M3.5 10.5 12 3.8l8.5 6.7v9H14v-5h-4v5H3.5z"
            fill={focused ? color : 'none'}
            stroke={color}
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
          {focused ? (
            <Path
              d="M7.2 9.4c1.4-1 3-1.5 4.8-1.5"
              stroke={colors.card}
              strokeLinecap="round"
              strokeWidth={1.4}
            />
          ) : null}
        </>
      ) : null}
      {name === 'rewards' ? (
        <>
          <Path
            d="M6 8.5h10v7.2a4.3 4.3 0 0 1-4.3 4.3h-1.4A4.3 4.3 0 0 1 6 15.7z"
            fill={focused ? color : 'none'}
            stroke={color}
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
          <Path
            d="M16 10h1.4a2.6 2.6 0 0 1 0 5.2H16M8.5 5.8c.2-1 1-1.7 2-2M12.5 5.8c.2-1 1-1.7 2-2"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth={1.8}
          />
        </>
      ) : null}
      {name === 'discover' ? (
        <>
          <Circle
            cx="12"
            cy="12"
            fill={focused ? color : 'none'}
            r="8.2"
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="m9.2 14.8 1.4-5.2 5.2-1.4-1.4 5.2z"
            fill={focused ? colors.card : color}
            stroke={focused ? colors.card : color}
            strokeLinejoin="round"
            strokeWidth={1.2}
          />
        </>
      ) : null}
      {name === 'communities' ? (
        <>
          <Circle cx="9" cy="9" fill={focused ? color : 'none'} r="3" stroke={color} strokeWidth={1.8} />
          <Circle cx="17" cy="10" fill="none" r="2.3" stroke={color} strokeWidth={1.6} />
          <Path
            d="M3.8 20c.2-3.2 2.2-5 5.2-5s5 1.8 5.2 5M14 15.3c3.4-.6 5.7 1 6.2 3.8"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth={1.8}
          />
        </>
      ) : null}
      {name === 'profile' ? (
        <>
          <Circle cx="12" cy="8" fill={focused ? color : 'none'} r="3.5" stroke={color} strokeWidth={1.8} />
          <Path
            d="M5.5 20c.3-4 2.7-6.2 6.5-6.2s6.2 2.2 6.5 6.2"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth={1.8}
          />
          {focused ? <Rect fill={colors.card} height="1.5" rx=".75" width="4" x="10" y="7.3" /> : null}
        </>
      ) : null}
    </Svg>
  );
}
