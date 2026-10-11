import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { dailyStepCap, getNextMilestone } from '../earning/milestones';
import { motionDurations } from '../../motion/presets';
import { colors, radii, spacing } from '../../theme/tokens';
import { formatNumber } from '../../utils/format';

function readCount(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function nextCopy(steps: number) {
  const next = getNextMilestone(steps);
  if (next) {
    const remaining = Math.max(0, next.steps - steps);
    return `You’re ${formatNumber(remaining)} steps from ${formatNumber(next.steps)}. Keep it up!`;
  }

  return `Daily cap reached at ${formatNumber(dailyStepCap)} steps. Extra steps still count.`;
}

export function ValidationSuccessScreen() {
  const params = useLocalSearchParams<{ delta?: string; steps?: string }>();
  const delta = readCount(params.delta);
  const steps = readCount(params.steps);
  const awarded = delta > 0;
  const reduceMotion = useReducedMotion();
  const appear = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    appear.value = reduceMotion ? 1 : withTiming(1, { duration: motionDurations.celebration });
  }, [appear, reduceMotion]);

  const appearStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: 10 * (1 - appear.value) }],
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.bubble}>
          <AppText role="body" style={styles.bubbleCopy}>
            {nextCopy(steps)}
          </AppText>
          <View style={styles.bubbleTail} />
        </View>

        <Animated.View style={[styles.moment, appearStyle]}>
          <View style={styles.steamMarks}>
            <View style={[styles.steamMark, styles.steamShort]} />
            <View style={styles.steamMark} />
            <View style={[styles.steamMark, styles.steamShort]} />
          </View>
          <AppText role="hero" style={styles.hero}>
            {awarded ? `+${formatNumber(delta)}` : formatNumber(steps)}
          </AppText>
          <AppText role="action" style={styles.unit}>
            {awarded ? 'Brew Points' : 'steps'}
          </AppText>
          {awarded ? null : (
            <AppText role="caption" style={styles.alreadyCounted}>
              This milestone is already counted.
            </AppText>
          )}
        </Animated.View>

        <PillButton
          appearance="primary"
          fullWidth
          label="Continue"
          onPress={() => router.back()}
          size="large"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.field,
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  bubble: {
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    maxWidth: 320,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bubbleCopy: {
    color: colors.ink,
    textAlign: 'center',
  },
  bubbleTail: {
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderBottomColor: colors.line,
    borderLeftColor: colors.line,
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderWidth: 1,
    bottom: -8,
    height: 14,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 14,
  },
  moment: {
    alignItems: 'center',
  },
  steamMarks: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 5,
    height: 12,
    marginBottom: spacing.sm,
  },
  steamMark: {
    backgroundColor: colors.brass,
    borderRadius: radii.pill,
    height: 12,
    transform: [{ rotate: '18deg' }],
    width: 3,
  },
  steamShort: {
    height: 7,
  },
  hero: {
    color: colors.ink,
  },
  unit: {
    color: colors.ink,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  alreadyCounted: {
    color: colors.muted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
