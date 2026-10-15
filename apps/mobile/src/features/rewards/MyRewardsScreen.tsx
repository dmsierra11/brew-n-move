import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { colors, radii, spacing } from '../../theme/tokens';
import { useAuth } from '../auth/AuthProvider';
import {
  listMyRewards,
  type RedeemConfirmation,
} from '../redeem/submitRedeem';

function statusLabel(row: RedeemConfirmation) {
  return row.tillConfirmedAt ? 'Collected' : 'Ready to collect';
}

export function MyRewardsScreen() {
  const insets = useSafeAreaInsets();
  const { profileStatus, sessionStatus } = useAuth();
  const [rows, setRows] = useState<RedeemConfirmation[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const signedIn = sessionStatus === 'signedIn' && profileStatus === 'ready';

  const load = useCallback(async () => {
    if (!signedIn) {
      setRows([]);
      setFailed(false);
      return;
    }
    const next = await listMyRewards();
    if (!next) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setRows(next);
  }, [signedIn]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.top}>
        <ScreenBackButton accessibilityLabel="Back to rewards" />
      </View>
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
        <AppText accessibilityRole="header" role="title">My rewards</AppText>
        <AppText role="body" style={styles.intro}>
          Open a reward at the café and swipe when staff can see this screen.
        </AppText>
        {failed ? (
          <View style={styles.retry}>
            <AppText role="caption" style={styles.muted}>Rewards could not be loaded.</AppText>
            <PillButton appearance="primary" label="Try again" onPress={() => { void load(); }} />
          </View>
        ) : null}
        {!signedIn ? (
          <AppText role="body" style={styles.muted}>Sign in to see rewards you have used points on.</AppText>
        ) : null}
        <View style={styles.list}>
          {(rows ?? []).map((row) => (
            <Pressable
              accessibilityRole="button"
              key={row.redemptionId}
              onPress={() => router.push({ pathname: '/voucher/[id]', params: { id: row.redemptionId } })}
              style={styles.card}
            >
              <AppText role="eyebrow">{statusLabel(row)}</AppText>
              <AppText role="heading" style={styles.partner}>{row.partner}</AppText>
              <AppText role="body">{row.title}</AppText>
              <AppText role="caption" style={styles.muted}>{row.location}</AppText>
            </Pressable>
          ))}
        </View>
        {signedIn && rows?.length === 0 && !failed ? (
          <AppText role="body" style={styles.muted}>No rewards yet. Use points from the Rewards list.</AppText>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.field,
    flex: 1,
  },
  top: {
    paddingHorizontal: spacing.lg,
  },
  content: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  intro: {
    color: colors.muted,
    marginTop: spacing.sm,
    maxWidth: 330,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  partner: {
    marginTop: spacing.sm,
  },
  muted: {
    color: colors.muted,
    marginTop: 4,
  },
  retry: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
