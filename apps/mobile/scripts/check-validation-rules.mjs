import { readFileSync } from 'node:fs';

const { pointsForSteps, earningMilestones } = await import(
  '../src/features/earning/milestones.ts'
);
const { dayWindow, windowsOverlap } = await import('../src/features/earning/localDay.ts');

function remainingClaim(steps, awardedToday) {
  return Math.max(0, pointsForSteps(steps) - awardedToday);
}

function confirmedPersistedAward(before, after) {
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

const results = [];

function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const boundaries = [
  [2499, 0],
  [2500, 25],
  [2501, 25],
  [4999, 25],
  [5000, 50],
  [19999, 175],
  [20000, 200],
  [20001, 200],
];

for (const [steps, points] of boundaries) {
  check(`milestone ${steps}`, pointsForSteps(steps) === points, `got ${pointsForSteps(steps)}`);
}

check(
  'remaining claim is the unpaid delta',
  remainingClaim(5000, 25) === 25 && remainingClaim(2500, 25) === 0 && remainingClaim(1000, 0) === 0,
);

check(
  'unchanged records are not a confirmed failure or award',
  confirmedPersistedAward({ awardedToday: 25, balance: 25 }, { awardedToday: 25, balance: 25 }) == null,
);

check(
  'a persisted increase is a confirmed award',
  confirmedPersistedAward({ awardedToday: 25, balance: 25 }, { awardedToday: 50, balance: 50 }) === 25,
);

const lisbon = dayWindow('2026-10-07', 'Europe/Lisbon');
check(
  'Lisbon local midnight matches the absolute instant',
  lisbon.start === Date.parse('2026-10-06T23:00:00.000Z')
    && lisbon.end === Date.parse('2026-10-07T23:00:00.000Z'),
);

const springStart = dayWindow('2026-03-08', 'America/New_York');
const springHours = (springStart.end - springStart.start) / 36e5;
check(
  'New York spring-forward day is 23 hours',
  springHours === 23
    && springStart.start === Date.parse('2026-03-08T05:00:00.000Z')
    && springStart.end === Date.parse('2026-03-09T04:00:00.000Z'),
  `${springHours} hours`,
);

const fallStart = dayWindow('2026-11-01', 'America/New_York');
const fallHours = (fallStart.end - fallStart.start) / 36e5;
check(
  'New York fall-back day is 25 hours',
  fallHours === 25
    && fallStart.start === Date.parse('2026-11-01T04:00:00.000Z')
    && fallStart.end === Date.parse('2026-11-02T05:00:00.000Z'),
  `${fallHours} hours`,
);

const adjacent = dayWindow('2026-10-08', 'Europe/Lisbon');
const previous = {
  end: adjacent.start,
  start: adjacent.start - 24 * 36e5,
};
check('adjacent windows do not overlap', windowsOverlap(previous, adjacent) === false);
check(
  'overlapping windows do overlap',
  windowsOverlap(previous, { end: previous.end + 60_000, start: previous.start }),
);

const sql = readFileSync(
  new URL('../../../supabase/migrations/20261007215948_step_validation.sql', import.meta.url),
  'utf8',
);
const sqlPairs = [...sql.matchAll(/when p_steps >= (\d+) then (\d+)/g)].map((match) => [
  Number(match[1]),
  Number(match[2]),
]);
const tsPairs = earningMilestones.map((milestone) => [milestone.steps, milestone.points]);
check(
  'server ladder matches milestones.ts',
  JSON.stringify(sqlPairs) === JSON.stringify([...tsPairs].reverse()),
  JSON.stringify(sqlPairs),
);

const oldPrivacy = sql.includes("Today's step total stays on this phone");
check('accepted privacy body is not rewritten', oldPrivacy === false);

if (results.some((result) => !result.passed)) {
  process.exit(1);
}
