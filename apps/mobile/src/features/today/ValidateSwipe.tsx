import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '../../components/AppText';
import { motionSprings } from '../../motion/presets';
import { colors, fonts, radii } from '../../theme/tokens';

type ValidateSwipeProps = Readonly<{
  disabled: boolean;
  label: string;
  onComplete: () => void;
  resetKey: number;
}>;

export function ValidateSwipe({
  disabled,
  label,
  onComplete,
  resetKey,
}: ValidateSwipeProps) {
  const travel = useSharedValue(0);
  const maxTravel = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const completed = useRef(false);

  useEffect(() => {
    completed.current = false;
    travel.value = 0;
  }, [resetKey, travel]);

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

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: travel.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessibilityActions={[{ name: 'activate', label: 'Validate steps' }]}
        accessibilityLabel="Swipe to validate"
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
        <AppText role="action" style={styles.label}>{label}</AppText>
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
    overflow: 'hidden',
  },
  label: {
    color: colors.card,
    textAlign: 'center',
  },
  thumb: {
    alignItems: 'center',
    backgroundColor: colors.brass,
    borderRadius: radii.pill,
    height: 52,
    justifyContent: 'center',
    left: 6,
    position: 'absolute',
    top: 6,
    width: 52,
  },
  stamp: {
    color: colors.card,
    fontFamily: fonts.displayExtra,
    fontSize: 20,
  },
});
