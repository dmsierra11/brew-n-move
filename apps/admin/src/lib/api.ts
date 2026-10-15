import type { Session } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function invoke(
  name: string,
  session: Session,
  options: { body?: Record<string, unknown>; method?: string; query?: string } = {},
) {
  const response = await fetch(`${url}/functions/v1/${name}${options.query ?? ''}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: key,
      'Content-Type': 'application/json',
    },
    method: options.method ?? 'GET',
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok || payload.ok === false) {
    throw new Error(typeof payload.reason === 'string' ? payload.reason : 'unavailable');
  }
  return payload;
}

export function listBudgets(session: Session) {
  return invoke('admin-reward-budgets', session);
}

export function getBudget(session: Session, id: string) {
  return invoke('admin-reward-budgets', session, { query: `?id=${id}` });
}

export function createBudget(session: Session, body: Record<string, unknown>) {
  return invoke('admin-reward-budgets', session, { body, method: 'POST' });
}

export function runBudgetAction(session: Session, body: Record<string, unknown>) {
  return invoke('admin-reward-action', session, { body, method: 'POST' });
}

export function getCampaigns(session: Session, budgetId: string) {
  return invoke('admin-campaign', session, { query: `?budgetId=${budgetId}` });
}

export function runCampaignAction(session: Session, body: Record<string, unknown>) {
  return invoke('admin-campaign', session, { body, method: 'POST' });
}
