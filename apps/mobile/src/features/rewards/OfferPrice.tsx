import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { colors } from '../../theme/tokens';
import { formatEuro, formatNumber } from '../../utils/format';

type OfferPriceProps = Readonly<{
  layout?: 'inline' | 'stacked';
  listPriceCents: number;
  payPriceCents: number;
  points: number;
  prominent?: boolean;
}>;

export function OfferPrice({
  layout = 'inline',
  listPriceCents,
  payPriceCents,
  points,
  prominent = false,
}: OfferPriceProps) {
  const payLabel = payPriceCents === 0 ? 'Free' : formatEuro(payPriceCents);
  const pointsLabel = `${formatNumber(points)} Brew Points`;

  return (
    <View
      accessibilityLabel={`Full price ${formatEuro(listPriceCents)}, ${payLabel}, ${pointsLabel}`}
      accessible
      style={[styles.block, layout === 'inline' && styles.inlineBlock]}
    >
      <View style={[styles.prices, layout === 'stacked' && styles.stackedPrices]}>
        <AppText role="caption" style={styles.listPrice}>{formatEuro(listPriceCents)}</AppText>
        <AppText role={prominent ? 'value' : 'action'} style={styles.payPrice}>
          {payLabel}
        </AppText>
      </View>
      <AppText role="caption" style={styles.points}>{pointsLabel}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'flex-start',
  },
  inlineBlock: {
    alignItems: 'flex-end',
  },
  prices: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
  },
  stackedPrices: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: 0,
  },
  listPrice: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  payPrice: {
    color: colors.ink,
  },
  points: {
    color: colors.muted,
    marginTop: 2,
  },
});
