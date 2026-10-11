import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { PillButton } from '../../components/PillButton';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { colors, spacing } from '../../theme/tokens';
import { acknowledgePrivacy } from './acknowledgePrivacy';
import { useAuth } from './AuthProvider';
import { isLegalKind, loadCurrentDocuments, type LegalDocument } from './documents';

export function LegalDocumentScreen() {
  const params = useLocalSearchParams<{ acknowledge?: string; kind?: string }>();
  const kind = typeof params.kind === 'string' && isLegalKind(params.kind) ? params.kind : null;
  const acknowledge = params.acknowledge === '1' && kind === 'privacy';
  const { member, refreshMember } = useAuth();
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!kind) {
      setMessage('This document is unavailable.');
      return;
    }

    let cancelled = false;
    void loadCurrentDocuments().then((result) => {
      if (cancelled) {
        return;
      }

      if (result.error || !result.documents) {
        setMessage(result.error ?? 'This document is unavailable.');
        return;
      }

      setDocument(kind === 'terms' ? result.documents.terms : result.documents.privacy);
    });

    return () => {
      cancelled = true;
    };
  }, [kind]);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenBackButton />
        <AppText role="eyebrow" style={styles.eyebrow}>Unpublished draft</AppText>
        <AppText accessibilityRole="header" role="title">
          {document?.title ?? 'Document'}
        </AppText>
        {document ? (
          <AppText role="caption" style={styles.version}>{`Version ${document.version}`}</AppText>
        ) : null}
        <AppText role="body" style={styles.body}>
          {document?.body ?? message}
        </AppText>
        {acknowledge && document ? (
          <PillButton
            appearance="primary"
            fullWidth
            label={saving ? 'Saving' : 'I acknowledge the Privacy Policy'}
            onPress={() => {
              if (member && member.privacyVersion === document.version) {
                router.back();
                return;
              }

              setSaving(true);
              void acknowledgePrivacy().then(async (result) => {
                if (result.error) {
                  setSaving(false);
                  setMessage(result.error);
                  return;
                }

                await refreshMember();
                setSaving(false);
                router.back();
              });
            }}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.field,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.moss,
  },
  version: {
    color: colors.muted,
  },
  body: {
    color: colors.ink,
  },
});
