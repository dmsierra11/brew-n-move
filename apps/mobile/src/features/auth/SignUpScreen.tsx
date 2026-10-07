import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { colors, radii, spacing } from '../../theme/tokens';
import { AuthField } from './AuthField';
import { loadCurrentDocuments, type LegalDocument } from './documents';
import { supabase } from './supabase';

type CurrentDocuments = {
  privacy: LegalDocument;
  terms: LegalDocument;
};

export function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [documents, setDocuments] = useState<CurrentDocuments | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadCurrentDocuments().then((result) => {
      if (cancelled) {
        return;
      }

      if (result.error || !result.documents) {
        setMessage(result.error ?? 'Documents could not be loaded.');
        return;
      }

      setDocuments(result.documents);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const createAccount = async () => {
    const trimmedEmail = email.trim();
    if (!documents) {
      setMessage('The Terms and Privacy Policy are still loading.');
      return;
    }

    if (!trimmedEmail || password.length < 6) {
      setMessage('Enter your email and a password of at least 6 characters.');
      return;
    }

    if (!acceptedTerms || !acceptedPrivacy) {
      setMessage('Accept the Terms of Service and Privacy Policy.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          privacy_version: documents.privacy.version,
          terms_version: documents.terms.version,
        },
      },
    });

    if (error) {
      setSubmitting(false);
      setMessage(error.message);
      return;
    }

    if (!data.session) {
      const signedIn = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      setSubmitting(false);
      if (!signedIn.data.session) {
        setMessage('Account setup did not start. Try again.');
        return;
      }

      router.push('/onboarding');
      return;
    }

    setSubmitting(false);
    router.push('/onboarding');
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
          <AppText accessibilityRole="header" role="display">Create account</AppText>
          <AppText role="body" style={styles.copy}>
            Open each document before you accept it.
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
          <Acknowledgement
            checked={acceptedTerms}
            linkLabel="Terms of Service"
            onOpen={() => router.push({ pathname: '/legal-document', params: { kind: 'terms' } })}
            onToggle={() => setAcceptedTerms((current) => !current)}
            prefix="I accept the "
          />
          <Acknowledgement
            checked={acceptedPrivacy}
            linkLabel="Privacy Policy"
            onOpen={() => router.push({ pathname: '/legal-document', params: { kind: 'privacy' } })}
            onToggle={() => setAcceptedPrivacy((current) => !current)}
            prefix="I acknowledge the "
          />
          {message ? <AppText role="caption" style={styles.message}>{message}</AppText> : null}
          <PillButton
            appearance="primary"
            fullWidth
            label={submitting ? 'Creating account' : 'Create account'}
            onPress={() => {
              void createAccount();
            }}
          />
          <PillButton
            appearance="quiet"
            fullWidth
            label="Sign in"
            onPress={() => router.push('/sign-in')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Acknowledgement({
  checked,
  linkLabel,
  onOpen,
  onToggle,
  prefix,
}: Readonly<{
  checked: boolean;
  linkLabel: string;
  onOpen: () => void;
  onToggle: () => void;
  prefix: string;
}>) {
  return (
    <View style={styles.checkRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onToggle}
        style={[styles.box, checked && styles.boxChecked]}
      >
        {checked ? <AppText role="caption" style={styles.tick}>✓</AppText> : null}
      </Pressable>
      <AppText role="caption" style={styles.checkLabel}>
        {prefix}
        <AppText
          accessibilityRole="link"
          onPress={onOpen}
          role="action"
          style={styles.link}
        >
          {linkLabel}
        </AppText>
      </AppText>
    </View>
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
  link: {
    color: colors.moss,
  },
  checkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
  },
  box: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  boxChecked: {
    backgroundColor: colors.mossSoft,
    borderColor: colors.moss,
  },
  tick: {
    color: colors.moss,
  },
  checkLabel: {
    color: colors.ink,
    flex: 1,
  },
});
