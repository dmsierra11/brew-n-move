import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AcknowledgeResult = {
  ok?: boolean;
  reason?: string;
  version?: string;
};

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
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

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.rpc('acknowledge_current_privacy', {
    p_member_id: userData.user.id,
  });

  if (error || !data) {
    return json({ ok: false, reason: 'unavailable' }, 500);
  }

  const result = data as AcknowledgeResult;
  if (!result.ok) {
    const status = result.reason === 'no_member' ? 409 : 500;
    return json({ ok: false, reason: result.reason ?? 'unavailable' }, status);
  }

  return json({ ok: true, reason: result.reason, version: result.version }, 200);
});
