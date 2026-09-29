import { Easing } from 'react-native-reanimated';

export const motionDurations = {
  celebration: 260,
  checkpointLift: 180,
  navigationPressIn: 90,
  navigationPressOut: 100,
  redeem: 160,
  trail: 1400,
} as const;

export const motionEasings = {
  trail: Easing.out(Easing.cubic),
} as const;

export const motionSprings = {
  art: {
    dampingRatio: 0.72,
    duration: 260,
  },
  checkpoint: {
    dampingRatio: 0.68,
    duration: 360,
  },
  press: {
    dampingRatio: 1,
    duration: 180,
  },
  settle: {
    dampingRatio: 0.9,
    duration: 300,
  },
} as const;
