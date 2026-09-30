import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '../../components/AppText';
import { motionDurations, motionEasings, motionSprings } from '../../motion/presets';
import { colors, radii, spacing } from '../../theme/tokens';
import { formatNumber } from '../../utils/format';
import { MilestoneProgress } from './MilestoneProgress';

const initialSteps = 4820;
const updatedSteps = 5020;
const milestone = 5000;
const dailyCap = 10000;

export function TodayScreen() {
  const countProgress = useSharedValue(0);
  const trailProgress = useSharedValue(initialSteps / milestone);
  const checkpointScale = useSharedValue(1);
  const celebration = useSharedValue(0);
  const [displayedSteps, setDisplayedSteps] = useState(initialSteps);
  const [reached, setReached] = useState(false);
  const reduceMotion = useReducedMotion();

  const updateDisplayedSteps = useCallback((progress: number) => {
    setDisplayedSteps(Math.round(initialSteps + (updatedSteps - initialSteps) * progress));
  }, []);

  useAnimatedReaction(
    () => countProgress.value,
    (progress, previousProgress) => {
      if (progress !== previousProgress) {
        scheduleOnRN(updateDisplayedSteps, progress);
      }
    },
    [updateDisplayedSteps],
  );

  useEffect(() => {
    if (reduceMotion) {
      setDisplayedSteps(updatedSteps);
      countProgress.value = 1;
      trailProgress.value = 1;
      celebration.value = 1;
      setReached(true);
      return;
    }

    const timer = setTimeout(() => {
      countProgress.value = withTiming(1, {
        duration: motionDurations.trail,
        easing: motionEasings.trail,
      });
      trailProgress.value = withTiming(
        1,
        {
          duration: motionDurations.trail,
          easing: motionEasings.trail,
        },
        (finished) => {
          if (!finished) {
            return;
          }

          scheduleOnRN(setReached, true);
          checkpointScale.value = withSequence(
            withTiming(1.2, { duration: motionDurations.checkpointLift }),
            withSpring(1, motionSprings.checkpoint),
          );
          celebration.value = withTiming(1, {
            duration: motionDurations.celebration,
          });
        },
      );
    }, 700);

    return () => {
      clearTimeout(timer);
      cancelAnimation(countProgress);
      cancelAnimation(trailProgress);
      cancelAnimation(checkpointScale);
      cancelAnimation(celebration);
    };
  }, [celebration, checkpointScale, countProgress, reduceMotion, trailProgress]);

  const celebrationStyle = useAnimatedStyle(() => ({
    opacity: celebration.value,
    transform: [{ translateY: 6 * (1 - celebration.value) }],
  }));

  const pointsToday = Math.min(Math.floor(displayedSteps / 100), 100);
  const remainingToMilestone = Math.max(0, milestone - displayedSteps);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <AppText role="caption" style={styles.heroLabel}>Verified steps</AppText>
          <AppText role="hero" style={styles.stepCount}>{formatNumber(displayedSteps)}</AppText>
          <AppText role="action" style={styles.unit}>steps</AppText>

          <MilestoneProgress
            checkpointScale={checkpointScale}
            milestone={milestone}
            progress={trailProgress}
            reached={reached}
          />

          <View style={styles.milestoneMessage}>
            {reached ? (
              <Animated.View
                style={[styles.celebration, celebrationStyle]}
              >
                <View style={styles.steamMarks}>
                  <View style={[styles.steamMark, styles.steamShort]} />
                  <View style={styles.steamMark} />
                  <View style={[styles.steamMark, styles.steamShort]} />
                </View>
                <AppText role="heading" style={styles.reachedTitle}>5,000 reached</AppText>
                <AppText role="caption" style={styles.reachedCopy}>That’s 50 Brew Points today.</AppText>
              </Animated.View>
            ) : (
              <>
                <AppText role="heading" style={styles.nextTitle}>
                  {formatNumber(remainingToMilestone)} steps to 5,000
                </AppText>
                <AppText role="caption" style={styles.nextCopy}>Your 50-point milestone is just ahead.</AppText>
              </>
            )}
          </View>
        </View>

        <View style={styles.pointsCard}>
          <View>
            <AppText role="heading" style={styles.cardLabel}>Earned today</AppText>
            <AppText role="caption" style={styles.cardCopy}>Every 100 verified steps earns 1 point.</AppText>
          </View>
          <View style={styles.pointsAmount}>
            <AppText role="stat" style={styles.pointsNumber}>{pointsToday}</AppText>
            <AppText role="caption" style={styles.pointsWord}>points</AppText>
          </View>
        </View>

        <View style={styles.capRow}>
          <AppText role="caption" style={styles.capText}>Daily earning cap</AppText>
          <AppText role="caption" style={styles.capValue}>{formatNumber(dailyCap)} steps · 100 points</AppText>
        </View>
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
  milestoneMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
    width: '100%',
  },
  nextTitle: {
    color: colors.ink,
  },
  nextCopy: {
    color: colors.muted,
    marginTop: 2,
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
  capText: {
    color: colors.muted,
  },
  capValue: {
    color: colors.ink,
  },
});
