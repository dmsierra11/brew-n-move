import { supabase } from '../auth/supabase';

export type RedeemReason =
  | 'budget_exhausted'
  | 'eligible'
  | 'insufficient_balance'
  | 'invalid_payload'
  | 'issued'
  | 'location_unavailable'
  | 'not_found'
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
  tillConfirmedAt: string | null;
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
  'budget_exhausted',
  'eligible',
  'insufficient_balance',
  'invalid_payload',
  'issued',
  'location_unavailable',
  'not_found',
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
  const pointsSpent = payload.pointsSpent ?? payload.pointsCost;
  const redeemedAt = payload.redeemedAt;
  const redemptionId = payload.redemptionId;
  const tillConfirmedAt = payload.tillConfirmedAt;
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
    tillConfirmedAt: typeof tillConfirmedAt === 'string' ? tillConfirmedAt : null,
    title,
    valueLabel,
  };
}

async function postRedeem(body: Record<string, unknown>): Promise<RedeemResponse> {
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
    confirmation: reason === 'issued' || reason === 'redeemed' ? confirmationFrom(payload) : null,
    confirmed: true,
    reason: reason as RedeemReason,
  };
}

export function lookupVoucher(redemptionId: string) {
  return supabase
    .from('redemptions')
    .select('id, offer_id, partner_name, location_name, offer_title, value_label, points_spent, redeemed_at, till_confirmed_at')
    .eq('id', redemptionId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error || !data) {
        return null;
      }
      return {
        location: data.location_name as string,
        offerId: data.offer_id as string,
        partner: data.partner_name as string,
        pointsSpent: data.points_spent as number,
        redeemedAt: data.redeemed_at as string,
        redemptionId: data.id as string,
        tillConfirmedAt: (data.till_confirmed_at as string | null) ?? null,
        title: data.offer_title as string,
        valueLabel: data.value_label as string,
      } satisfies RedeemConfirmation;
    });
}

export function listMyRewards() {
  return supabase
    .from('redemptions')
    .select('id, offer_id, partner_name, location_name, offer_title, value_label, points_spent, redeemed_at, till_confirmed_at')
    .order('redeemed_at', { ascending: false })
    .then(({ data, error }) => {
      if (error || !data) {
        return null;
      }
      return data
        .map((row) => ({
          location: row.location_name as string,
          offerId: row.offer_id as string,
          partner: row.partner_name as string,
          pointsSpent: row.points_spent as number,
          redeemedAt: row.redeemed_at as string,
          redemptionId: row.id as string,
          tillConfirmedAt: (row.till_confirmed_at as string | null) ?? null,
          title: row.offer_title as string,
          valueLabel: row.value_label as string,
        } satisfies RedeemConfirmation))
        .sort((left, right) => Number(Boolean(left.tillConfirmedAt)) - Number(Boolean(right.tillConfirmedAt)));
    });
}

export function submitExchange(body: { commit: boolean; offerId: string; requestId?: string }) {
  return postRedeem({
    action: 'exchange',
    commit: body.commit,
    offerId: body.offerId,
    requestId: body.requestId,
  });
}

export function submitTill(body: {
  latitude: number;
  longitude: number;
  redemptionId: string;
  requestId?: string;
}) {
  return postRedeem({
    action: 'till',
    latitude: body.latitude,
    longitude: body.longitude,
    redemptionId: body.redemptionId,
    requestId: body.requestId,
  });
}
