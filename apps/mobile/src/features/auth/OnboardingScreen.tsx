import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { colors, spacing } from '../../theme/tokens';
import { AuthField } from './AuthField';
import { useAuth } from './AuthProvider';
import { readDeviceFacts } from './deviceFacts';
import { loadCurrentDocuments } from './documents';
import { requestEmailVerification } from './emailVerification';
import { supabase } from './supabase';

export function OnboardingScreen() {
  const { completeIntent, refreshMember, sessionStatus, userId } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const displayNameEdited = useRef(false);
  const [termsVersion, setTermsVersion] = useState('');
  const [privacyVersion, setPrivacyVersion] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ data }, documents] = await Promise.all([
        supabase.auth.getSession(),
        loadCurrentDocuments(),
      ]);
      if (cancelled) {
        return;
      }

      if (documents.error || !documents.documents) {
        setMessage(documents.error ?? 'Documents could not be loaded.');
        return;
      }

      const metadata = data.session?.user.user_metadata;
      const acceptedTerms = metadata?.terms_version;
      const acceptedPrivacy = metadata?.privacy_version;
      if (acceptedTerms !== documents.documents.terms.version || acceptedPrivacy !== documents.documents.privacy.version) {
        setMessage('Accept the current Terms and Privacy Policy from Create account before finishing setup.');
        return;
      }

      setTermsVersion(documents.documents.terms.version);
      setPrivacyVersion(documents.documents.privacy.version);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const changeFirstName = (value: string) => {
    setFirstName(value);
    if (!displayNameEdited.current) {
      setDisplayName(value);
    }
  };

  const finish = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedDisplay = displayName.trim() || trimmedFirst;
    if (!userId) {
      setMessage('Sign in again before finishing setup.');
      return;
    }

    if (!trimmedFirst || !trimmedDisplay) {
      setMessage('Enter your first name.');
      return;
    }

    if (!termsVersion || !privacyVersion) {
      setMessage('The document versions are not ready yet.');
      return;
    }

    const facts = readDeviceFacts();
    setSubmitting(true);
    setMessage('');
    const { error } = await supabase.from('members').insert({
      display_name: trimmedDisplay,
      first_name: trimmedFirst,
      id: userId,
      privacy_version: privacyVersion,
      region: facts.region,
      terms_version: termsVersion,
      timezone: facts.timezone,
    });
    setSubmitting(false);

    if (error) {
      setMessage('Your account could not be saved. Check the documents and try again.');
      return;
    }

    const status = await refreshMember();
    if (status !== 'ready') {
      setMessage('Your account was saved, but it could not be loaded. Try again.');
      return;
    }

    await requestEmailVerification();
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
          <AppText accessibilityRole="header" role="display">Your name</AppText>
        <AppText role="body" style={styles.copy}>
          {sessionStatus === 'guest'
            ? 'Sign in before choosing a display name.'
            : 'Display name starts as your first name. Communities show the display name.'}
        </AppText>
        {termsVersion ? (
          <AppText role="caption" style={styles.copy}>
            {`Accepted Terms ${termsVersion} and Privacy ${privacyVersion}.`}
          </AppText>
        ) : null}
        <AuthField
          autoCapitalize="words"
          autoComplete="name"
          label="First name"
          onChangeText={changeFirstName}
          value={firstName}
        />
        <AuthField
          autoCapitalize="words"
          autoComplete="username"
          label="Display name"
          onChangeText={(value) => {
            displayNameEdited.current = true;
            setDisplayName(value);
          }}
          value={displayName}
        />
        {message ? <AppText role="caption" style={styles.message}>{message}</AppText> : null}
        <PillButton
          appearance="primary"
          fullWidth
          label={submitting ? 'Saving' : 'Continue'}
          onPress={() => {
            void finish();
          }}
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
