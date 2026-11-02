import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { useAuth } from '../auth/AuthProvider';
import { requestEmailVerification } from '../auth/emailVerification';
import { useHealth } from '../health/HealthProvider';
import { healthPlatformName } from '../health/platform';
import { colors, radii, spacing, typography } from '../../theme/tokens';

function ProfileChrome({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.topBar}>
        <ScreenBackButton accessibilityLabel="Back" />
        <AppText accessibilityRole="header" role="title" style={styles.topTitle}>
          Profile
        </AppText>
      </View>
      {children}
    </SafeAreaView>
  );
}

type ProfileSheet = 'delete-account' | 'health' | null;

function CheckIcon() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg height={18} viewBox="0 0 18 18" width={18}>
        <Path
          d="m3.5 9.5 3.3 3.2 7.7-8"
          fill="none"
          stroke={colors.ink}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </Svg>
    </View>
  );
}

export function ProfileScreen() {
  const { connect, manage, status } = useHealth();
  const {
    email,
    member,
    profileStatus,
    refreshMember,
    retryProfile,
    sessionStatus,
    signOut,
    updateDisplayName,
  } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [nameMessage, setNameMessage] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [verifyFailed, setVerifyFailed] = useState(false);
  const [verifySending, setVerifySending] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ProfileSheet>(null);
  const healthConnected = status === 'granted';

  useEffect(() => {
    setDisplayName(member?.displayName ?? '');
  }, [member?.displayName]);

  const handleHealthPress = () => {
    if (healthConnected) {
      setActiveSheet('health');
    } else {
      void connect();
    }
  };

  if (sessionStatus === 'loading' || (sessionStatus === 'signedIn' && profileStatus === 'loading')) {
    return (
      <ProfileChrome>
        <View style={styles.guest}>
          <AppText role="body">Loading your account</AppText>
        </View>
      </ProfileChrome>
    );
  }

  if (sessionStatus === 'guest') {
    return (
      <ProfileChrome>
        <View style={styles.guest}>
          <AppText accessibilityRole="header" role="heading">Save your walks</AppText>
          <AppText role="body" style={styles.guestCopy}>
            Create an account when you want to validate steps or redeem a reward. You can look around first.
          </AppText>
          <PillButton
            appearance="primary"
            fullWidth
            label="Create account"
            onPress={() => router.push('/sign-up')}
          />
          <PillButton
            appearance="quiet"
            fullWidth
            label="Sign in"
            onPress={() => router.push('/sign-in')}
          />
        </View>
      </ProfileChrome>
    );
  }

  if (profileStatus === 'missing') {
    return (
      <ProfileChrome>
        <View style={styles.guest}>
          <AppText role="heading">Finish your account</AppText>
          <AppText role="body" style={styles.guestCopy}>
            Add your name to continue. This does not issue Brew Points.
          </AppText>
          <PillButton
            appearance="primary"
            fullWidth
            label="Continue"
            onPress={() => router.push('/onboarding')}
          />
        </View>
      </ProfileChrome>
    );
  }

  if (profileStatus === 'error' || !member) {
    return (
      <ProfileChrome>
        <View style={styles.guest}>
          <AppText role="heading">Account unavailable</AppText>
          <AppText role="body" style={styles.guestCopy}>
            We could not load your account. Your session stays on this phone.
          </AppText>
          <PillButton
            appearance="primary"
            fullWidth
            label="Try again"
            onPress={() => {
              void retryProfile();
            }}
          />
          <PillButton
            appearance="quiet"
            fullWidth
            label="Sign out"
            onPress={() => {
              void signOut();
            }}
          />
        </View>
      </ProfileChrome>
    );
  }

  const saveDisplayName = () => {
    const next = displayName.trim();
    if (!next || next === member.displayName) {
      setDisplayName(member.displayName);
      setNameMessage('');
      return;
    }

    void updateDisplayName(next).then((error) => {
      setNameMessage(error ?? '');
      if (error) {
        setDisplayName(member.displayName);
      }
    });
  };

  const resendVerification = () => {
    setVerifySending(true);
    setVerifyMessage('');
    void requestEmailVerification().then((result) => {
      setVerifySending(false);
      if (result.sent) {
        setVerifyFailed(false);
        setVerifyMessage('We sent a verification email.');
        return;
      }

      if (result.error) {
        setVerifyFailed(true);
        setVerifyMessage(result.error);
        return;
      }

      void refreshMember();
    });
  };

  return (
    <ProfileChrome>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.group}>
          <AppText role="eyebrow" style={styles.groupLabel}>Account</AppText>
          {member.emailVerifiedAt ? null : (
            <View style={[styles.card, styles.verifyCard]}>
              <AppText role="heading">Verify your email</AppText>
              <AppText role="caption" style={styles.healthStatus}>
                Verify this email so we can recover your account.
              </AppText>
              {verifyMessage ? (
                <AppText role="caption" style={verifyFailed ? styles.nameError : styles.fieldNote}>
                  {verifyMessage}
                </AppText>
              ) : null}
              <PillButton
                appearance="primary"
                fullWidth
                label={verifySending ? 'Sending' : 'Resend'}
                onPress={resendVerification}
              />
            </View>
          )}
          <View style={styles.card}>
            <View style={styles.row}>
              <AppText role="caption" style={styles.fieldLabel}>Email</AppText>
              <AppText role="body">{email}</AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <AppText role="caption" style={styles.fieldLabel}>First name</AppText>
              <AppText role="body">{member.firstName}</AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <AppText role="caption" style={styles.fieldLabel}>Display name</AppText>
              <TextInput
                accessibilityLabel="Display name"
                autoCapitalize="words"
                onChangeText={setDisplayName}
                onEndEditing={saveDisplayName}
                returnKeyType="done"
                selectionColor={colors.moss}
                style={styles.input}
                value={displayName}
              />
              <AppText role="caption" style={[styles.fieldNote, nameMessage ? styles.nameError : null]}>
                {nameMessage || 'This is how your name appears in communities.'}
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.group}>
          <AppText role="eyebrow" style={styles.groupLabel}>Health</AppText>
          <View style={[styles.card, styles.healthCard]}>
            <View style={styles.healthCopy}>
              <AppText role="heading">{healthPlatformName}</AppText>
              <AppText role="caption" style={styles.healthStatus}>
                {healthConnected
                  ? 'Connected for verified step sync.'
                  : 'Connect to count eligible steps.'}
              </AppText>
            </View>
            <PillButton
              accessibilityLabel={
                healthConnected
                  ? `Manage ${healthPlatformName} connection`
                  : `Connect ${healthPlatformName}`
              }
              appearance={healthConnected ? 'muted' : 'primary'}
              label={healthConnected ? 'Connected' : 'Connect'}
              onPress={handleHealthPress}
              selected={healthConnected}
              trailing={healthConnected ? <CheckIcon /> : undefined}
            />
          </View>
        </View>

        <View style={styles.group}>
          <AppText role="eyebrow" style={styles.groupLabel}>Account management</AppText>
          <View style={styles.accountActions}>
            <PillButton
              appearance="quiet"
              fullWidth
              label="Sign out"
              onPress={() => {
                void signOut();
              }}
            />
            <PillButton
              accessibilityLabel="Delete Brew & Move account"
              appearance="dangerQuiet"
              fullWidth
              label="Delete account"
              onPress={() => setActiveSheet('delete-account')}
            />
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setActiveSheet(null)}
        presentationStyle="overFullScreen"
        transparent
        visible={activeSheet !== null}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close account action"
            accessibilityRole="button"
            onPress={() => setActiveSheet(null)}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView
            accessibilityViewIsModal
            edges={['bottom']}
            style={styles.sheet}
          >
            <View accessibilityElementsHidden style={styles.grabber} />
            <AppText accessibilityRole="header" role="heading">
              {activeSheet === 'health'
                ? `Manage ${healthPlatformName}`
                : 'Delete your account?'}
            </AppText>
            <AppText role="body" style={styles.sheetCopy}>
              {activeSheet === 'health'
                ? `Step access is managed in ${healthPlatformName}. Brew Points you already earned stay in your balance.`
                : 'This will permanently delete your account and associated personal data. Your Brew Points cannot be recovered.'}
            </AppText>
            <View style={styles.sheetActions}>
              <PillButton
                appearance={activeSheet === 'health' ? 'primary' : 'danger'}
                fullWidth
                label={
                  activeSheet === 'health'
                    ? `Open ${healthPlatformName}`
                    : 'Delete account'
                }
                onPress={() => {
                  if (activeSheet === 'health') {
                    void manage();
                  }
                  setActiveSheet(null);
                }}
              />
              <PillButton
                appearance="quiet"
                fullWidth
                label="Cancel"
                onPress={() => setActiveSheet(null)}
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </ProfileChrome>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.field,
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  topTitle: {
    color: colors.ink,
    flex: 1,
  },
  guest: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  guestCopy: {
    color: colors.muted,
  },
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  groupLabel: {
    color: colors.moss,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    padding: spacing.md,
  },
  fieldLabel: {
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  fieldNote: {
    color: colors.muted,
    marginTop: spacing.xs,
  },
  verifyCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  nameError: {
    color: colors.blocked,
  },
  divider: {
    backgroundColor: colors.line,
    height: 1,
    marginHorizontal: spacing.md,
  },
  input: {
    ...typography.body,
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: colors.ink,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  healthCard: {
    alignItems: 'center',
    flexDirection: 'row',
    padding: spacing.md,
  },
  healthCopy: {
    flex: 1,
    marginRight: spacing.md,
  },
  healthStatus: {
    color: colors.muted,
    marginTop: 3,
  },
  accountActions: {
    gap: spacing.sm,
  },
  modalRoot: {
    backgroundColor: 'rgba(26, 24, 20, 0.48)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 5,
    marginBottom: spacing.lg,
    width: 42,
  },
  sheetCopy: {
    color: colors.muted,
    marginTop: spacing.sm,
  },
  sheetActions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingBottom: spacing.md,
  },
});
