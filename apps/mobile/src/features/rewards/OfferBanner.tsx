import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { OfferIllustration, type IllustrationKind } from '../../components/OfferIllustration';

type OfferBannerProps = Readonly<{
  accent: string;
  height: number;
  illustration: IllustrationKind;
  imageUrl: string | null;
}>;

export function OfferBanner({ accent, height, illustration, imageUrl }: OfferBannerProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = imageUrl != null && imageUrl.length > 0 && !photoFailed;
  const artHeight = Math.round(height * 0.72);
  const artWidth = Math.round(artHeight * (96 / 104));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.banner, { backgroundColor: accent, height }]}
    >
      {showPhoto ? (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => {
            setPhotoFailed(true);
          }}
          source={{ uri: imageUrl }}
          style={styles.photo}
        />
      ) : (
        <OfferIllustration height={artHeight} kind={illustration} width={artWidth} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  photo: {
    height: '100%',
    width: '100%',
  },
});
