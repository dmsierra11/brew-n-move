import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { floatingTabBarClearance } from '../../components/FloatingTabBar';
import { AppText } from '../../components/AppText';
import { colors, radii, spacing } from '../../theme/tokens';

function DiscoverIllustration() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.artFrame}>
      <Svg height={148} viewBox="0 0 180 148" width={180}>
        <Path
          d="M18 118c28-34 52-52 72-54 22-2 42 12 72 54"
          fill="none"
          stroke={colors.mossSoft}
          strokeLinecap="round"
          strokeWidth={10}
        />
        <Path
          d="M34 108c22-26 40-40 56-41 18-1 34 10 56 41"
          fill="none"
          stroke={colors.moss}
          strokeLinecap="round"
          strokeWidth={3}
        />
        <Circle cx="90" cy="52" fill={colors.brassSoft} r="34" />
        <Circle cx="90" cy="52" fill={colors.brass} r="22" />
        <Path
          d="M90 38v28M79 49h22"
          stroke={colors.card}
          strokeLinecap="round"
          strokeWidth={3.2}
        />
        <Path
          d="M118 34c6-10 14-14 22-14M128 40c5-7 11-10 18-10"
          fill="none"
          stroke={colors.sky}
          strokeLinecap="round"
          strokeWidth={2.4}
        />
        <Path
          d="M48 70c-8 2-14 8-16 16"
          fill="none"
          stroke={colors.oat}
          strokeLinecap="round"
          strokeWidth={2.4}
        />
      </Svg>
    </View>
  );
}

export function DiscoverScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingBottom: floatingTabBarClearance(insets.bottom) }]}>
      <View style={styles.content}>
        <DiscoverIllustration />
        <AppText role="eyebrow" style={styles.comingSoon}>
          Coming soon
        </AppText>
        <AppText accessibilityRole="header" role="heading" style={styles.headline}>
          Good things are on the move.
        </AppText>
        <AppText role="body" style={styles.copy}>
          We’re bringing together coffee spots, wellness experiences and communities worth moving for.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.field,
    flex: 1,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  artFrame: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 168,
    justifyContent: 'center',
    marginBottom: spacing.xl,
    width: 196,
  },
  comingSoon: {
    color: colors.moss,
    marginBottom: spacing.sm,
  },
  headline: {
    color: colors.ink,
    textAlign: 'center',
  },
  copy: {
    color: colors.muted,
    marginTop: spacing.sm,
    maxWidth: 320,
    textAlign: 'center',
  },
});
