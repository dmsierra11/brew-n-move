import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabase';
import { useBalance } from '../earning/BalanceProvider';
import { colors, radii, spacing } from '../../theme/tokens';
import { formatNumber } from '../../utils/format';

type ValidationDay = {
  awardedPoints: number;
  localDate: string;
  stepTotal: number;
  timezone: string;
  validatedAt: string;
};

type DayGroup = {
  date: string;
  rows: ValidationDay[];
};

function formatDayHeading(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function formatValidatedTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-IE', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

function groupByDay(rows: ValidationDay[]) {
  const groups = new Map<string, ValidationDay[]>();
  for (const row of rows) {
    const current = groups.get(row.localDate) ?? [];
    current.push(row);
    groups.set(row.localDate, current);
  }

  return [...groups.entries()].map(([date, items]) => ({
    date,
    rows: items,
  })) satisfies DayGroup[];
}

export function ValidationsScreen() {
  const { beginAccountAction, profileStatus, sessionStatus, userId } = useAuth();
  const { balance } = useBalance();
  const [groups, setGroups] = useState<DayGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const ready = sessionStatus === 'signedIn' && profileStatus === 'ready';

  const load = useCallback(async () => {
    if (!userId || !ready) {
      setGroups([]);
      setFailed(false);
      return;
    }

    const { data, error } = await supabase
      .from('step_validations')
      .select('awarded_points, local_date, step_total, timezone, validated_at')
      .eq('member_id', userId)
      .order('local_date', { ascending: false })
      .order('validated_at', { ascending: false });

    if (error || !data) {
      setFailed(true);
      setGroups([]);
      return;
    }

    setFailed(false);
    setGroups(groupByDay(data.map((row) => ({
      awardedPoints: row.awarded_points,
      localDate: row.local_date,
      stepTotal: row.step_total,
      timezone: row.timezone,
      validatedAt: row.validated_at,
    }))));
  }, [ready, userId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
              Validations you submit will show up here.
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
            <AppText role="heading">No validations yet</AppText>
            <AppText role="caption" style={styles.emptyCopy}>
              Validations you submit will show up here.
            </AppText>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.date} style={styles.dayGroup}>
              <AppText role="eyebrow" style={styles.dayHeading}>
                {formatDayHeading(group.date)}
              </AppText>
              {group.rows.map((row) => (
                <View key={`${row.localDate}-${row.timezone}-${row.validatedAt}`} style={styles.row}>
                  <View style={styles.rowIcon}>
                    <View style={styles.rowIconStem} />
                    <View style={styles.rowIconCup} />
                  </View>
                  <View style={styles.rowCopy}>
                    <AppText role="action">Steps validated</AppText>
                    <AppText role="caption" style={styles.rowMeta}>
                      {`${formatValidatedTime(row.validatedAt, row.timezone)} · ${formatNumber(row.stepTotal)} steps`}
                    </AppText>
                  </View>
                  <AppText
                    role="action"
                    style={[styles.rowPoints, row.awardedPoints === 0 && styles.rowPointsMuted]}
                  >
                    {`+${formatNumber(row.awardedPoints)}`}
                  </AppText>
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
  rowPoints: {
    color: colors.moss,
  },
  rowPointsMuted: {
    color: colors.muted,
  },
});
