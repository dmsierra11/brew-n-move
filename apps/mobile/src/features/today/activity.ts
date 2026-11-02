import { supabase } from '../auth/supabase';
import { deviceTimeZone, localDateInTimeZone } from '../earning/localDay';
import { formatNumber } from '../../utils/format';

export type AwardRow = {
  kind: 'award';
  id: string;
  localDate: string;
  occurredAt: string;
  points: number;
  stepTotal: number | null;
  timezone: string;
};

export type RedeemRow = {
  kind: 'redeem';
  id: string;
  localDate: string;
  occurredAt: string;
  partnerName: string;
  points: number;
  timezone: string;
  title: string;
};

export type ActivityRow = AwardRow | RedeemRow;

export type DayGroup = {
  date: string;
  rows: ActivityRow[];
};

export function formatDayHeading(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export function formatRowTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-IE', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

export function formatAwardMeta(row: AwardRow) {
  const time = formatRowTime(row.occurredAt, row.timezone);
  if (row.stepTotal == null) {
    return time;
  }

  return `${time} · ${formatNumber(row.stepTotal)} steps`;
}

export function groupByDay(rows: ActivityRow[]) {
  const groups = new Map<string, ActivityRow[]>();
  for (const row of rows) {
    const current = groups.get(row.localDate) ?? [];
    current.push(row);
    groups.set(row.localDate, current);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, items]) => ({
      date,
      rows: items.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
    })) satisfies DayGroup[];
}

export async function loadMemberActivity(userId: string): Promise<
  | { ok: true; groups: DayGroup[] }
  | { ok: false }
> {
  const timeZone = deviceTimeZone();
  const [awards, redemptions] = await Promise.all([
    supabase
      .from('step_validations')
      .select('awarded_points, id, local_date, step_total, timezone, validated_at')
      .eq('member_id', userId),
    supabase
      .from('redemptions')
      .select('id, offer_title, partner_name, points_spent, redeemed_at')
      .eq('member_id', userId),
  ]);

  if (awards.error || !awards.data || redemptions.error || !redemptions.data) {
    return { ok: false };
  }

  const rows: ActivityRow[] = [
    ...awards.data.map((row) => ({
      kind: 'award' as const,
      id: row.id,
      localDate: row.local_date,
      occurredAt: row.validated_at,
      points: row.awarded_points,
      stepTotal: row.step_total,
      timezone: row.timezone,
    })),
    ...redemptions.data.map((row) => ({
      kind: 'redeem' as const,
      id: row.id,
      localDate: localDateInTimeZone(new Date(row.redeemed_at), timeZone),
      occurredAt: row.redeemed_at,
      partnerName: row.partner_name,
      points: row.points_spent,
      timezone: timeZone,
      title: row.offer_title,
    })),
  ];

  return { ok: true, groups: groupByDay(rows) };
}
