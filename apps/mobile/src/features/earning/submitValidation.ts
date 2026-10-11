import { supabase } from '../auth/supabase';

export type ValidationReason =
  | 'awarded'
  | 'day_closed'
  | 'day_overlap'
  | 'invalid_payload'
  | 'no_additional'
  | 'not_onboarded'
  | 'not_signed_in'
  | 'privacy_required'
  | 'unavailable';

export type ValidationResponse = {
  awardedDelta: number;
  awardedToday: number;
  balance: number | null;
  confirmed: boolean;
  reason: ValidationReason;
};

const confirmedReasons = new Set<ValidationReason>([
  'awarded',
  'day_closed',
  'day_overlap',
  'invalid_payload',
  'no_additional',
  'not_onboarded',
  'not_signed_in',
  'privacy_required',
]);

function unconfirmed(): ValidationResponse {
  return {
    awardedDelta: 0,
    awardedToday: 0,
    balance: null,
    confirmed: false,
    reason: 'unavailable',
  };
}

export async function submitValidation(body: {
  localDate: string;
  sourcePlatform: 'apple_health' | 'health_connect';
  stepTotal: number;
  timezone: string;
}): Promise<ValidationResponse> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !apiKey) {
    return unconfirmed();
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return {
      awardedDelta: 0,
      awardedToday: 0,
      balance: null,
      confirmed: true,
      reason: 'not_signed_in',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 20_000);

  let response: Response;
  try {
    response = await fetch(`${url}/functions/v1/validate-steps`, {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: controller.signal,
    });
  } catch {
    return unconfirmed();
  } finally {
    clearTimeout(timeout);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch {
    return unconfirmed();
  }

  const reason = payload.reason;
  if (typeof reason !== 'string' || !confirmedReasons.has(reason as ValidationReason)) {
    return unconfirmed();
  }

  if (response.status >= 500) {
    return unconfirmed();
  }

  return {
    awardedDelta: typeof payload.awardedDelta === 'number' ? payload.awardedDelta : 0,
    awardedToday: typeof payload.awardedToday === 'number' ? payload.awardedToday : 0,
    balance: typeof payload.balance === 'number' ? payload.balance : null,
    confirmed: true,
    reason: reason as ValidationReason,
  };
}
