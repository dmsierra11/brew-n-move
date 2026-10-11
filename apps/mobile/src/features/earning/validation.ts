import { pointsForSteps } from './milestones';

export const stepTotalLimit = 1_000_000;

export type ValidationSnapshot = {
  awardedToday: number;
  balance: number | null;
};

export function remainingClaim(steps: number, awardedToday: number) {
  return Math.max(0, pointsForSteps(steps) - awardedToday);
}

/**
 * A lost response is not a failure. An increased persisted award is confirmed.
 * An unchanged balance does not prove the previous request failed.
 */
export function confirmedPersistedAward(
  before: ValidationSnapshot,
  after: ValidationSnapshot | null,
) {
  if (!after) {
    return null;
  }

  const awardedDelta = after.awardedToday - before.awardedToday;
  if (awardedDelta > 0) {
    return awardedDelta;
  }

  if (before.balance == null || after.balance == null) {
    return null;
  }

  const balanceDelta = after.balance - before.balance;
  if (balanceDelta > 0 && awardedDelta === 0) {
    return balanceDelta;
  }

  return null;
}
