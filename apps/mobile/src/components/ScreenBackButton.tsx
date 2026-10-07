import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts } from '../theme/tokens';

export function ScreenBackButton({
  accessibilityLabel = 'Back',
}: Readonly<{ accessibilityLabel?: string }>) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={() => router.back()}
      style={styles.back}
    >
      <Text style={styles.backText}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 34,
    lineHeight: 37,
  },
});
