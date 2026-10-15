import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { PointsBalance } from '../../components/PointsBalance';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { colors, spacing } from '../../theme/tokens';
import { useAuth } from '../auth/AuthProvider';
import { useBalance } from '../earning/BalanceProvider';
import { FavouriteButton } from '../rewards/FavouriteButton';
import { OfferBanner } from '../rewards/OfferBanner';
import { OfferPrice } from '../rewards/OfferPrice';
import { loadOffer, type Offer } from '../rewards/offers';
import { submitExchange, type RedeemReason } from './submitRedeem';

const collectionInstructions =
  'Use your points now, then open My rewards at the café and swipe when staff can see this screen.';

type Phase =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'unconfirmed' }
  | { kind: 'blocked'; reason: RedeemReason };

function blockedCopy(reason: RedeemReason) {
  if (reason === 'insufficient_balance') {
    return 'You need more Brew Points for this reward.';
  }
  if (reason === 'budget_exhausted' || reason === 'sold_out' || reason === 'offer_unavailable') {
    return 'This reward is not available to use right now.';
  }
  if (reason === 'not_onboarded' || reason === 'not_signed_in') {
    return 'Finish your account before using points.';
  }
  return 'This reward could not be used. Try again.';
}

function PinIcon() {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22}>
      <Path
        d="M12 21s6.4-5.3 6.4-10.1A6.4 6.4 0 0 0 12 4.5a6.4 6.4 0 0 0-6.4 6.4C5.6 15.7 12 21 12 21z"
        fill="none"
        stroke={colors.moss}
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
      <Circle cx="12" cy="10.7" fill="none" r="2.1" stroke={colors.moss} strokeWidth={1.8} />
    </Svg>
  );
}

function ClockIcon() {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22}>
      <Circle cx="12" cy="12" fill="none" r="7.5" stroke={colors.moss} strokeWidth={1.8} />
      <Path d="M12 8.2V12l2.6 1.8" fill="none" stroke={colors.moss} strokeLinecap="round" strokeWidth={1.8} />
    </Svg>
  );
}

function DetailFact({ icon, label }: Readonly<{ icon: ReactNode; label: string }>) {
  return (
    <View style={styles.fact}>
      {icon}
      <AppText role="body" style={styles.factLabel}>{label}</AppText>
    </View>
  );
}

