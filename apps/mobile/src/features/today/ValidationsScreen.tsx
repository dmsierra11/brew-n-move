import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabase';
import { useBalance } from '../earning/BalanceProvider';
import { deviceTimeZone, localDateInTimeZone } from '../earning/localDay';
import { colors, radii, spacing } from '../../theme/tokens';
import { formatNumber } from '../../utils/format';

type AwardRow = {
  kind: 'award';
  id: string;
  localDate: string;
  occurredAt: string;
  points: number;
  stepTotal: number | null;
  timezone: string;
};

type RedeemRow = {
  kind: 'redeem';
  id: string;
  localDate: string;
  occurredAt: string;
  partnerName: string;
  points: number;
  timezone: string;
  title: string;
};

type ActivityRow = AwardRow | RedeemRow;

type DayGroup = {
  date: string;
  rows: ActivityRow[];
};

function formatDayHeading(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function formatRowTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-IE', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

function formatAwardMeta(row: AwardRow) {
  const time = formatRowTime(row.occurredAt, row.timezone);
  if (row.stepTotal == null) {
    return time;
  }

  return `${time} · ${formatNumber(row.stepTotal)} steps`;
}

function groupByDay(rows: ActivityRow[]) {
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

export function ValidationsScreen() {
  const { beginAccountAction, profileStatus, sessionStatus, userId } = useAuth();
  const { balance, reloadBalance } = useBalance();
  const [groups, setGroups] = useState<DayGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const ready = sessionStatus === 'signedIn' && profileStatus === 'ready';

  const load = useCallback(async () => {
    if (!userId || !ready) {
      setGroups([]);
      setFailed(false);
      return;
    }

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
      setFailed(true);
      setGroups([]);
      return;
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

    setFailed(false);
    setGroups(groupByDay(rows));
  }, [ready, userId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(), reloadBalance()]);
    } finally {
      setRefreshing(false);
    }
  }, [load, reloadBalance]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        alwaysBounceVertical
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.moss]}
            onRefresh={() => {
              void refresh();
            }}
            progressBackgroundColor={colors.card}
            refreshing={refreshing}
            tintColor={colors.moss}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <ScreenBackButton accessibilityLabel="Back to Today" />
        <AppText accessibilityRole="header" role="title" style={styles.title}>
          Activity
        </AppText>

        <View style={styles.balanceCard}>
          <AppText role="eyebrow" style={styles.balanceEyebrow}>Your Brew Points</AppText>
          <AppText role="display" style={styles.balanceValue}>
            {balance == null ? '—' : formatNumber(balance)}
          </AppText>
        </View>

        {!ready ? (
          <View style={styles.empty}>
            <AppText role="heading">Sign in to see your days</AppText>
            <AppText role="caption" style={styles.emptyCopy}>
              Validations and redemptions will show up here.
            </AppText>
            <PillButton
              appearance="primary"
              label="Sign in"
              onPress={() => beginAccountAction({ type: 'activity' })}
            />
          </View>
        ) : failed ? (
          <View style={styles.empty}>
            <AppText role="heading">Couldn’t load activity</AppText>
            <AppText role="caption" style={styles.emptyCopy}>
              Try again in a moment.
            </AppText>
            <PillButton appearance="primary" label="Try again" onPress={() => { void load(); }} />
          </View>
        ) : groups == null ? (
          <AppText role="caption" style={styles.emptyCopy}>Loading your days</AppText>
        ) : groups.length === 0 ? (
          <View style={styles.empty}>
            <AppText role="heading">No activity yet</AppText>
            <AppText role="caption" style={styles.emptyCopy}>
              Validations and redemptions will show up here.
            </AppText>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.date} style={styles.dayGroup}>
              <AppText role="eyebrow" style={styles.dayHeading}>
                {formatDayHeading(group.date)}
              </AppText>
              {group.rows.map((row) => (
                <View key={`${row.kind}-${row.id}`} style={styles.row}>
                  <View style={styles.rowIcon}>
                    <View style={styles.rowIconStem} />
                    <View style={styles.rowIconCup} />
                  </View>
                  {row.kind === 'award' ? (
                    <>
                      <View style={styles.rowCopy}>
                        <AppText role="action">Steps validated</AppText>
                        <AppText role="caption" style={styles.rowMeta}>
                          {formatAwardMeta(row)}
                        </AppText>
                      </View>
                      <AppText
                        role="action"
                        style={[styles.rowPointsEarned, row.points === 0 && styles.rowPointsMuted]}
                      >
                        {`+${formatNumber(row.points)}`}
                      </AppText>
                    </>
                  ) : (
                    <>
                      <View style={styles.rowCopy}>
                        <AppText role="action">{row.title}</AppText>
                        <AppText role="caption" style={styles.rowMeta}>
                          {`${formatRowTime(row.occurredAt, row.timezone)} · ${row.partnerName}`}
                        </AppText>
                      </View>
                      <AppText role="action" style={styles.rowPointsSpent}>
                        {`−${formatNumber(row.points)}`}
                      </AppText>
                    </>
                  )}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.field,
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: colors.ink,
    marginTop: spacing.lg,
  },
  balanceCard: {
    backgroundColor: colors.brassSoft,
    borderRadius: radii.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  balanceEyebrow: {
    color: colors.brass,
  },
  balanceValue: {
    color: colors.ink,
    marginTop: spacing.xs,
  },
  empty: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  emptyCopy: {
    color: colors.muted,
    marginTop: spacing.md,
  },
  dayGroup: {
    marginTop: spacing.xl,
  },
  dayHeading: {
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowIcon: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'flex-end',
    width: 22,
  },
  rowIconStem: {
    backgroundColor: colors.moss,
    borderRadius: radii.pill,
    height: 10,
    width: 3,
  },
  rowIconCup: {
    backgroundColor: colors.brass,
    borderRadius: 8,
    height: 10,
    marginTop: 2,
    width: 16,
  },
  rowCopy: {
    flex: 1,
  },
  rowMeta: {
    color: colors.muted,
    marginTop: 2,
  },
  rowPointsEarned: {
    color: colors.moss,
  },
  rowPointsSpent: {
    color: colors.ink,
  },
  rowPointsMuted: {
    color: colors.muted,
  },
});
