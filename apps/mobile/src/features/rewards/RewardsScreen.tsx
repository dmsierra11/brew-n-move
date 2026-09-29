import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { OfferIllustration } from '../../components/OfferIllustration';
import { motionDurations, motionSprings } from '../../motion/presets';
import { colors, fonts, radii, spacing } from '../../theme/tokens';
import { formatNumber } from '../../utils/format';
import { Offer, offers } from './offers';

type RewardCardProps = Readonly<{
  offer: Offer;
}>;

const navigateToOffer = () => router.push('/offer');

function RewardCard({ offer }: RewardCardProps) {
  const cardScale = useSharedValue(1);
  const artShift = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));
  const artStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(artShift.value, [0, 1], [0, -4]) },
      { rotate: `${interpolate(artShift.value, [0, 1], [0, -2])}deg` },
    ],
  }));

  const pressIn = () => {
    if (reduceMotion) {
      return;
    }

    cardScale.value = withSpring(0.975, motionSprings.press);
    artShift.value = withSpring(1, motionSprings.art);
  };

  const pressOut = () => {
    if (reduceMotion) {
      return;
    }

    cardScale.value = withSpring(1, motionSprings.settle);
    artShift.value = withSpring(0, motionSprings.art);
  };

  const openOffer = () => {
    if (reduceMotion) {
      navigateToOffer();
      return;
    }

    cardScale.value = withSequence(
      withTiming(0.97, { duration: motionDurations.navigationPressIn }),
      withTiming(1, { duration: motionDurations.navigationPressOut }, (finished) => {
        if (finished) {
          scheduleOnRN(navigateToOffer);
        }
      }),
    );
  };

  return (
    <Animated.View style={cardStyle}>
      <Pressable
        accessibilityHint="Opens the offer redemption screen"
        accessibilityRole="button"
        onPress={openOffer}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.card}
      >
        <Animated.View
          style={[
            styles.art,
            { backgroundColor: offer.accent },
            artStyle,
          ]}
        >
          <OfferIllustration kind={offer.illustration} />
        </Animated.View>

        <View style={styles.cardBody}>
          <Text style={styles.partner}>{offer.partner}</Text>
          <Text style={styles.title}>{offer.title}</Text>
          <View style={styles.cardBottom}>
            <Text style={styles.value}>{offer.value}</Text>
            <View style={styles.cost}>
              <Text style={styles.costValue}>{formatNumber(offer.points)}</Text>
              <Text style={styles.costLabel}>points</Text>
            </View>
          </View>
        </View>

        <Text style={styles.arrow} accessibilityElementsHidden>
          ›
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function RewardsScreen() {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Choose a café treat.</Text>

        <View style={styles.list}>
          {offers.map((offer) => (
            <RewardCard key={offer.id} offer={offer} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.field,
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  intro: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23,
    marginTop: spacing.lg,
    maxWidth: 330,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 144,
    overflow: 'hidden',
    padding: spacing.md,
  },
  art: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 116,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 106,
  },
  cardBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  partner: {
    color: colors.moss,
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 23,
    marginTop: 4,
  },
  cardBottom: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  value: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  cost: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 4,
  },
  costValue: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  costLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  arrow: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 30,
    marginLeft: spacing.sm,
  },
});
