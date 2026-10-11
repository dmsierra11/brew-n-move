import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import {
  dailyPointCap,
  dailyStepCap,
  getNextMilestone,
  getReachedMilestone,
  pointsForSteps,
} from '../earning/milestones';
import { useHealth } from '../health/HealthProvider';
import { healthPlatformName } from '../health/platform';
import { MilestoneTrack } from './MilestoneTrack';
import { ValidateSwipe } from './ValidateSwipe';
import { useTodayValidation } from './useTodayValidation';
import type { HealthAccessStatus } from '../health/types';
import { motionDurations, motionEasings } from '../../motion/presets';
import { colors, radii, spacing } from '../../theme/tokens';
import { formatNumber } from '../../utils/format';

function connectCopy(status: HealthAccessStatus) {
  if (status === 'unavailable') {
    return `Install or enable ${healthPlatformName} to read this phone’s step total.`;
  }

  if (status === 'denied') {
    return `Turn on step access in ${healthPlatformName} to show today’s total.`;
  }

  return `Connect ${healthPlatformName} to show today’s verified steps.`;
}

function ConnectCard({
  loading,
  onConnect,
  status,
}: Readonly<{
  loading: boolean;
  onConnect: () => void;
  status: HealthAccessStatus;
}>) {
  const needsSettings = status === 'denied' || status === 'unavailable';

  return (
    <View style={styles.hero}>
      <AppText role="caption" style={styles.heroLabel}>{healthPlatformName}</AppText>
      <AppText role="heading" style={styles.connectTitle}>
        {status === 'unavailable'
          ? `${healthPlatformName} isn’t available`
          : 'Count today’s steps'}
      </AppText>
      <AppText role="caption" style={styles.connectCopy}>
        {connectCopy(status)}
      </AppText>
      {loading ? null : (
        <View style={styles.connectAction}>
          <PillButton
            accessibilityLabel={
              needsSettings
                ? `Open ${healthPlatformName} settings`
                : `Connect ${healthPlatformName}`
            }
            appearance="primary"
            label={needsSettings ? 'Open settings' : 'Connect'}
            onPress={onConnect}
          />
        </View>
      )}
    </View>
  );
}

function validationCopy(phase: ReturnType<typeof useTodayValidation>['phase'], overlaps: boolean) {
  if (phase.kind === 'awarded') {
    return `${formatNumber(phase.delta)} Brew Points added.`;
  }

  if (phase.kind === 'no_additional') {
    return 'No additional points for this milestone.';
  }

  if (phase.kind === 'day_closed') {
    return 'Today’s validation closed at midnight.';
  }

  if (phase.kind === 'day_overlap') {
    return 'This day overlaps one you already validated, so it can’t add Brew Points.';
  }

  if (phase.kind === 'unconfirmed') {
    return 'Couldn’t confirm this validation. Swipe again to retry.';
  }

  if (phase.kind === 'rejected') {
    return 'Those steps could not be validated. Swipe again.';
  }

  if (overlaps) {
    return 'This day overlaps one you already validated, so it can’t add Brew Points.';
  }

  return null;
}

