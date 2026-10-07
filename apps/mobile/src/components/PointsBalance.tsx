import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme/tokens';
import { AppText } from './AppText';

type PointsBalanceProps = {
  balance?: number;
};

export function PointsBalance({ balance = 0 }: Readonly<PointsBalanceProps>) {
  return (
    <View style={styles.container} accessibilityLabel={`${balance} Brew Points`}>
      <View style={styles.stamp}>
        <Text style={styles.stampText}>B</Text>
      </View>
      <AppText role="action" style={styles.value}>{balance}</AppText>
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
  },
});
