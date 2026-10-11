import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

// The submitted step total is not read from Apple Health or Health Connect.
// This function does not submit a Solana transaction. Issuance rows stay blocked.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stepTotalLimit = 1_000_000;
const platforms = new Set(['apple_health', 'health_connect']);

type ValidationResult = {
  awarded_delta?: number;
  awarded_today?: number;
  balance?: number;
  ok?: boolean;
  reason?: string;
  step_total?: number;
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
  const localDate = record.localDate;
  const timezone = record.timezone;
  const stepTotal = record.stepTotal;
  const sourcePlatform = record.sourcePlatform;
  if (typeof localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return null;
  }

  if (typeof timezone !== 'string' || timezone.trim() === '' || timezone.length > 64) {
    return null;
  }

  if (typeof stepTotal !== 'number' || !Number.isInteger(stepTotal) || stepTotal < 0 || stepTotal > stepTotalLimit) {
    return null;
  }

  if (typeof sourcePlatform !== 'string' || !platforms.has(sourcePlatform)) {
    return null;
  }

  return { localDate, sourcePlatform, stepTotal, timezone };
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
  const { data, error } = await admin.rpc('validate_steps', {
    p_local_date: payload.localDate,
    p_member_id: userData.user.id,
    p_source_platform: payload.sourcePlatform,
    p_step_total: payload.stepTotal,
    p_timezone: payload.timezone,
  });

  if (error || !data) {
    return json({ ok: false, reason: 'unavailable' }, 500);
  }

  const result = data as ValidationResult;
  const reason = result.reason ?? 'unavailable';
  if (reason === 'invalid_payload') {
    return json({ ok: false, reason }, 400);
  }

  if (reason === 'not_onboarded' || reason === 'privacy_required' || reason === 'day_closed' || reason === 'day_overlap') {
    return json({
      awardedDelta: result.awarded_delta ?? 0,
      awardedToday: result.awarded_today ?? 0,
      balance: result.balance ?? null,
      ok: false,
      reason,
    }, 409);
  }

  if (reason !== 'awarded' && reason !== 'no_additional') {
    return json({ ok: false, reason: 'unavailable' }, 500);
  }

  return json({
    awardedDelta: result.awarded_delta ?? 0,
    awardedToday: result.awarded_today ?? 0,
    balance: result.balance ?? 0,
    ok: true,
    reason,
    stepTotal: result.step_total ?? payload.stepTotal,
  }, 200);
});
