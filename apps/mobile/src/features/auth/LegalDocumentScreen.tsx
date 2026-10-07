import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { ScreenBackButton } from '../../components/ScreenBackButton';
import { colors, spacing } from '../../theme/tokens';
import { isLegalKind, loadCurrentDocuments, type LegalDocument } from './documents';

export function LegalDocumentScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = typeof params.kind === 'string' && isLegalKind(params.kind) ? params.kind : null;
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [message, setMessage] = useState('');

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
