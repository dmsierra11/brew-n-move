import { createClient, type User } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

export function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

export function hexFromBytea(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }
  return value.startsWith('\\x') || value.startsWith('\\X') ? value.slice(2) : value;
}

export function keypairBytes(raw: string | undefined): number[] | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 64 || parsed.some((part) => typeof part !== 'number')) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function requireAdmin(req: Request) {
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

  return {
    admin: createClient(supabaseUrl, serviceKey),
    authHeader,
    supabaseUrl,
    user,
  };
}
