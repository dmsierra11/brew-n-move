import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient, type User } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const demoLocationId = 'd2222222-2222-4222-8222-222222222222';

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

async function requireAdmin(req: Request) {
  if (req.method === 'OPTIONS') {
    return { preflight: new Response('ok', { headers: corsHeaders }) };
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '');
  if (!bearer) {
    return { error: json({ ok: false, reason: 'not_authorized' }, 401) };
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser(bearer);
  const user: User | null = data.user;
  if (error || !user || user.app_metadata?.role !== 'admin') {
    return { error: json({ ok: false, reason: 'not_authorized' }, 401) };
  }
  return { admin: createClient(supabaseUrl, serviceKey), user };
}

Deno.serve(async (req) => {
  const auth = await requireAdmin(req);
  if ('preflight' in auth && auth.preflight) {
    return auth.preflight;
  }
  if ('error' in auth && auth.error) {
    return auth.error;
  }
  const { admin } = auth;
  const url = new URL(req.url);
  const budgetId = url.searchParams.get('budgetId') ?? '';

  if (req.method === 'GET') {
    if (!uuidPattern.test(budgetId)) {
      return json({ ok: false, reason: 'invalid_payload' }, 400);
    }
    const cover = await admin.rpc('admin_campaign_cover', { p_budget_id: budgetId });
    const campaigns = await admin.rpc('admin_list_budget_offers', { p_budget_id: budgetId });
    if (cover.error || campaigns.error) {
      return json({ ok: false, reason: 'unavailable' }, 500);
    }
    return json({
      campaigns: Array.isArray(campaigns.data) ? campaigns.data : campaigns.data ? [campaigns.data] : [],
      cover: cover.data ?? null,
      ok: true,
    });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'invalid_payload' }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const action = typeof record.action === 'string' ? record.action : '';
  const id = typeof record.budgetId === 'string' ? record.budgetId : '';
  if (!uuidPattern.test(id)) {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }

  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const description = typeof record.description === 'string' ? record.description.trim() : '';
  const valueLabel = typeof record.valueLabel === 'string' ? record.valueLabel.trim() : '';
  const listPriceCents = Number(record.listPriceCents);
  const payPriceCents = Number(record.payPriceCents);
  const pointsCost = Number(record.pointsCost);
  const quantity = Number(record.quantity);
  const expiresAt = typeof record.expiresAt === 'string' && record.expiresAt ? record.expiresAt : null;
  const collectStart = typeof record.collectStart === 'string' && record.collectStart ? record.collectStart : null;
  const collectEnd = typeof record.collectEnd === 'string' && record.collectEnd ? record.collectEnd : null;
  if (!title || !description || !valueLabel || !Number.isInteger(listPriceCents) || !Number.isInteger(payPriceCents)
    || !Number.isInteger(pointsCost) || !Number.isInteger(quantity)) {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }

  if (action === 'create-campaign') {
    const inserted = await admin.rpc('admin_insert_campaign_offer', {
      p_budget_id: id,
      p_description: description,
      p_list_price_cents: listPriceCents,
      p_location_id: demoLocationId,
      p_pay_price_cents: payPriceCents,
      p_points_cost: pointsCost,
      p_quantity: quantity,
      p_slug: `campaign-${crypto.randomUUID()}`,
      p_title: title,
      p_value_label: valueLabel,
    });
    const payload = inserted.data as { id?: string; ok?: boolean; reason?: string } | null;
    if (inserted.error || !payload?.ok || !payload.id) {
      return json({ ok: false, reason: payload?.reason ?? 'unavailable' }, 400);
    }
    if (expiresAt || collectStart || collectEnd) {
      await admin.from('offers').update({
        collect_end: collectEnd,
        collect_start: collectStart,
        expires_at: expiresAt,
      }).eq('id', payload.id);
    }
    const status = record.status === 'active' || record.status === 'paused' ? record.status : 'paused';
    if (status === 'active') {
      const updated = await admin.rpc('admin_update_campaign_offer', {
        p_description: description,
        p_list_price_cents: listPriceCents,
        p_offer_id: payload.id,
        p_pay_price_cents: payPriceCents,
        p_points_cost: pointsCost,
        p_quantity: quantity,
        p_status: 'active',
        p_title: title,
        p_value_label: valueLabel,
      });
      const activated = updated.data as { ok?: boolean; reason?: string } | null;
      if (updated.error || !activated?.ok) {
        const reason = activated?.reason ?? 'unavailable';
        return json({ id: payload.id, ok: false, reason }, reason === 'underfunded' || reason === 'quantity_below_issued' ? 409 : 400);
      }
    }
    return json({ id: payload.id, ok: true });
  }

  if (action !== 'update-campaign') {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }

  const offerId = typeof record.offerId === 'string' ? record.offerId : '';
  const status = record.status === 'active' || record.status === 'paused' ? record.status : '';
  if (!uuidPattern.test(offerId) || !status) {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }
  const updated = await admin.rpc('admin_update_campaign_offer', {
    p_description: description,
    p_list_price_cents: listPriceCents,
    p_offer_id: offerId,
    p_pay_price_cents: payPriceCents,
    p_points_cost: pointsCost,
    p_quantity: quantity,
    p_status: status,
    p_title: title,
    p_value_label: valueLabel,
  });
  const payload = updated.data as { ok?: boolean; reason?: string } | null;
  if (updated.error || !payload?.ok) {
    const reason = payload?.reason ?? 'unavailable';
    return json({ ok: false, reason }, reason === 'underfunded' || reason === 'quantity_below_issued' ? 409 : 400);
  }
  await admin.from('offers').update({
    collect_end: collectEnd,
    collect_start: collectStart,
    expires_at: expiresAt,
  }).eq('id', offerId);
  return json({ ok: true });
});
