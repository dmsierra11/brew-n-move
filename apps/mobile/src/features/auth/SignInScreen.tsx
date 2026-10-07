import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { colors, spacing } from '../../theme/tokens';
import { AuthField } from './AuthField';
import { useAuth } from './AuthProvider';
import { supabase } from './supabase';

export function SignInScreen() {
  const { completeIntent } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const signIn = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || password.length < 6) {
      setMessage('Enter your email and a password of at least 6 characters.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setSubmitting(false);

    if (error || !data.user) {
      setMessage(error?.message ?? 'Sign-in failed.');
      return;
    }

    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle();

    if (memberError) {
      setMessage('Signed in, but your account could not be loaded. Try again from Profile.');
      return;
    }

    if (!member) {
      router.push('/onboarding');
      return;
    }

    completeIntent();
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenBackButton />
          <AppText accessibilityRole="header" role="display">Sign in</AppText>
          <AppText role="body" style={styles.copy}>
            Use the email and password for your Brew & Move account.
          </AppText>
          <AuthField
            autoComplete="email"
            label="Email"
            onChangeText={setEmail}
            value={email}
          />
          <AuthField
            autoComplete="password"
            label="Password"
            onChangeText={setPassword}
            secureTextEntry
            value={password}
          />
          {message ? <AppText role="caption" style={styles.message}>{message}</AppText> : null}
          <PillButton
            appearance="primary"
            fullWidth
            label={submitting ? 'Signing in' : 'Sign in'}
            onPress={() => {
              void signIn();
            }}
          />
          <PillButton
            appearance="quiet"
            fullWidth
            label="Create account"
            onPress={() => router.push('/sign-up')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.field,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  copy: {
    color: colors.muted,
  },
  message: {
    color: colors.blocked,
  },
});
