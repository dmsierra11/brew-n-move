import { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { TextStyle } from 'react-native';

import { colors, radii, spacing } from '../theme/tokens';
import { AppText } from './AppText';

type PillButtonAppearance =
  | 'danger'
  | 'dangerQuiet'
  | 'muted'
  | 'primary'
  | 'quiet';

type PillButtonSize = 'compact' | 'large';

type PillButtonProps = Readonly<{
  accessibilityLabel?: string;
  appearance?: PillButtonAppearance;
  label: string;
  onPress: () => void;
  selected?: boolean;
  size?: PillButtonSize;
  fullWidth?: boolean;
  trailing?: ReactNode;
}>;

export function PillButton({
  accessibilityLabel,
  appearance,
  label,
  onPress,
  selected = false,
  size = 'compact',
  fullWidth = false,
  trailing,
}: PillButtonProps) {
  const resolvedAppearance = appearance ?? 'quiet';
  const isLightText = resolvedAppearance === 'primary' || resolvedAppearance === 'danger';
  let labelStyle: TextStyle = styles.darkLabel;
  if (isLightText) {
    labelStyle = styles.lightLabel;
  } else if (resolvedAppearance === 'dangerQuiet') {
    labelStyle = styles.dangerLabel;
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        resolvedAppearance === 'primary' && styles.primary,
        resolvedAppearance === 'muted' && styles.muted,
        resolvedAppearance === 'danger' && styles.danger,
        resolvedAppearance === 'dangerQuiet' && styles.dangerQuiet,
        resolvedAppearance === 'quiet' && styles.quiet,
        size === 'large' && styles.large,
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
      ]}
    >
      <AppText role="action" style={labelStyle}>
        {label}
      </AppText>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quiet: {
    backgroundColor: colors.card,
    borderColor: colors.line,
  },
  primary: {
    backgroundColor: colors.moss,
    borderColor: colors.moss,
  },
  muted: {
    backgroundColor: colors.field,
    borderColor: colors.line,
  },
  danger: {
    backgroundColor: colors.blocked,
    borderColor: colors.blocked,
  },
  dangerQuiet: {
    backgroundColor: colors.card,
    borderColor: colors.blocked,
  },
  large: {
    minHeight: 64,
    paddingVertical: spacing.md,
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.72,
  },
  darkLabel: {
    color: colors.ink,
  },
  lightLabel: {
    color: colors.card,
  },
  dangerLabel: {
    color: colors.blocked,
  },
});
