import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useBalance } from '../features/earning/BalanceProvider';
import { colors, fonts } from '../theme/tokens';
import { AppText } from './AppText';

export function PointsBalance() {
  const { balance } = useBalance();
  const label = balance == null ? 'Brew Points loading' : `${balance} Brew Points`;
  const value = balance == null ? '—' : String(balance);

  return (
    <Pressable
      accessibilityHint="Opens your profile"
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => {
        router.push('/profile');
      }}
      style={styles.container}
    >
      <View style={styles.stamp}>
        <Text style={styles.stampText}>B</Text>
      </View>
      <AppText role="action" style={styles.value}>
        {value}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
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
  value: {
    color: colors.ink,
  },
});