export function RedeemScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const offerId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { applyBalance } = useBalance();
  const { beginAccountAction, profileStatus, retryProfile, sessionStatus } = useAuth();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const accountReady = sessionStatus === 'signedIn' && profileStatus === 'ready';
  const accountLoading = sessionStatus === 'loading' || (sessionStatus === 'signedIn' && profileStatus === 'loading');
  const imageHeight = Math.max(240, Math.round(width * 0.7));

  useEffect(() => {
    setOffer(null);
    setPhase({ kind: 'loading' });
    if (!offerId) {
      setPhase({ kind: 'missing' });
      return;
    }
    let cancelled = false;
    void loadOffer(offerId).then((next) => {
      if (cancelled) {
        return;
      }
      if (!next) {
        setPhase({ kind: 'missing' });
        return;
      }
      setOffer(next);
      setPhase({ kind: 'ready' });
    });
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  const exchange = useCallback(async () => {
    if (!offer || phase.kind === 'submitting') {
      return;
    }
    setPhase({ kind: 'submitting' });
    try {
      const result = await submitExchange({
        commit: true,
        offerId: offer.id,
        requestId: randomUUID(),
      });
      if (result.balance != null) {
        applyBalance(result.balance);
      }
      if (result.reason === 'issued' && result.confirmation) {
        router.replace({ pathname: '/voucher/[id]', params: { id: result.confirmation.redemptionId } });
        return;
      }
      if (!result.confirmed) {
        setPhase({ kind: 'unconfirmed' });
        return;
      }
      if (result.reason === 'not_onboarded' || result.reason === 'not_signed_in') {
        setPhase({ kind: 'ready' });
        beginAccountAction({ offerId: offer.id, type: 'redeem' });
        return;
      }
      setPhase({ kind: 'blocked', reason: result.reason });
    } catch {
      setPhase({ kind: 'unconfirmed' });
    }
  }, [applyBalance, beginAccountAction, offer, phase.kind]);

  const actionLabel = accountLoading
    ? 'Checking account'
    : profileStatus === 'error'
      ? 'Try again'
      : profileStatus === 'missing'
        ? 'Finish account'
        : 'Sign in to use points';

  const onAccountPress = () => {
    if (accountLoading || !offer) {
      return;
    }
    if (profileStatus === 'error') {
      void retryProfile();
      return;
    }
    beginAccountAction({ offerId: offer.id, type: 'redeem' });
  };

  if (!offer) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.missingTop}>
          <ScreenBackButton accessibilityLabel="Back to rewards" />
        </View>
        <AppText role="heading" style={styles.missingCopy}>
          {phase.kind === 'missing' ? 'This reward could not be found.' : 'Loading reward'}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View>
          <OfferBanner
            accent={offer.accent}
            height={imageHeight}
            illustration={offer.illustration}
            imageUrl={offer.imageUrl}
          />
          <View style={[styles.overlay, { top: insets.top + spacing.sm }]}>
            <ScreenBackButton accessibilityLabel="Back to rewards" />
            <View style={styles.overlayActions}>
              <FavouriteButton offerId={offer.id} surface="overlay" />
              <View style={styles.pointsChip}>
                <PointsBalance />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <AppText accessibilityRole="header" role="heading" style={styles.partnerName}>{offer.partner}</AppText>
          <AppText role="body" style={styles.offerTitle}>{offer.title}</AppText>
          <DetailFact icon={<PinIcon />} label={offer.address} />
          {offer.collectLabel ? <DetailFact icon={<ClockIcon />} label={offer.collectLabel} /> : null}
          <View style={styles.section}>
            <AppText role="heading">About this offer</AppText>
            <AppText role="body" style={styles.sectionCopy}>{offer.description}</AppText>
          </View>
          <View style={styles.section}>
            <AppText role="heading">Collection instructions</AppText>
            <AppText role="body" style={styles.sectionCopy}>{collectionInstructions}</AppText>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.priceRow}>
          <View style={styles.priceSlot}>
            <OfferPrice
              layout="stacked"
              listPriceCents={offer.listPriceCents}
              payPriceCents={offer.payPriceCents}
              points={offer.points}
              prominent
            />
          </View>
          {accountReady && (phase.kind === 'ready' || phase.kind === 'submitting') ? (
            <PillButton
              appearance="primary"
              label={phase.kind === 'submitting' ? 'Using points' : 'Use points'}
              onPress={() => {
                void exchange();
              }}
            />
          ) : null}
        </View>
        {phase.kind === 'blocked' ? (
          <View style={styles.footerAction}>
            <AppText role="body" style={styles.blocked}>{blockedCopy(phase.reason)}</AppText>
            <PillButton appearance="primary" fullWidth label="Try again" onPress={() => setPhase({ kind: 'ready' })} />
          </View>
        ) : null}
        {phase.kind === 'unconfirmed' ? (
          <View style={styles.footerAction}>
            <AppText role="body" style={styles.blocked}>Those points could not be confirmed. Try again.</AppText>
            <PillButton appearance="primary" fullWidth label="Try again" onPress={() => { void exchange(); }} />
          </View>
        ) : null}
        {!accountReady && phase.kind === 'ready' ? (
          <View style={styles.footerAction}>
            <PillButton appearance="primary" fullWidth label={actionLabel} onPress={onAccountPress} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.field,
    flex: 1,
  },
  scroll: {
    paddingBottom: spacing.xl,
  },
  overlay: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: spacing.lg,
    position: 'absolute',
    right: spacing.lg,
  },
  overlayActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pointsChip: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  partnerName: {
    fontSize: 28,
    lineHeight: 32,
  },
  offerTitle: {
    color: colors.ink,
    marginTop: 4,
  },
  fact: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  factLabel: {
    color: colors.ink,
    flex: 1,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionCopy: {
    color: colors.ink,
    marginTop: spacing.sm,
  },
  footer: {
    backgroundColor: colors.card,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  priceSlot: {
    flexShrink: 1,
  },
  footerAction: {
    marginTop: spacing.md,
  },
  blocked: {
    color: colors.ink,
    marginBottom: spacing.md,
  },
  missingTop: {
    paddingHorizontal: spacing.lg,
  },
  missingCopy: {
    color: colors.ink,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
