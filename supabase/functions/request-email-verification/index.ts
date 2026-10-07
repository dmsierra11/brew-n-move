import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type IssueResult = {
  ok?: boolean;
  reason?: string;
  token?: string;
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
    return json({ ok: false, error: 'Method not allowed.' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ ok: false, error: 'Sign in again.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user?.id || !userData.user.email) {
    return json({ ok: false, error: 'Sign in again.' }, 401);
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!apiKey || !from) {
    return json({ ok: false, error: 'Verification email is not configured.' }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.rpc('issue_email_verification_token', {
    p_member_id: userData.user.id,
  });
  const issued = (data ?? {}) as IssueResult;

  if (error || !issued.ok) {
    if (issued.reason === 'no_member') {
      return json({ ok: false, error: 'Finish your account before verifying email.' }, 409);
    }

    return json({ ok: false, error: 'The verification email could not be sent.' }, 500);
  }

  if (issued.reason === 'already_verified' || issued.reason === 'throttled') {
    return json({ ok: true, reason: issued.reason, sent: false }, 200);
  }

  if (issued.reason !== 'issued' || !issued.token) {
    return json({ ok: false, error: 'The verification email could not be sent.' }, 500);
  }

  const confirmUrl = `${supabaseUrl}/functions/v1/confirm-email?token=${issued.token}`;
  const mail = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      html:
        '<p>Verify this email so Brew &amp; Move can recover your account.</p>' +
        `<p><a href="${confirmUrl}">Verify my email</a></p>` +
        '<p>This link expires in 24 hours. If you did not create an account, you can ignore this message.</p>',
      subject: 'Verify your Brew & Move email',
      to: [userData.user.email],
    }),
  });

  if (!mail.ok) {
    return json({ ok: false, error: 'The verification email could not be sent.' }, 502);
  }

  return json({ ok: true, sent: true }, 200);
});
