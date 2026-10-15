import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { PointsBalance } from '../../components/PointsBalance';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { colors, spacing } from '../../theme/tokens';
import { useAuth } from '../auth/AuthProvider';
import { useBalance } from '../earning/BalanceProvider';
import { ValidateSwipe } from '../today/ValidateSwipe';
import {
  formatCountdown,
  formatRedeemedAt,
  isConfirmationExpired,
  remainingConfirmationMs,
} from './confirmation';
import { requestDeviceLocation } from './deviceLocation';
import {
  lookupVoucher,
  submitTill,
  type RedeemConfirmation,
  type RedeemReason,
} from './submitRedeem';

type Phase =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'ready'; voucher: RedeemConfirmation }
  | { kind: 'submitting'; voucher: RedeemConfirmation }
  | { kind: 'unconfirmed'; voucher: RedeemConfirmation }
  | { kind: 'blocked'; voucher: RedeemConfirmation; reason: RedeemReason | 'denied' | 'location_read' }
  | { kind: 'confirmed'; voucher: RedeemConfirmation };

function blockedCopy(reason: RedeemReason | 'denied' | 'location_read') {
  if (reason === 'denied') {
    return 'Location access is needed to collect this reward. Enable it for Brew & Move, then try again.';
  }
  if (reason === 'location_read' || reason === 'unavailable') {
    return 'Your location could not be read. Try again at the café.';
  }
  if (reason === 'outside_geofence') {
    return 'You need to be at the partner location to collect this reward.';
  }
  if (reason === 'location_unavailable') {
    return 'This café is not ready yet.';
  }
  return 'This reward could not be collected. Try again.';
}

