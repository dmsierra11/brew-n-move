import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

// Exchange deducts Brew Points. Till confirm queues settlement after the response.
// This function does not wait for a Solana transaction. Issuance rows stay blocked.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RpcResult = {
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
  till_confirmed_at?: string | null;
  title?: string;
  value_label?: string;
};

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function uuid(value: unknown) {
  return typeof value === 'string' && uuidPattern.test(value) ? value : null;
}

function finiteCoord(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function payloadFrom(body: unknown) {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const record = body as Record<string, unknown>;
  const action = record.action === 'till' ? 'till' : record.action === 'exchange' ? 'exchange' : null;
  const requestId = uuid(record.requestId);
  const commit = record.commit;
  if (action === 'till') {
    const redemptionId = uuid(record.redemptionId);
    const latitude = finiteCoord(record.latitude, -90, 90);
    const longitude = finiteCoord(record.longitude, -180, 180);
    if (!redemptionId || latitude == null || longitude == null) {
      return null;
    }
    return { action, commit: true, latitude, longitude, offerId: null, redemptionId, requestId };
  }
  if (action !== 'exchange' || typeof commit !== 'boolean') {
    return null;
  }
  const offerId = uuid(record.offerId);
  if (!offerId) {
    return null;
  }
  if (commit && !requestId) {
    return null;
  }
  return { action, commit, latitude: null, longitude: null, offerId, redemptionId: null, requestId };
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
  const invoked = payload.action === 'till'
    ? await admin.rpc('confirm_till', {
      p_latitude: payload.latitude,
      p_longitude: payload.longitude,
      p_member_id: userData.user.id,
      p_redemption_id: payload.redemptionId,
      p_request_id: payload.requestId,
    })
    : await admin.rpc('exchange_offer', {
      p_commit: payload.commit,
      p_member_id: userData.user.id,
      p_offer_id: payload.offerId,
      p_request_id: payload.requestId,
    });

  if (invoked.error || !invoked.data) {
    return json({ ok: false, reason: 'unavailable' }, 500);
  }

  const result = invoked.data as RpcResult;
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
    || reason === 'budget_exhausted'
    || reason === 'not_found'
  ) {
    return json({
      balance: result.balance ?? null,
      ok: false,
      reason,
    }, 409);
  }

  if (reason === 'eligible' || reason === 'issued') {
    return json({
      balance: result.balance ?? null,
      location: result.location ?? null,
      offerId: result.offer_id ?? payload.offerId,
      ok: true,
      partner: result.partner ?? null,
      pointsCost: result.points_cost ?? result.points_spent ?? null,
      pointsSpent: result.points_spent ?? null,
      reason,
      redeemedAt: result.redeemed_at ?? null,
      redemptionId: result.redemption_id ?? null,
      tillConfirmedAt: result.till_confirmed_at ?? null,
      title: result.title ?? null,
      valueLabel: result.value_label ?? null,
    }, 200);
  }

  if (reason !== 'redeemed') {
    return json({ ok: false, reason: 'unavailable' }, 500);
  }

  if (result.redemption_id) {
    const redemptionId = result.redemption_id;
    EdgeRuntime.waitUntil(fetch(`${supabaseUrl}/functions/v1/settle-reward`, {
      body: JSON.stringify({ redemptionId }),
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }).catch(() => undefined));
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
    tillConfirmedAt: result.till_confirmed_at ?? null,
    title: result.title ?? null,
    valueLabel: result.value_label ?? null,
  }, 200);
});
