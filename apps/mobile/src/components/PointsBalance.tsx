import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme/tokens';

type PointsBalanceProps = {
  balance?: number;
};

export function PointsBalance({ balance = 412 }: Readonly<PointsBalanceProps>) {
  return (
    <View style={styles.container} accessibilityLabel={`${balance} Brew Points`}>
      <View style={styles.stamp}>
        <Text style={styles.stampText}>B</Text>
      </View>
      <Text style={styles.value}>{balance}</Text>
    </View>
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
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
});
