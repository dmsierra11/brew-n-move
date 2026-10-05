import { Platform } from 'react-native';

export const healthPlatformName = Platform.select({
  android: 'Health Connect',
  ios: 'Apple Health',
  default: 'Apple Health',
}) as string;

export function getLocalDayRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { end: now, start };
}
