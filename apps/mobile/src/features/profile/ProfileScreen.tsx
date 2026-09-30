import { useState } from 'react';
import {
  Modal,
  Platform,
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
import { colors, radii, spacing, typography } from '../../theme/tokens';

const healthPlatform = Platform.select({
  android: 'Health Connect',
  ios: 'Apple Health',
  default: 'Apple Health',
});

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
  const [displayName, setDisplayName] = useState('Daniel');
  const [healthConnected, setHealthConnected] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ProfileSheet>(null);

  const handleHealthPress = () => {
    if (healthConnected) {
      setActiveSheet('health');
    } else {
      setHealthConnected(true);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.group}>
          <AppText role="eyebrow" style={styles.groupLabel}>Account</AppText>
          <View style={styles.card}>
            <View style={styles.row}>
              <AppText role="caption" style={styles.fieldLabel}>Email</AppText>
              <AppText role="body">daniel@example.com</AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <AppText role="caption" style={styles.fieldLabel}>Display name</AppText>
              <TextInput
                accessibilityLabel="Display name"
                autoCapitalize="words"
                onChangeText={setDisplayName}
                returnKeyType="done"
                selectionColor={colors.moss}
                style={styles.input}
                value={displayName}
              />
              <AppText role="caption" style={styles.fieldNote}>
                This is how your name appears in communities.
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.group}>
          <AppText role="eyebrow" style={styles.groupLabel}>Health</AppText>
          <View style={[styles.card, styles.healthCard]}>
            <View style={styles.healthCopy}>
              <AppText role="heading">{healthPlatform}</AppText>
              <AppText role="caption" style={styles.healthStatus}>
                {healthConnected
                  ? 'Connected for verified step sync.'
                  : 'Connect to count eligible steps.'}
              </AppText>
            </View>
            <PillButton
              accessibilityLabel={
                healthConnected
                  ? `Manage ${healthPlatform} connection`
                  : `Connect ${healthPlatform}`
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
              onPress={() => undefined}
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
                ? `Manage ${healthPlatform}`
                : 'Delete your account?'}
            </AppText>
            <AppText role="body" style={styles.sheetCopy}>
              {activeSheet === 'health'
                ? 'Disconnecting stops future step sync. Brew Points you already earned stay in your balance.'
                : 'This will permanently delete your account and associated personal data. Your Brew Points cannot be recovered.'}
            </AppText>
            <View style={styles.sheetActions}>
              <PillButton
                appearance="danger"
                fullWidth
                label={
                  activeSheet === 'health'
                    ? 'Disconnect step sync'
                    : 'Delete account'
                }
                onPress={() => {
                  if (activeSheet === 'health') {
                    setHealthConnected(false);
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.field,
    flex: 1,
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
