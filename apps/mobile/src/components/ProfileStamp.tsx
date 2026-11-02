import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts } from '../theme/tokens';

export function ProfileStamp() {
  return (
    <Pressable
      accessibilityHint="Opens your profile"
      accessibilityLabel="Profile"
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => {
        router.push('/profile');
      }}
      style={styles.stamp}
    >
      <Text style={styles.stampText}>B</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stamp: {
    alignItems: 'center',
    backgroundColor: colors.brass,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  stampText: {
    color: colors.card,
    fontFamily: fonts.displayExtra,
    fontSize: 17,
  },
});
