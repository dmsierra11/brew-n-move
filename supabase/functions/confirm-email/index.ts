import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

type ConfirmResult = {
  ok?: boolean;
};

function page(title: string, body: string, status: number) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body {
      background: #F3F4F1;
      color: #1A1814;
      font-family: ui-sans-serif, system-ui, sans-serif;
      margin: 0;
      padding: 48px 24px;
    }
    main {
      background: #FFFFFF;
      border: 1px solid #DDDCD5;
      border-radius: 26px;
      margin: 0 auto;
      max-width: 28rem;
      padding: 24px;
    }
    h1 { font-size: 28px; margin: 0 0 12px; }
    p { color: #706D66; font-size: 16px; line-height: 1.45; margin: 0; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${body}</p>
  </main>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return page('Link not valid', 'Open this verification link from the email Brew & Move sent.', 405);
  }

  const token = new URL(req.url).searchParams.get('token') ?? '';
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const { data, error } = await admin.rpc('confirm_email_token', { p_token: token });
  const result = (data ?? {}) as ConfirmResult;

  if (error || !result.ok) {
    return page(
      'Link not valid',
      'Open Brew & Move and request a new verification email from Profile.',
      400,
    );
  }

  return page(
    'Email verified',
    'Return to Brew & Move. Your account can now be recovered at this address.',
    200,
  );
});
