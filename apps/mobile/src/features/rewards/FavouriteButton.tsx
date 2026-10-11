import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radii } from '../../theme/tokens';

type FavouriteButtonProps = Readonly<{
  offerId: string;
  surface?: 'overlay' | 'plain';
}>;

const savedOfferIds = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isSaved(offerId: string) {
  return savedOfferIds.has(offerId);
}

function toggleSaved(offerId: string) {
  if (savedOfferIds.has(offerId)) {
    savedOfferIds.delete(offerId);
  } else {
    savedOfferIds.add(offerId);
  }

  listeners.forEach((listener) => listener());
}

function HeartIcon({ filled }: Readonly<{ filled: boolean }>) {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22}>
      <Path
        d="M12 20.4s-6.7-4.1-6.7-8.6A3.9 3.9 0 0 1 9.2 7.8c1.3 0 2.4.6 2.8 1.7.4-1.1 1.5-1.7 2.8-1.7a3.9 3.9 0 0 1 3.9 4c0 4.5-6.7 8.6-6.7 8.6z"
        fill={filled ? colors.ink : 'none'}
        stroke={colors.ink}
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

export function FavouriteButton({ offerId, surface = 'plain' }: FavouriteButtonProps) {
  const saved = useSyncExternalStore(subscribe, () => isSaved(offerId));

  return (
    <Pressable
      accessibilityLabel={saved ? 'Remove from favourites' : 'Save to favourites'}
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      hitSlop={8}
      onPress={() => {
        toggleSaved(offerId);
      }}
      style={[styles.button, surface === 'overlay' && styles.overlay]}
    >
      <HeartIcon filled={saved} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  overlay: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    width: 44,
  },
});
