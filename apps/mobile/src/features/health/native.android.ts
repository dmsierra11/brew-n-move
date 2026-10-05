import { Linking } from 'react-native';
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type { Permission } from 'react-native-health-connect';

import { getLocalDayRange } from './platform';
import type { HealthAccess } from './types';

const stepsRead: Permission = { accessType: 'read', recordType: 'Steps' };
const healthConnectStore = 'market://details?id=com.google.android.apps.healthdata';

let askedThisSession = false;

function hasStepsRead(permissions: readonly { accessType?: string; recordType?: string }[]) {
  return permissions.some(
    (permission) =>
      permission.accessType === 'read' && permission.recordType === 'Steps',
  );
}

async function sdkAccess(): Promise<HealthAccess> {
  const status = await getSdkStatus();
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    return { status: 'unavailable' };
  }

  const ready = await initialize();
  if (!ready) {
    return { status: 'unavailable' };
  }

  const granted = await getGrantedPermissions();
  if (hasStepsRead(granted)) {
    return { status: 'granted' };
  }

  return { status: askedThisSession ? 'denied' : 'undetermined' };
}

export async function getHealthAccess(): Promise<HealthAccess> {
  try {
    return await sdkAccess();
  } catch {
    return { status: 'unavailable' };
  }
}

export async function requestHealthAccess(): Promise<HealthAccess> {
  try {
    const current = await sdkAccess();
    if (current.status === 'unavailable') {
      await Linking.openURL(healthConnectStore);
      return current;
    }

    if (current.status === 'granted') {
      return current;
    }

    if (current.status === 'denied') {
      openHealthConnectSettings();
      return current;
    }

    askedThisSession = true;
    const granted = await requestPermission([stepsRead]);
    if (hasStepsRead(granted)) {
      return { status: 'granted' };
    }

    return { status: 'denied' };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function readTodayStepCount(): Promise<number> {
  const { start, end } = getLocalDayRange();
  const result = await aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  });

  return Math.round(result.COUNT_TOTAL ?? 0);
}

export async function openHealthSettings(): Promise<void> {
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
      openHealthConnectSettings();
      return;
    }
  } catch {
    // Fall through to the Play Store listing when Health Connect is missing.
  }

  await Linking.openURL(healthConnectStore);
}
