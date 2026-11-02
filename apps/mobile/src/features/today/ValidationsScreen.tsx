import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { useAuth } from '../auth/AuthProvider';
import { useBalance } from '../earning/BalanceProvider';
import { colors, radii, spacing } from '../../theme/tokens';
import { formatNumber } from '../../utils/format';
import {
  formatAwardMeta,
  formatDayHeading,
  formatRowTime,
  loadMemberActivity,
  type ActivityRow,
  type DayGroup,
} from './activity';

function FootprintsIcon({ color }: Readonly<{ color: string }>) {
  return (
    <Svg height={20} viewBox="0 0 24 24" width={20}>
      <Path
        d="M7.2 4.8c1.4-.2 2.6 1.1 2.3 2.6-.4 1.8-2.2 3.1-2.8 4.8-.4 1.1.2 2.3 1.3 2.6"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={1.8}
      />
      <Path
        d="M5.4 7.1c-.7.1-1.2.8-1 1.5M9.8 6.4c.7 0 1.2.6 1.1 1.3"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={1.6}
      />
      <Path
        d="M15.4 5.6c1.4-.3 2.7 1 2.5 2.5-.3 1.9-2 3.3-2.4 5-.3 1.2.4 2.3 1.5 2.5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={1.8}
      />
      <Path
        d="M13.7 8c-.7.2-1.1.9-.9 1.5M18.1 7.1c.7 0 1.2.6 1.1 1.3"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={1.6}
      />
    </Svg>
  );
}

function TicketIcon({ color }: Readonly<{ color: string }>) {
  return (
    <Svg height={20} viewBox="0 0 24 24" width={20}>
      <Path
        d="M4.5 8.2c0-.9.7-1.7 1.7-1.7h11.6c.9 0 1.7.8 1.7 1.7v2.1a1.7 1.7 0 0 0 0 3.4v2.1c0 .9-.8 1.7-1.7 1.7H6.2c-1 0-1.7-.8-1.7-1.7v-2.1a1.7 1.7 0 0 0 0-3.4z"
        fill="none"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
      <Path
        d="M10 7.5v9"
        fill="none"
        stroke={color}
        strokeDasharray="2 2.5"
        strokeLinecap="round"
        strokeWidth={1.6}
      />
      <Rect fill={color} height="1.8" rx="0.9" width="4" x="13.2" y="10.2" />
      <Rect fill={color} height="1.8" rx="0.9" width="4" x="13.2" y="13.2" />
    </Svg>
  );
}

function ActivityTypeIcon({ kind }: Readonly<{ kind: ActivityRow['kind'] }>) {
  const award = kind === 'award';

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.iconBadge, award ? styles.iconBadgeAward : styles.iconBadgeRedeem]}
    >
      {award ? (
        <FootprintsIcon color={colors.moss} />
      ) : (
        <TicketIcon color={colors.brass} />
      )}
    </View>
  );
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

    const result = await loadMemberActivity(userId);
    if (!result.ok) {
      setFailed(true);
      setGroups([]);
      return;
    }

    setFailed(false);
    setGroups(result.groups);
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
        <ScreenBackButton accessibilityLabel="Back" />
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
                  <ActivityTypeIcon kind={row.kind} />
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
  iconBadge: {
    alignItems: 'center',
    borderRadius: radii.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconBadgeAward: {
    backgroundColor: colors.mossSoft,
  },
  iconBadgeRedeem: {
    backgroundColor: colors.brassSoft,
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
    color: colors.brass,
  },
  rowPointsMuted: {
    color: colors.muted,
  },
});
