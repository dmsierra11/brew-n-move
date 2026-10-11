import { supabase } from './supabase';

export async function acknowledgePrivacy() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !apiKey) {
    return { error: 'Privacy acknowledgement could not be saved.', version: null };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { error: 'Sign in again before acknowledging the Privacy Policy.', version: null };
  }

  try {
    const response = await fetch(`${url}/functions/v1/acknowledge-privacy`, {
      body: '{}',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const payload = await response.json() as { ok?: boolean; version?: string };
    if (!response.ok || !payload.ok) {
      return { error: 'Privacy acknowledgement could not be saved.', version: null };
    }

    return { error: null, version: payload.version ?? null };
  } catch {
    return { error: 'Privacy acknowledgement could not be saved.', version: null };
  }
}
