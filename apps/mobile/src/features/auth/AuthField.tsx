import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { colors, radii, spacing, typography } from '../../theme/tokens';

type AuthFieldProps = Readonly<{
  autoCapitalize?: 'none' | 'words';
  autoComplete?: 'email' | 'name' | 'password' | 'username';
  label: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  value: string;
}>;

export function AuthField({
  autoCapitalize = 'none',
  autoComplete,
  label,
  onChangeText,
  secureTextEntry = false,
  value,
}: AuthFieldProps) {
  return (
    <View style={styles.field}>
      <AppText role="caption" style={styles.label}>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        selectionColor={colors.moss}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: colors.ink,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
