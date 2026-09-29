import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, spacing } from '../theme/tokens';
import { PointsBalance } from './PointsBalance';

type MemberHeaderProps = {
  eyebrow?: string;
  title: string;
};

export function MemberHeader({ eyebrow, title }: Readonly<MemberHeaderProps>) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <View style={styles.eyebrowSlot}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          </View>
          <Text accessibilityRole="header" style={styles.heading}>
            {title}
          </Text>
        </View>
        <PointsBalance />
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
  eyebrowSlot: {
    minHeight: 13,
  },
  eyebrow: {
    color: colors.moss,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  heading: {
    color: colors.ink,
    fontFamily: fonts.displayExtra,
    fontSize: 40,
    letterSpacing: -1.4,
  },
});
