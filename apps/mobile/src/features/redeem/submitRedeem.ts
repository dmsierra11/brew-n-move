import { supabase } from '../auth/supabase';

export type RedeemReason =
  | 'eligible'
  | 'insufficient_balance'
  | 'invalid_payload'
  | 'location_unavailable'
  | 'not_onboarded'
  | 'not_signed_in'
  | 'offer_unavailable'
  | 'outside_geofence'
  | 'redeemed'
  | 'sold_out'
  | 'unavailable';

export type RedeemConfirmation = {
  location: string;
  offerId: string;
  partner: string;
  pointsSpent: number;
  redeemedAt: string;
  redemptionId: string;
  title: string;
  valueLabel: string;
};

export type RedeemResponse = {
  balance: number | null;
  confirmation: RedeemConfirmation | null;
  confirmed: boolean;
  reason: RedeemReason;
};

const confirmedReasons = new Set<RedeemReason>([
  'eligible',
  'insufficient_balance',
  'invalid_payload',
  'location_unavailable',
  'not_onboarded',
  'not_signed_in',
  'offer_unavailable',
  'outside_geofence',
  'redeemed',
  'sold_out',
]);

function unconfirmed(): RedeemResponse {
  return {
    balance: null,
    confirmation: null,
    confirmed: false,
    reason: 'unavailable',
  };
}

function confirmationFrom(payload: Record<string, unknown>): RedeemConfirmation | null {
  const location = payload.location;
  const offerId = payload.offerId;
  const partner = payload.partner;
  const pointsSpent = payload.pointsSpent;
  const redeemedAt = payload.redeemedAt;
  const redemptionId = payload.redemptionId;
  const title = payload.title;
  const valueLabel = payload.valueLabel;
  if (
    typeof location !== 'string'
    || typeof offerId !== 'string'
    || typeof partner !== 'string'
    || typeof pointsSpent !== 'number'
    || typeof redeemedAt !== 'string'
    || typeof redemptionId !== 'string'
    || typeof title !== 'string'
    || typeof valueLabel !== 'string'
  ) {
    return null;
  }

  return {
    location,
    offerId,
    partner,
    pointsSpent,
    redeemedAt,
    redemptionId,
    title,
    valueLabel,
  };
}

export async function lookupRedemption(requestId: string): Promise<RedeemConfirmation | null> {
  const { data, error } = await supabase
    .from('redemptions')
    .select('id, offer_id, partner_name, location_name, offer_title, value_label, points_spent, redeemed_at')
    .eq('client_request_id', requestId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    location: data.location_name,
    offerId: data.offer_id,
    partner: data.partner_name,
    pointsSpent: data.points_spent,
    redeemedAt: data.redeemed_at,
    redemptionId: data.id,
    title: data.offer_title,
    valueLabel: data.value_label,
  };
}

export async function submitRedeem(body: {
  commit: boolean;
  latitude: number;
  longitude: number;
  offerId: string;
  requestId?: string;
}): Promise<RedeemResponse> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !apiKey) {
    return unconfirmed();
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return {
      balance: null,
      confirmation: null,
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
    response = await fetch(`${url}/functions/v1/redeem`, {
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
  if (typeof reason !== 'string' || !confirmedReasons.has(reason as RedeemReason)) {
    return unconfirmed();
  }

  if (response.status >= 500) {
    return unconfirmed();
  }

  return {
    balance: typeof payload.balance === 'number' ? payload.balance : null,
    confirmation: reason === 'redeemed' ? confirmationFrom(payload) : null,
    confirmed: true,
    reason: reason as RedeemReason,
  };
}
