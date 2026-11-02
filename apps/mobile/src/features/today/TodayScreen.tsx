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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '../../components/AppText';
import { floatingTabBarClearance } from '../../components/FloatingTabBar';
import { PillButton } from '../../components/PillButton';
import {
  dailyPointCap,
  dailyStepCap,
  getNextMilestone,
  getReachedMilestone,
  pointsForSteps,
} from '../earning/milestones';
import { remainingClaim } from '../earning/validation';
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

/**
 * Subtle status when the swipe is hidden. Never claims a successful validation
 * unless the server has recorded an award for today.
 */
function idleValidationStatus(input: {
  awardedToday: number | null;
  dayBlocked: boolean;
  steps: number;
}): string | null {
  if (input.dayBlocked) {
    return null;
  }

  if (input.awardedToday == null) {
    return 'Checking today’s validation…';
  }

  if (remainingClaim(input.steps, input.awardedToday) > 0) {
    return null;
  }

  if (pointsForSteps(input.steps) === 0) {
    const firstMilestone = getNextMilestone(0);
    if (!firstMilestone) {
      return null;
    }

    return `Reach ${formatNumber(firstMilestone.steps)} steps to unlock Brew Points.`;
  }

  if (input.awardedToday > 0) {
    return 'Validation is up to date.';
  }

  return null;
}

export function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { connect, loading, refresh, status, steps } = useHealth();
  const { awardedToday, overlapsAnother, phase, resetKey, validate } = useTodayValidation();
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
      crossed && getNextMilestone(crossed.steps) && crossed.steps !== alreadyHad?.steps
        ? crossed.steps
        : null;

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
  const swipeLabel = phase.kind === 'submitting' ? 'Validating' : 'Validate steps';
  const dayBlocked =
    overlapsAnother || phase.kind === 'day_closed' || phase.kind === 'day_overlap';
  const claimReady =
    awardedToday != null && remainingClaim(steps, awardedToday) > 0 && !dayBlocked;
  // Only show the swipe when something is claimable (or a submit is in flight).
  // Do not leave a disabled swipe on screen when nothing can be claimed.
  const showSwipe =
    phase.kind === 'submitting' || (claimReady && !dayBlocked);
  const nextPayable = getNextMilestone(steps);
  const idleStatus = idleValidationStatus({ awardedToday, dayBlocked, steps });
  const showMilestoneNudge =
    !showSwipe
    && nextMilestone != null
    && nextPayable != null
    && !dayBlocked
    && awardedToday != null
    && pointsForSteps(steps) > 0
    && remainingClaim(steps, awardedToday) === 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: floatingTabBarClearance(insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
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
                {nextMilestone == null ? (
                  <View style={styles.celebration}>
                    <View style={styles.steamMarks}>
                      <View style={[styles.steamMark, styles.steamShort]} />
                      <View style={styles.steamMark} />
                      <View style={[styles.steamMark, styles.steamShort]} />
                    </View>
                    <AppText role="heading" style={styles.reachedTitle}>
                      Daily cap reached
                    </AppText>
                    <AppText role="caption" style={styles.reachedCopy}>
                      Come back tomorrow.
                    </AppText>
                  </View>
                ) : null}
                {nextMilestone && celebratedMilestone ? (
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
                {nextMilestone && !celebratedMilestone ? (
                  <>
                    <AppText role="heading" style={styles.nextTitle}>
                      {formatNumber(remainingToMilestone)} steps to {formatNumber(nextMilestone.steps)}
                    </AppText>
                    <AppText role="caption" style={styles.nextCopy}>
                      Your {nextMilestone.points}-point milestone is just ahead.
                    </AppText>
                  </>
                ) : null}
              </View>
            </View>

            {showSwipe ? (
              <ValidateSwipe
                disabled={!claimReady || phase.kind === 'submitting'}
                label={swipeLabel}
                onComplete={() => {
                  void validate();
                }}
                resetKey={resetKey}
              />
            ) : null}
            {!showSwipe && idleStatus ? (
              <AppText role="caption" style={styles.idleStatus}>
                {idleStatus}
              </AppText>
            ) : null}
            {showMilestoneNudge && nextMilestone ? (
              <AppText role="caption" style={styles.reachCopy}>
                {`Keep walking. ${formatNumber(remainingToMilestone)} steps to ${nextMilestone.points} Brew Points.`}
              </AppText>
            ) : null}
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
  capRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  idleStatus: {
    color: colors.muted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  reachCopy: {
    color: colors.muted,
    marginTop: spacing.sm,
    textAlign: 'center',
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
