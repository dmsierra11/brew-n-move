import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { motionSprings } from '../../motion/presets';
import { colors, radii, spacing } from '../../theme/tokens';
import { FavouriteButton } from './FavouriteButton';
import { OfferBanner } from './OfferBanner';
import { OfferPrice } from './OfferPrice';
import { loadOffers, type Offer } from './offers';

const cardImageHeight = 168;

type RewardCardProps = Readonly<{
  offer: Offer;
}>;

const navigateToOffer = (offerId: string) => {
  router.push({ pathname: '/offer', params: { id: offerId } });
};

function RewardCard({ offer }: RewardCardProps) {
  const cardScale = useSharedValue(1);
  const artShift = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));
  const artStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(artShift.value, [0, 1], [0, -6]) }],
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

  return (
    <Animated.View style={cardStyle}>
      <View style={styles.card}>
        <Pressable
          accessibilityHint="Opens this offer"
          accessibilityRole="button"
          onPress={() => navigateToOffer(offer.id)}
          onPressIn={pressIn}
          onPressOut={pressOut}
        >
          <Animated.View style={artStyle}>
            <OfferBanner
              accent={offer.accent}
              height={cardImageHeight}
              illustration={offer.illustration}
              imageUrl={offer.imageUrl}
            />
          </Animated.View>
          <View style={styles.cardBody}>
            <AppText role="heading" style={styles.partner}>{offer.partner}</AppText>
            <AppText numberOfLines={2} role="body" style={styles.description}>{offer.title}</AppText>
            <View style={styles.metaRow}>
              {offer.collectLabel ? (
                <AppText role="caption" style={styles.collect}>{offer.collectLabel}</AppText>
              ) : null}
              <OfferPrice
                listPriceCents={offer.listPriceCents}
                payPriceCents={offer.payPriceCents}
                points={offer.points}
              />
            </View>
          </View>
        </Pressable>
        <View style={styles.heart}>
          <FavouriteButton offerId={offer.id} />
        </View>
      </View>
    </Animated.View>
  );
}

export function RewardsScreen() {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasOffers = useRef(false);

  const load = useCallback(async () => {
    const next = await loadOffers();
    if (!next) {
      if (!hasOffers.current) {
        setFailed(true);
      }
      return;
    }

    hasOffers.current = true;
    setFailed(false);
    setOffers(next);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <ScrollView
        alwaysBounceVertical
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.moss]}
            onRefresh={() => {
              void refresh();
            }}
            progressBackgroundColor={colors.card}
            refreshing={refreshing}
            tintColor={colors.moss}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <AppText role="body" style={styles.intro}>Choose a café treat.</AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/my-rewards')}
          style={styles.myRewards}
        >
          <AppText role="eyebrow">Your vouchers</AppText>
          <AppText role="heading">My rewards</AppText>
          <AppText role="caption" style={styles.myRewardsCopy}>
            Open a reward you have already used points on.
          </AppText>
        </Pressable>

        {failed ? (
          <View style={styles.retry}>
            <AppText role="caption" style={styles.retryCopy}>Rewards could not be loaded.</AppText>
            <PillButton appearance="primary" label="Try again" onPress={() => { void load(); }} />
          </View>
        ) : (
          <View style={styles.list}>
            {(offers ?? []).map((offer) => (
              <RewardCard key={offer.id} offer={offer} />
            ))}
          </View>
        )}
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
    marginTop: spacing.lg,
    maxWidth: 330,
  },
  myRewards: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  myRewardsCopy: {
    color: colors.muted,
    marginTop: 4,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  retry: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  retryCopy: {
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardBody: {
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  heart: {
    position: 'absolute',
    right: spacing.sm,
    top: cardImageHeight + spacing.sm,
  },
  partner: {
    color: colors.ink,
    paddingRight: 36,
  },
  description: {
    color: colors.ink,
    marginTop: 2,
  },
  metaRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  collect: {
    color: colors.muted,
    flex: 1,
    paddingBottom: 2,
  },
});
