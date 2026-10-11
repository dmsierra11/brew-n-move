import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { dailyStepCap, earningMilestones } from '../earning/milestones';
import { colors, radii, spacing } from '../../theme/tokens';
import { formatNumber } from '../../utils/format';

const trackEnd = 736;

type MilestoneTrackProps = Readonly<{
  reduceMotion: boolean;
  steps: number;
}>;

function centerFor(steps: number) {
  return (Math.min(Math.max(steps, 0), dailyStepCap) / dailyStepCap) * trackEnd;
}

export function MilestoneTrack({ reduceMotion, steps }: MilestoneTrackProps) {
  const scrollRef = useRef<ScrollView>(null);
  const nextIndex = earningMilestones.findIndex((milestone) => steps < milestone.steps);
  const focusIndex = nextIndex === -1 ? earningMilestones.length - 1 : nextIndex;

  useEffect(() => {
    const x = Math.max(0, centerFor(earningMilestones[focusIndex]?.steps ?? dailyStepCap) - 140);
    scrollRef.current?.scrollTo({ animated: !reduceMotion, x });
  }, [focusIndex, reduceMotion]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      contentContainerStyle={styles.content}
      showsHorizontalScrollIndicator={false}
    >
      <View style={styles.track}>
        <View style={styles.baseLine} />
        <View style={[styles.fillLine, { width: centerFor(steps) }]} />
        {earningMilestones.map((milestone) => {
          const reached = steps >= milestone.steps;
          const isNext = !reached && milestone.steps === earningMilestones[nextIndex]?.steps;
          const stateLabel = reached ? 'reached' : isNext ? 'next' : 'later';
          return (
            <View
              key={milestone.steps}
              style={[styles.stop, { left: centerFor(milestone.steps) - 40 }]}
            >
              <View
                style={[
                  styles.dot,
                  reached && styles.dotReached,
                  isNext && styles.dotNext,
                ]}
              />
              <AppText role="caption" style={styles.steps}>{formatNumber(milestone.steps)}</AppText>
              <AppText role="caption" style={styles.points}>{milestone.points}</AppText>
              <AppText role="eyebrow" style={styles.state}>{stateLabel}</AppText>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.sm,
    paddingTop: spacing.md,
  },
  track: {
    height: 108,
    width: trackEnd + 48,
  },
  baseLine: {
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 4,
    left: 0,
    position: 'absolute',
    right: 48,
    top: 6,
  },
  fillLine: {
    backgroundColor: colors.moss,
    borderRadius: radii.pill,
    height: 4,
    left: 0,
    position: 'absolute',
    top: 6,
  },
  stop: {
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    width: 80,
  },
  dot: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 16,
    width: 16,
  },
  dotReached: {
    backgroundColor: colors.brass,
    borderColor: colors.brass,
  },
  dotNext: {
    borderColor: colors.brass,
  },
  steps: {
    color: colors.ink,
    marginTop: spacing.sm,
  },
  points: {
    color: colors.muted,
  },
  state: {
    color: colors.muted,
    letterSpacing: 0.6,
    marginTop: 2,
  },
});
