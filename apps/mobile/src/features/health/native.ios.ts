import { Linking } from 'react-native';
import {
  AuthorizationRequestStatus,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

import { getLocalDayRange } from './platform';
import type { HealthAccess } from './types';

const stepType = 'HKQuantityTypeIdentifierStepCount' as const;
const readSteps = { toRead: [stepType] } as const;

async function authorizationAccess(): Promise<HealthAccess> {
  if (!isHealthDataAvailable()) {
    return { status: 'unavailable' };
  }

  const status = await getRequestStatusForAuthorization(readSteps);
  return {
    status:
      status === AuthorizationRequestStatus.shouldRequest ? 'undetermined' : 'granted',
  };
}

export async function getHealthAccess(): Promise<HealthAccess> {
  try {
    return await authorizationAccess();
  } catch {
    return { status: 'unavailable' };
  }
}

export async function requestHealthAccess(): Promise<HealthAccess> {
  try {
    if (!isHealthDataAvailable()) {
      await Linking.openSettings();
      return { status: 'unavailable' };
    }

    const before = await getRequestStatusForAuthorization(readSteps);
    if (before !== AuthorizationRequestStatus.shouldRequest) {
      return { status: 'granted' };
    }

    await requestAuthorization(readSteps);
    return await authorizationAccess();
  } catch {
    return { status: 'unavailable' };
  }
}

export async function readTodayStepCount(): Promise<number> {
  const { start, end } = getLocalDayRange();
  const stats = await queryStatisticsForQuantity(stepType, ['cumulativeSum'], {
    filter: {
      date: {
        endDate: end,
        startDate: start,
      },
    },
    unit: 'count',
  });

  return Math.round(stats.sumQuantity?.quantity ?? 0);
}

export async function openHealthSettings(): Promise<void> {
  await Linking.openSettings();
}
