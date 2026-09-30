import { Text, TextProps } from 'react-native';

import { colors, typography, TypographyRole } from '../theme/tokens';

type AppTextProps = Readonly<
  Omit<TextProps, 'role'> & {
    role: TypographyRole;
  }
>;

export function AppText({ role, style, ...props }: AppTextProps) {
  return (
    <Text
      {...props}
      style={[{ color: colors.ink }, typography[role], style]}
    />
  );
}
