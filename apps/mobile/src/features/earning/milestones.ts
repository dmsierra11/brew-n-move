export type EarningMilestone = {
  points: number;
  steps: number;
};

/**
 * Provisional earning rates. Keep this list ordered by steps.
 *
 * Change this list after partner and community testing rather than duplicating
 * thresholds in screens or native health integrations.
 */
export const earningMilestones: readonly EarningMilestone[] = [
  { steps: 2_500, points: 25 },
  { steps: 5_000, points: 50 },
  { steps: 7_500, points: 75 },
  { steps: 10_000, points: 100 },
  { steps: 12_500, points: 125 },
  { steps: 15_000, points: 150 },
  { steps: 17_500, points: 175 },
  { steps: 20_000, points: 200 },
];

export const dailyStepCap = earningMilestones.at(-1)?.steps ?? 0;
export const dailyPointCap = earningMilestones.at(-1)?.points ?? 0;

export function getReachedMilestone(steps: number) {
  return earningMilestones.findLast((milestone) => steps >= milestone.steps) ?? null;
}

export function getNextMilestone(steps: number) {
  return earningMilestones.find((milestone) => steps < milestone.steps) ?? null;
}

export function pointsForSteps(steps: number) {
  return getReachedMilestone(steps)?.points ?? 0;
}