export function VoucherScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const redemptionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const insets = useSafeAreaInsets();
  const { applyBalance } = useBalance();
  const { beginAccountAction, profileStatus, sessionStatus } = useAuth();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [resetKey, setResetKey] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const accountReady = sessionStatus === 'signedIn' && profileStatus === 'ready';

  const load = useCallback(async () => {
    if (!redemptionId) {
      setPhase({ kind: 'missing' });
      return;
    }
    const voucher = await lookupVoucher(redemptionId);
    if (!voucher) {
      setPhase({ kind: 'missing' });
      return;
    }
    if (voucher.tillConfirmedAt) {
      setPhase({ kind: 'confirmed', voucher });
      return;
    }
    setPhase({ kind: 'ready', voucher });
  }, [redemptionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (phase.kind !== 'confirmed') {
      return;
    }
    const tick = () => setNowMs(Date.now());
    tick();
    const timer = setInterval(tick, 250);
    return () => {
      clearInterval(timer);
    };
  }, [phase.kind]);

  const swipe = useCallback(async () => {
    if (phase.kind !== 'ready' && phase.kind !== 'unconfirmed' && phase.kind !== 'blocked') {
      return;
    }
    const voucher = phase.voucher;
    setPhase({ kind: 'submitting', voucher });
    try {
      const location = await requestDeviceLocation();
      if (location.kind === 'denied') {
        setPhase({ kind: 'blocked', reason: 'denied', voucher });
        setResetKey((current) => current + 1);
        return;
      }
      if (location.kind === 'unavailable') {
        setPhase({ kind: 'blocked', reason: 'location_read', voucher });
        setResetKey((current) => current + 1);
        return;
      }
      const result = await submitTill({
        latitude: location.latitude,
        longitude: location.longitude,
        redemptionId: voucher.redemptionId,
        requestId: randomUUID(),
      });
      if (result.balance != null) {
        applyBalance(result.balance);
      }
      if (result.reason === 'redeemed' && result.confirmation) {
        setPhase({ kind: 'confirmed', voucher: result.confirmation });
        setResetKey((current) => current + 1);
        return;
      }
      if (!result.confirmed) {
        const existing = await lookupVoucher(voucher.redemptionId);
        if (existing?.tillConfirmedAt) {
          setPhase({ kind: 'confirmed', voucher: existing });
        } else {
          setPhase({ kind: 'unconfirmed', voucher });
        }
        setResetKey((current) => current + 1);
        return;
      }
      if (result.reason === 'not_onboarded' || result.reason === 'not_signed_in') {
        beginAccountAction({ offerId: voucher.offerId, type: 'redeem' });
        setPhase({ kind: 'ready', voucher });
        setResetKey((current) => current + 1);
        return;
      }
      setPhase({ kind: 'blocked', reason: result.reason, voucher });
      setResetKey((current) => current + 1);
    } catch {
      setPhase({ kind: 'unconfirmed', voucher });
      setResetKey((current) => current + 1);
    }
  }, [applyBalance, beginAccountAction, phase]);

  if (phase.kind === 'loading' || phase.kind === 'missing') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.missingTop}>
          <ScreenBackButton accessibilityLabel="Back" />
        </View>
        <AppText role="heading" style={styles.missingCopy}>
          {phase.kind === 'missing' ? 'This reward could not be found.' : 'Loading reward'}
        </AppText>
      </View>
    );
  }

  const voucher = phase.voucher;
  const clockStart = voucher.tillConfirmedAt;
  const expired = clockStart ? isConfirmationExpired(clockStart, nowMs) : false;
  const remaining = clockStart ? remainingConfirmationMs(clockStart, nowMs) : 0;
  const showConfirm = phase.kind === 'confirmed';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.top}>
        <ScreenBackButton accessibilityLabel="Back" />
        <PointsBalance />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <AppText accessibilityRole="header" role="heading">{voucher.partner}</AppText>
        <AppText role="body" style={styles.title}>{voucher.title}</AppText>
        <AppText role="caption" style={styles.meta}>{voucher.location}</AppText>
        {showConfirm ? (
          <View style={styles.confirmation}>
            <AppText role="title" style={expired ? styles.expiredTitle : styles.redeemedTitle}>
              {expired ? 'Expired' : 'Redeemed'}
            </AppText>
            <AppText role="body" style={styles.confirmationCopy}>{voucher.valueLabel}</AppText>
            <AppText role="caption" style={styles.meta}>
              {formatRedeemedAt(clockStart ?? voucher.redeemedAt)}
            </AppText>
            <AppText role="stat" style={expired ? styles.expiredCount : styles.liveCount}>
              {expired ? '0:00' : formatCountdown(remaining)}
            </AppText>
            <AppText role="caption" style={styles.note}>
              {expired
                ? 'The reward was redeemed. This screen is no longer valid for staff.'
                : 'Show this screen to staff. They apply the discount on their till.'}
            </AppText>
          </View>
        ) : (
          <AppText role="body" style={styles.copy}>
            Points are already used. Swipe when staff can see this screen.
          </AppText>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {showConfirm ? (
          <PillButton appearance="primary" fullWidth label="Done" onPress={() => router.back()} size="large" />
        ) : !accountReady ? (
          <PillButton
            appearance="primary"
            fullWidth
            label="Sign in to collect"
            onPress={() => beginAccountAction({ offerId: voucher.offerId, type: 'redeem' })}
            size="large"
          />
        ) : (
          <>
            {phase.kind === 'blocked' ? (
              <AppText role="body" style={styles.blocked}>{blockedCopy(phase.reason)}</AppText>
            ) : null}
            {phase.kind === 'unconfirmed' ? (
              <AppText role="body" style={styles.blocked}>That collection could not be confirmed. Try again.</AppText>
            ) : null}
            <AppText role="body" style={styles.instruction}>Swipe when staff can see this screen.</AppText>
            <ValidateSwipe
              accessibilityHint="Confirms collection after a fresh location check"
              accessibilityLabel="Collect reward"
              disabled={phase.kind === 'submitting'}
              label={phase.kind === 'submitting' ? 'Collecting' : 'Collect'}
              onComplete={() => {
                void swipe();
              }}
              resetKey={resetKey}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.field,
    flex: 1,
  },
  top: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  missingTop: {
    paddingHorizontal: spacing.lg,
  },
  missingCopy: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    marginTop: 4,
  },
  meta: {
    color: colors.muted,
    marginTop: 4,
  },
  copy: {
    marginTop: spacing.xl,
  },
  confirmation: {
    marginTop: spacing.xl,
  },
  redeemedTitle: {
    color: colors.moss,
  },
  expiredTitle: {
    color: colors.blocked,
  },
  confirmationCopy: {
    marginTop: spacing.sm,
  },
  liveCount: {
    marginTop: spacing.lg,
  },
  expiredCount: {
    color: colors.blocked,
    marginTop: spacing.lg,
  },
  note: {
    color: colors.muted,
    marginTop: spacing.sm,
  },
  footer: {
    backgroundColor: colors.card,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  instruction: {
    marginBottom: spacing.sm,
  },
  blocked: {
    marginBottom: spacing.md,
  },
});
