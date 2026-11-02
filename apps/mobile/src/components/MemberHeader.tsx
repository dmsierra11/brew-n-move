import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme/tokens';
import { AppText } from './AppText';
import { ProfileStamp } from './ProfileStamp';

type MemberHeaderProps = {
  eyebrow?: string;
  title: string;
};

export function MemberHeader({ eyebrow, title }: Readonly<MemberHeaderProps>) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <View style={styles.eyebrowSlot}>
            {eyebrow ? (
              <AppText role="eyebrow" style={styles.eyebrow}>
                {eyebrow}
              </AppText>
            ) : null}
          </View>
          <AppText accessibilityRole="header" role="title" style={styles.heading}>
            {title}
          </AppText>
        </View>
        <ProfileStamp />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.field,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  copy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  eyebrowSlot: {
    minHeight: 13,
  },
  eyebrow: {
    color: colors.moss,
    letterSpacing: 1.5,
  },
  heading: {
    color: colors.ink,
    letterSpacing: -1.4,
  },
});
