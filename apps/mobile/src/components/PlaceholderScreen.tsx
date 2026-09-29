import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/tokens';

export function PlaceholderScreen() {
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.field,
    flex: 1,
  },
});
