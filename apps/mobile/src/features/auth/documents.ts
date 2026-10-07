import { supabase } from './supabase';

export type LegalKind = 'privacy' | 'terms';

export type LegalDocument = {
  body: string;
  kind: LegalKind;
  title: string;
  version: string;
};

export function isLegalKind(value: string): value is LegalKind {
  return value === 'terms' || value === 'privacy';
}

export async function loadCurrentDocuments() {
  const { data, error } = await supabase
    .from('legal_documents')
    .select('kind, version, title, body')
    .eq('is_current', true);

  if (error || !data) {
    return { documents: null, error: error?.message ?? 'Documents could not be loaded.' };
  }

  const terms = data.find((document) => document.kind === 'terms');
  const privacy = data.find((document) => document.kind === 'privacy');
  if (!terms || !privacy) {
    return { documents: null, error: 'The current Terms and Privacy Policy are unavailable.' };
  }

  return {
    documents: {
      privacy,
      terms,
    },
    error: null,
  };
}
