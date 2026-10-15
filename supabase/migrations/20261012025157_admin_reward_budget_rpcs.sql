-- Staff Edge Functions read and write private budget tables through these
-- RPCs. Privileged work stays in private. Public wrappers are security
-- invoker and executable only by service_role. The private schema stays
-- off the Data API. Admin JWT checks remain in the Edge Functions.

create or replace function private.admin_list_reward_budgets(p_id uuid default null)
returns setof private.reward_budgets
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from private.reward_budgets
  where p_id is null or id = p_id
  order by created_at;
$$;

create or replace function private.admin_list_settlements(p_budget_id uuid default null)
returns setof private.settlements
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from private.settlements
  where p_budget_id is null or budget_id = p_budget_id
  order by created_at;
$$;

create or replace function private.admin_list_settlement_fixtures()
returns setof private.settlement_fixtures
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.settlement_fixtures order by created_at;
$$;

create or replace function private.admin_list_redemption_economics(p_redemption_ids uuid[])
returns setof private.redemption_economics
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from private.redemption_economics
  where p_redemption_ids is not null
    and cardinality(p_redemption_ids) > 0
    and redemption_id = any (p_redemption_ids);
$$;

create or replace function private.admin_insert_reward_budget(
  p_name text,
  p_sponsor_display_name text,
  p_provider_partner_id uuid,
  p_budget_chain_id_hex text,
  p_authority_wallet text,
  p_verifier_wallet text,
  p_provider_token_account text,
  p_platform_token_account text,
  p_withdrawal_token_account text,
  p_mint text,
  p_commission_bps integer,
  p_program_id text,
  p_network text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into private.reward_budgets (
    name,
    sponsor_display_name,
    provider_partner_id,
    budget_chain_id,
    authority_wallet,
    verifier_wallet,
    provider_token_account,
    platform_token_account,
    withdrawal_token_account,
    mint,
    commission_bps,
    program_id,
    network,
    init_status
  ) values (
    p_name,
    p_sponsor_display_name,
    p_provider_partner_id,
    pg_catalog.decode(p_budget_chain_id_hex, 'hex'),
    p_authority_wallet,
    p_verifier_wallet,
    p_provider_token_account,
    p_platform_token_account,
    p_withdrawal_token_account,
    p_mint,
    p_commission_bps,
    p_program_id,
    p_network,
    'pending'
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.admin_insert_offer_budget(p_budget_id uuid, p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.offer_budgets (offer_id, budget_id, active)
  values (p_offer_id, p_budget_id, true);
exception
  when unique_violation then
    raise exception 'offer_already_linked';
end;
$$;

create or replace function private.admin_update_reward_budget(
  p_id uuid,
  p_init_status text,
  p_budget_pda text default null,
  p_vault_pda text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.reward_budgets
  set
    init_status = p_init_status,
    budget_pda = coalesce(p_budget_pda, budget_pda),
    vault_pda = coalesce(p_vault_pda, vault_pda)
  where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

create or replace function public.admin_list_reward_budgets(p_id uuid default null)
returns setof private.reward_budgets
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_reward_budgets(p_id);
$$;

create or replace function public.admin_list_settlements(p_budget_id uuid default null)
returns setof private.settlements
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_settlements(p_budget_id);
$$;

create or replace function public.admin_list_settlement_fixtures()
returns setof private.settlement_fixtures
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_settlement_fixtures();
$$;

create or replace function public.admin_list_redemption_economics(p_redemption_ids uuid[])
returns setof private.redemption_economics
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_redemption_economics(p_redemption_ids);
$$;

create or replace function public.admin_insert_reward_budget(
  p_name text,
  p_sponsor_display_name text,
  p_provider_partner_id uuid,
  p_budget_chain_id_hex text,
  p_authority_wallet text,
  p_verifier_wallet text,
  p_provider_token_account text,
  p_platform_token_account text,
  p_withdrawal_token_account text,
  p_mint text,
  p_commission_bps integer,
  p_program_id text,
  p_network text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.admin_insert_reward_budget(
    p_name,
    p_sponsor_display_name,
    p_provider_partner_id,
    p_budget_chain_id_hex,
    p_authority_wallet,
    p_verifier_wallet,
    p_provider_token_account,
    p_platform_token_account,
    p_withdrawal_token_account,
    p_mint,
    p_commission_bps,
    p_program_id,
    p_network
  );
$$;

create or replace function public.admin_insert_offer_budget(p_budget_id uuid, p_offer_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_insert_offer_budget(p_budget_id, p_offer_id);
$$;

create or replace function public.admin_update_reward_budget(
  p_id uuid,
  p_init_status text,
  p_budget_pda text default null,
  p_vault_pda text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_update_reward_budget(p_id, p_init_status, p_budget_pda, p_vault_pda);
$$;

revoke all on function private.admin_list_reward_budgets(uuid) from public, anon, authenticated, service_role;
revoke all on function private.admin_list_settlements(uuid) from public, anon, authenticated, service_role;
revoke all on function private.admin_list_settlement_fixtures() from public, anon, authenticated, service_role;
revoke all on function private.admin_list_redemption_economics(uuid[]) from public, anon, authenticated, service_role;
revoke all on function private.admin_insert_reward_budget(text, text, uuid, text, text, text, text, text, text, text, integer, text, text) from public, anon, authenticated, service_role;
revoke all on function private.admin_insert_offer_budget(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.admin_update_reward_budget(uuid, text, text, text) from public, anon, authenticated, service_role;

revoke all on function public.admin_list_reward_budgets(uuid) from public, anon, authenticated;
revoke all on function public.admin_list_settlements(uuid) from public, anon, authenticated;
revoke all on function public.admin_list_settlement_fixtures() from public, anon, authenticated;
revoke all on function public.admin_list_redemption_economics(uuid[]) from public, anon, authenticated;
revoke all on function public.admin_insert_reward_budget(text, text, uuid, text, text, text, text, text, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.admin_insert_offer_budget(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_update_reward_budget(uuid, text, text, text) from public, anon, authenticated;

grant execute on function private.admin_list_reward_budgets(uuid) to service_role;
grant execute on function private.admin_list_settlements(uuid) to service_role;
grant execute on function private.admin_list_settlement_fixtures() to service_role;
grant execute on function private.admin_list_redemption_economics(uuid[]) to service_role;
grant execute on function private.admin_insert_reward_budget(text, text, uuid, text, text, text, text, text, text, text, integer, text, text) to service_role;
grant execute on function private.admin_insert_offer_budget(uuid, uuid) to service_role;
grant execute on function private.admin_update_reward_budget(uuid, text, text, text) to service_role;

grant execute on function public.admin_list_reward_budgets(uuid) to service_role;
grant execute on function public.admin_list_settlements(uuid) to service_role;
grant execute on function public.admin_list_settlement_fixtures() to service_role;
grant execute on function public.admin_list_redemption_economics(uuid[]) to service_role;
grant execute on function public.admin_insert_reward_budget(text, text, uuid, text, text, text, text, text, text, text, integer, text, text) to service_role;
grant execute on function public.admin_insert_offer_budget(uuid, uuid) to service_role;
grant execute on function public.admin_update_reward_budget(uuid, text, text, text) to service_role;
