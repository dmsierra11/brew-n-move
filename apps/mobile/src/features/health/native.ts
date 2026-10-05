import type { HealthAccess } from './types';

export type { HealthAccess, HealthAccessStatus } from './types';

export async function getHealthAccess(): Promise<HealthAccess> {
  return { status: 'unavailable' };
}

export async function requestHealthAccess(): Promise<HealthAccess> {
  return { status: 'unavailable' };
}

export async function readTodayStepCount(): Promise<number> {
  return 0;
}

export async function openHealthSettings(): Promise<void> {
  return undefined;
}
