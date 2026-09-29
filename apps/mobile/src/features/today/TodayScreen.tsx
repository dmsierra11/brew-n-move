import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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

import { motionDurations, motionEasings, motionSprings } from '../../motion/presets';
import { colors, fonts, radii, spacing } from '../../theme/tokens';
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
          <Text style={styles.heroLabel}>Verified steps</Text>
          <Text style={styles.stepCount}>{formatNumber(displayedSteps)}</Text>
          <Text style={styles.unit}>steps</Text>

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
                <Text style={styles.reachedTitle}>5,000 reached</Text>
                <Text style={styles.reachedCopy}>That’s 50 Brew Points today.</Text>
              </Animated.View>
            ) : (
              <>
                <Text style={styles.nextTitle}>
                  {formatNumber(remainingToMilestone)} steps to 5,000
                </Text>
                <Text style={styles.nextCopy}>Your 50-point milestone is just ahead.</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.pointsCard}>
          <View>
            <Text style={styles.cardLabel}>Earned today</Text>
            <Text style={styles.cardCopy}>Every 100 verified steps earns 1 point.</Text>
          </View>
          <View style={styles.pointsAmount}>
            <Text style={styles.pointsNumber}>{pointsToday}</Text>
            <Text style={styles.pointsWord}>points</Text>
          </View>
        </View>

        <View style={styles.capRow}>
          <Text style={styles.capText}>Daily earning cap</Text>
          <Text style={styles.capValue}>{formatNumber(dailyCap)} steps · 100 points</Text>
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
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  stepCount: {
    color: colors.ink,
    fontFamily: fonts.displayExtra,
    fontSize: 74,
    letterSpacing: -4,
    lineHeight: 84,
    marginTop: spacing.sm,
  },
  unit: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
  milestoneMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
    width: '100%',
  },
  nextTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 19,
  },
  nextCopy: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
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
    fontFamily: fonts.display,
    fontSize: 20,
  },
  reachedCopy: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
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
    fontFamily: fonts.display,
    fontSize: 22,
  },
  cardCopy: {
    color: colors.mossSoft,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 3,
    maxWidth: 210,
  },
  pointsAmount: {
    alignItems: 'flex-end',
  },
  pointsNumber: {
    color: colors.card,
    fontFamily: fonts.displayExtra,
    fontSize: 38,
    lineHeight: 40,
  },
  pointsWord: {
    color: colors.mossSoft,
    fontFamily: fonts.semibold,
    fontSize: 12,
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
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  capValue: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
});
