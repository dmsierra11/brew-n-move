import { useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts, radii } from '../../theme/tokens';
import { formatNumber } from '../../utils/format';

type MilestoneProgressProps = {
  checkpointScale: Animated.Value;
  milestone: number;
  progress: Animated.Value;
  reached: boolean;
};

const trailPath = 'M7 52 C48 52 57 30 97 34 C135 38 150 60 190 49 C224 40 240 19 289 25';

export function MilestoneProgress({
  checkpointScale,
  milestone,
  progress,
  reached,
}: MilestoneProgressProps) {
  const [width, setWidth] = useState(0);
  const revealWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width],
  });

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.container}
    >
      <Svg height={72} viewBox="0 0 296 72" width="100%">
        <Path
          d={trailPath}
          fill="none"
          stroke={colors.line}
          strokeDasharray="3 7"
          strokeLinecap="round"
          strokeWidth={6}
        />
      </Svg>

      <Animated.View style={[styles.progressClip, { width: revealWidth }]}>
        {width > 0 ? (
          <Svg height={72} viewBox="0 0 296 72" width={width}>
            <Path
              d={trailPath}
              fill="none"
              stroke={colors.moss}
              strokeDasharray="3 7"
              strokeLinecap="round"
              strokeWidth={6}
            />
          </Svg>
        ) : null}
      </Animated.View>

      <Animated.View
        style={[
          styles.checkpoint,
          reached && styles.checkpointReached,
          { transform: [{ scale: checkpointScale }] },
        ]}
      >
        <Text style={[styles.checkpointValue, reached && styles.checkpointValueReached]}>
          {formatNumber(milestone / 1000)}K
        </Text>
        <Text style={[styles.checkpointLabel, reached && styles.checkpointValueReached]}>
          {reached ? 'reached' : 'next'}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 84,
    marginTop: 22,
    overflow: 'visible',
    width: '100%',
  },
  progressClip: {
    height: 72,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  checkpoint: {
    alignItems: 'center',
    backgroundColor: colors.brassSoft,
    borderColor: colors.brass,
    borderRadius: radii.pill,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 54,
    minWidth: 54,
    position: 'absolute',
    right: -3,
    top: 0,
  },
  checkpointReached: {
    backgroundColor: colors.brass,
  },
  checkpointValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 17,
  },
  checkpointLabel: {
    color: colors.muted,
    fontFamily: fonts.bold,
    fontSize: 9,
  },
  checkpointValueReached: {
    color: colors.card,
  },
});
