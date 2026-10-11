import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

// This function does not submit a Solana transaction. Redemption ledger rows stay blocked.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RedeemResult = {
  balance?: number;
  location?: string;
  offer_id?: string;
  ok?: boolean;
  partner?: string;
  points_cost?: number;
  points_spent?: number;
  reason?: string;
  redeemed_at?: string;
  redemption_id?: string;
  title?: string;
  value_label?: string;
};

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function payloadFrom(body: unknown) {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const record = body as Record<string, unknown>;
  const offerId = record.offerId;
  const latitude = record.latitude;
  const longitude = record.longitude;
  const commit = record.commit;
  const requestId = record.requestId;

  if (typeof offerId !== 'string' || !uuidPattern.test(offerId)) {
    return null;
  }

  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return null;
  }

  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return null;
  }

  if (typeof commit !== 'boolean') {
    return null;
  }

  if (commit) {
    if (typeof requestId !== 'string' || !uuidPattern.test(requestId)) {
      return null;
    }

    return { commit, latitude, longitude, offerId, requestId };
  }

  return { commit, latitude, longitude, offerId, requestId: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'invalid_payload' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ ok: false, reason: 'not_signed_in' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user?.id) {
    return json({ ok: false, reason: 'not_signed_in' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }

  const payload = payloadFrom(body);
  if (!payload) {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.rpc('redeem_offer', {
    p_commit: payload.commit,
    p_latitude: payload.latitude,
    p_longitude: payload.longitude,
    p_member_id: userData.user.id,
    p_offer_id: payload.offerId,
    p_request_id: payload.requestId,
  });

  if (error || !data) {
    return json({ ok: false, reason: 'unavailable' }, 500);
  }

  const result = data as RedeemResult;
  const reason = result.reason ?? 'unavailable';
  if (reason === 'invalid_payload') {
    return json({ ok: false, reason }, 400);
  }

  if (
    reason === 'not_onboarded'
    || reason === 'offer_unavailable'
    || reason === 'sold_out'
    || reason === 'location_unavailable'
    || reason === 'outside_geofence'
    || reason === 'insufficient_balance'
  ) {
    return json({
      balance: result.balance ?? null,
      ok: false,
      reason,
    }, 409);
  }

  if (reason === 'eligible') {
    return json({
      balance: result.balance ?? null,
      location: result.location ?? null,
      offerId: result.offer_id ?? payload.offerId,
      ok: true,
      partner: result.partner ?? null,
      pointsCost: result.points_cost ?? null,
      reason,
      title: result.title ?? null,
      valueLabel: result.value_label ?? null,
    }, 200);
  }

  if (reason !== 'redeemed') {
    return json({ ok: false, reason: 'unavailable' }, 500);
  }

  return json({
    balance: result.balance ?? 0,
    location: result.location ?? null,
    offerId: result.offer_id ?? payload.offerId,
    ok: true,
    partner: result.partner ?? null,
    pointsSpent: result.points_spent ?? null,
    reason,
    redeemedAt: result.redeemed_at ?? null,
    redemptionId: result.redemption_id ?? null,
    title: result.title ?? null,
    valueLabel: result.value_label ?? null,
  }, 200);
});