export function TodayScreen() {
  const { connect, loading, refresh, status, steps } = useHealth();
  const { claim, overlapsAnother, phase, resetKey, validate } = useTodayValidation();
  const connected = status === 'granted';
  const countProgress = useSharedValue(1);
  const celebration = useSharedValue(0);
  const fromSteps = useSharedValue(0);
  const toSteps = useSharedValue(0);
  const [displayedSteps, setDisplayedSteps] = useState(0);
  const [celebratedMilestone, setCelebratedMilestone] = useState<number | null>(null);
  const previousSteps = useRef(0);
  const reduceMotion = useReducedMotion();

  const updateDisplayedSteps = useCallback((progress: number, start: number, end: number) => {
    setDisplayedSteps(Math.round(start + (end - start) * progress));
  }, []);

  useAnimatedReaction(
    () => countProgress.value,
    (progress, previousProgress) => {
      if (progress !== previousProgress) {
        scheduleOnRN(updateDisplayedSteps, progress, fromSteps.value, toSteps.value);
      }
    },
    [updateDisplayedSteps],
  );

  useEffect(() => {
    if (!connected) {
      previousSteps.current = 0;
      setDisplayedSteps(0);
      setCelebratedMilestone(null);
      countProgress.value = 1;
      celebration.value = 0;
      return;
    }

    const start = previousSteps.current;
    const end = steps;
    const crossed = getReachedMilestone(end);
    const alreadyHad = getReachedMilestone(start);
    const newlyReached =
      crossed && crossed.steps !== alreadyHad?.steps ? crossed.steps : null;

    previousSteps.current = end;
    fromSteps.value = start;
    toSteps.value = end;

    if (reduceMotion || start === end) {
      setDisplayedSteps(end);
      countProgress.value = 1;
      if (newlyReached) {
        setCelebratedMilestone(newlyReached);
        celebration.value = 1;
      }
      return;
    }

    setCelebratedMilestone(null);
    celebration.value = 0;
    countProgress.value = 0;
    countProgress.value = withTiming(
      1,
      {
        duration: motionDurations.trail,
        easing: motionEasings.trail,
      },
      (finished) => {
        if (!finished || !newlyReached) {
          return;
        }

        scheduleOnRN(setCelebratedMilestone, newlyReached);
        celebration.value = withTiming(1, {
          duration: motionDurations.celebration,
        });
      },
    );

    return () => {
      cancelAnimation(countProgress);
      cancelAnimation(celebration);
    };
  }, [
    celebration,
    connected,
    countProgress,
    fromSteps,
    reduceMotion,
    steps,
    toSteps,
  ]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const celebrationStyle = useAnimatedStyle(() => ({
    opacity: celebration.value,
    transform: [{ translateY: 6 * (1 - celebration.value) }],
  }));

  const nextMilestone = getNextMilestone(displayedSteps);
  const remainingToMilestone = nextMilestone
    ? Math.max(0, nextMilestone.steps - displayedSteps)
    : 0;
  const statusCopy = validationCopy(phase, overlapsAnother);
  const swipeLabel = phase.kind === 'submitting' ? 'Validating' : 'Swipe to validate';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {connected ? (
          <>
            <View style={styles.hero}>
              <AppText role="caption" style={styles.heroLabel}>Verified steps</AppText>
              <AppText role="hero" style={styles.stepCount}>
                {formatNumber(displayedSteps)}
              </AppText>
              <AppText role="action" style={styles.unit}>steps</AppText>

              <MilestoneTrack reduceMotion={Boolean(reduceMotion)} steps={displayedSteps} />

              <View style={styles.milestoneMessage}>
                {celebratedMilestone ? (
                  <Animated.View style={[styles.celebration, celebrationStyle]}>
                    <View style={styles.steamMarks}>
                      <View style={[styles.steamMark, styles.steamShort]} />
                      <View style={styles.steamMark} />
                      <View style={[styles.steamMark, styles.steamShort]} />
                    </View>
                    <AppText role="heading" style={styles.reachedTitle}>
                      {formatNumber(celebratedMilestone)} reached
                    </AppText>
                    <AppText role="caption" style={styles.reachedCopy}>
                      That’s {pointsForSteps(celebratedMilestone)} Brew Points today.
                    </AppText>
                  </Animated.View>
                ) : null}
                {!celebratedMilestone && nextMilestone ? (
                  <>
                    <AppText role="heading" style={styles.nextTitle}>
                      {formatNumber(remainingToMilestone)} steps to {formatNumber(nextMilestone.steps)}
                    </AppText>
                    <AppText role="caption" style={styles.nextCopy}>
                      Your {nextMilestone.points}-point milestone is just ahead.
                    </AppText>
                  </>
                ) : null}
                {!celebratedMilestone && !nextMilestone ? (
                  <>
                    <AppText role="heading" style={styles.nextTitle}>
                      Daily cap reached
                    </AppText>
                    <AppText role="caption" style={styles.nextCopy}>
                      Extra steps still count. They don’t raise today’s points.
                    </AppText>
                  </>
                ) : null}
              </View>
            </View>

            <View style={styles.pointsCard}>
              <View>
                <AppText role="heading" style={styles.cardLabel}>Available today</AppText>
                <AppText role="caption" style={styles.cardCopy}>
                  {overlapsAnother
                    ? 'An overlapping day can’t be split.'
                    : 'Points this validation can add.'}
                </AppText>
              </View>
              <View style={styles.pointsAmount}>
                <AppText role="stat" style={styles.pointsNumber}>{claim == null ? '—' : claim}</AppText>
                <AppText role="caption" style={styles.pointsWord}>points</AppText>
              </View>
            </View>

            <ValidateSwipe
              disabled={phase.kind === 'submitting'}
              label={swipeLabel}
              onComplete={() => {
                void validate();
              }}
              resetKey={resetKey}
            />
            {statusCopy ? <AppText role="caption" style={styles.statusCopy}>{statusCopy}</AppText> : null}
            <AppText role="caption" style={styles.midnightCopy}>
              Validate before midnight. After that, today can’t be recovered.
            </AppText>

            <View style={styles.capRow}>
              <AppText role="caption" style={styles.capText}>Daily earning cap</AppText>
              <AppText role="caption" style={styles.capValue}>
                {formatNumber(dailyStepCap)} steps · {dailyPointCap} points
              </AppText>
            </View>
          </>
        ) : (
          <ConnectCard
            loading={loading}
            onConnect={() => {
              void connect();
            }}
            status={status}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.field,
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xl,
  },
  heroLabel: {
    color: colors.muted,
  },
  stepCount: {
    color: colors.ink,
    marginTop: spacing.sm,
  },
  unit: {
    color: colors.ink,
  },
  connectTitle: {
    color: colors.ink,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  connectCopy: {
    color: colors.muted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  connectAction: {
    marginTop: spacing.lg,
  },
  milestoneMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
    width: '100%',
  },
  nextTitle: {
    color: colors.ink,
    textAlign: 'center',
  },
  nextCopy: {
    color: colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  celebration: {
    alignItems: 'center',
  },
  steamMarks: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 5,
    height: 12,
    marginBottom: 2,
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
  reachedTitle: {
    color: colors.moss,
  },
  reachedCopy: {
    color: colors.muted,
    marginTop: 1,
  },
  pointsCard: {
    alignItems: 'center',
    backgroundColor: colors.moss,
    borderRadius: radii.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  cardLabel: {
    color: colors.card,
  },
  cardCopy: {
    color: colors.mossSoft,
    marginTop: 3,
    maxWidth: 210,
  },
  pointsAmount: {
    alignItems: 'flex-end',
  },
  pointsNumber: {
    color: colors.card,
  },
  pointsWord: {
    color: colors.mossSoft,
  },
  capRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  statusCopy: {
    color: colors.ink,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  midnightCopy: {
    color: colors.muted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  capText: {
    color: colors.muted,
  },
  capValue: {
    color: colors.ink,
  },
});
