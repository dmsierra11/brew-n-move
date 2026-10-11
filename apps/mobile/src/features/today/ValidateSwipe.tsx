import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '../../components/AppText';
import { motionSprings } from '../../motion/presets';
import { colors, fonts, radii, spacing } from '../../theme/tokens';

type ValidateSwipeProps = Readonly<{
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled: boolean;
  label: string;
  onComplete: () => void;
  resetKey: number;
}>;

const thumbSize = 52;
const thumbInset = 6;

export function ValidateSwipe({
  accessibilityHint,
  accessibilityLabel = 'Validate steps',
  disabled,
  label,
  onComplete,
  resetKey,
}: ValidateSwipeProps) {
  const travel = useSharedValue(0);
  const maxTravel = useSharedValue(0);
  const nudge = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const completed = useRef(false);

  useEffect(() => {
    completed.current = false;
    travel.value = 0;
  }, [resetKey, travel]);

  useEffect(() => {
    if (reduceMotion || disabled) {
      cancelAnimation(nudge);
      nudge.value = 0;
      return;
    }

    nudge.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 640,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(0, {
          duration: 640,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(nudge);
    };
  }, [disabled, nudge, reduceMotion]);

  const finish = () => {
    if (completed.current || disabled) {
      return;
    }

    completed.current = true;
    onComplete();
  };

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX(8)
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      travel.value = Math.min(Math.max(0, event.translationX), maxTravel.value);
    })
    .onEnd(() => {
      const complete = maxTravel.value > 0 && travel.value >= maxTravel.value - 8;
      if (complete) {
        travel.value = maxTravel.value;
        scheduleOnRN(finish);
        return;
      }

      travel.value = reduceMotion ? 0 : withSpring(0, motionSprings.settle);
    });

  const fillStyle = useAnimatedStyle(() => ({
    width: travel.value,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: travel.value }],
  }));

  const hintStyle = useAnimatedStyle(() => {
    const faded = interpolate(travel.value, [0, 36], [1, 0]);
    return {
      opacity: faded,
      transform: [{ translateX: travel.value + interpolate(nudge.value, [0, 1], [0, 10]) }],
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessibilityActions={[{ name: 'activate', label: accessibilityLabel }]}
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') {
            finish();
          }
        }}
        onLayout={(event) => {
          maxTravel.value = Math.max(0, event.nativeEvent.layout.width - 64);
        }}
        style={styles.track}
      >
        <Animated.View pointerEvents="none" style={[styles.fill, fillStyle]} />
        <AppText role="action" style={styles.label}>{label}</AppText>
        <Animated.View pointerEvents="none" style={[styles.hints, hintStyle]}>
          <AppText role="action" style={styles.chevron}>›</AppText>
          <AppText role="action" style={[styles.chevron, styles.chevronMid]}>›</AppText>
          <AppText role="action" style={[styles.chevron, styles.chevronFaint]}>›</AppText>
        </Animated.View>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <AppText role="action" style={styles.stamp}>B</AppText>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.moss,
    borderRadius: radii.pill,
    height: 64,
    justifyContent: 'center',
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: colors.muted,
    bottom: 0,
    left: 0,
    opacity: 0.72,
    position: 'absolute',
    top: 0,
  },
  label: {
    color: colors.card,
    textAlign: 'center',
  },
  hints: {
    alignItems: 'center',
    flexDirection: 'row',
    left: thumbInset + thumbSize + 2,
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  chevron: {
    color: colors.card,
    fontSize: 22,
    lineHeight: 24,
    marginLeft: -6,
    opacity: 1,
  },
  chevronMid: {
    opacity: 0.72,
  },
  chevronFaint: {
    opacity: 0.42,
  },
  thumb: {
    alignItems: 'center',
    backgroundColor: colors.brass,
    borderRadius: radii.pill,
    height: thumbSize,
    justifyContent: 'center',
    left: thumbInset,
    position: 'absolute',
    top: thumbInset,
    width: thumbSize,
  },
  stamp: {
    color: colors.card,
    fontFamily: fonts.displayExtra,
    fontSize: 20,
  },
});
