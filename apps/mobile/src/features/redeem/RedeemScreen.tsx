import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { colors, spacing } from '../../theme/tokens';
import { useAuth } from '../auth/AuthProvider';
import { selectedOffer } from '../rewards/offers';

export function RedeemScreen() {
  const { beginAccountAction, profileStatus, retryProfile, sessionStatus } = useAuth();
  const accountReady = sessionStatus === 'signedIn' && profileStatus === 'ready';
  const accountLoading = sessionStatus === 'loading' || (sessionStatus === 'signedIn' && profileStatus === 'loading');
  const actionLabel = accountLoading
    ? 'Checking account'
    : profileStatus === 'error'
      ? 'Try again'
      : profileStatus === 'missing'
        ? 'Finish account'
        : 'Sign in to redeem';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <ScreenBackButton accessibilityLabel="Back to rewards" />

        <View style={styles.offerBlock}>
          <AppText role="eyebrow" style={styles.partner}>{selectedOffer.partner}</AppText>
          <AppText role="caption" style={styles.location}>{selectedOffer.location}</AppText>
          <AppText role="display" style={styles.offer}>{selectedOffer.title}</AppText>
          <AppText role="value" style={styles.value}>{selectedOffer.value}</AppText>
        </View>

        {accountReady ? null : (
          <View style={styles.action}>
            <PillButton
              appearance="primary"
              fullWidth
              label={actionLabel}
              onPress={() => {
                if (accountLoading) {
                  return;
                }

                if (profileStatus === 'error') {
                  void retryProfile();
                  return;
                }

                beginAccountAction({ type: 'redeem' });
              }}
            />
          </View>
        )}

        <AppText role="caption" style={styles.note}>
          Redemption is not available yet. This screen does not spend Brew Points or show a confirmation for café staff.
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.field,
    flex: 1,
  },
  page: {
    flex: 1,
    padding: spacing.lg,
  },
  offerBlock: {
    marginTop: 44,
  },
  partner: {
    color: colors.moss,
  },
  location: {
    color: colors.muted,
    marginTop: 4,
  },
  offer: {
    color: colors.ink,
    marginTop: spacing.xl,
    maxWidth: 330,
  },
  value: {
    color: colors.brass,
    marginTop: spacing.sm,
  },
  action: {
    marginTop: spacing.xl,
  },
  note: {
    color: colors.muted,
    marginTop: spacing.md,
  },
});
