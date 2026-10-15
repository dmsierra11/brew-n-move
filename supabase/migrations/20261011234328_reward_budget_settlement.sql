-- Reward budget settlement.
-- Brew Points deduction is unchanged. A linked offer freezes the budget, provider
-- and platform token accounts, mint, program, and network onto the redemption.
-- Later budget edits do not change that snapshot. A settlement becomes confirmed
-- only when a receipt matches the snapshot. This migration does not submit Solana.

create table private.reward_budgets (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  name text not null,
  sponsor_display_name text not null,
  provider_partner_id uuid not null references public.partners (id),
  budget_chain_id bytea not null,
  authority_wallet text not null,
  verifier_wallet text not null,
  provider_token_account text not null,
  platform_token_account text not null,
  withdrawal_token_account text not null,
  mint text not null,
  commission_bps integer not null,
  program_id text not null,
  network text not null,
  budget_pda text,
  vault_pda text,
  init_status text not null default 'pending',
  created_at timestamptz not null default pg_catalog.now(),
  constraint reward_budgets_name_present check (char_length(pg_catalog.btrim(name)) > 0),
  constraint reward_budgets_sponsor_present check (char_length(pg_catalog.btrim(sponsor_display_name)) > 0),
  constraint reward_budgets_chain_id_length check (octet_length(budget_chain_id) between 1 and 32),
  constraint reward_budgets_authority_present check (char_length(pg_catalog.btrim(authority_wallet)) > 0),
  constraint reward_budgets_verifier_present check (char_length(pg_catalog.btrim(verifier_wallet)) > 0),
  constraint reward_budgets_provider_account_present check (char_length(pg_catalog.btrim(provider_token_account)) > 0),
  constraint reward_budgets_platform_account_present check (char_length(pg_catalog.btrim(platform_token_account)) > 0),
  constraint reward_budgets_withdrawal_account_present check (char_length(pg_catalog.btrim(withdrawal_token_account)) > 0),
  constraint reward_budgets_mint_present check (char_length(pg_catalog.btrim(mint)) > 0),
  constraint reward_budgets_program_present check (char_length(pg_catalog.btrim(program_id)) > 0),
  constraint reward_budgets_network_present check (char_length(pg_catalog.btrim(network)) > 0),
  constraint reward_budgets_recipients_distinct check (provider_token_account <> platform_token_account),
  constraint reward_budgets_commission_range check (commission_bps between 0 and 10000),
  constraint reward_budgets_init_status check (init_status in ('pending', 'confirmed', 'failed')),
  unique (authority_wallet, budget_chain_id)
);

comment on table private.reward_budgets is
  'Staff configuration for a reward budget. Settlement does not read this row after redemption. The sponsor display name is descriptive and does not identify the depositor.';

comment on column private.reward_budgets.budget_pda is
  'Copied onto each redemption snapshot. Null until the chain account has been read back as initialized.';

create table private.offer_budgets (
  offer_id uuid primary key references public.offers (id),
  budget_id uuid not null references private.reward_budgets (id),
  active boolean not null default true
);

comment on table private.offer_budgets is
  'One budget link per offer. An inactive link does not create a settlement obligation.';

create table private.redemption_economics (
  redemption_id uuid primary key references public.redemptions (id),
  budget_id uuid not null references private.reward_budgets (id),
  provider_partner_id uuid not null references public.partners (id),
  provider_token_account text,
  platform_token_account text,
  mint text,
  program_id text,
  network text,
  budget_pda text,
  vault_pda text,
  authority_wallet text,
  budget_chain_id bytea,
  list_price_cents integer,
  pay_price_cents integer,
  commission_bps integer,
  original_amount bigint,
  discount_amount bigint,
  discounted_price bigint,
  commission_amount bigint,
  provider_reimbursement bigint,
  economics_status text not null,
  invalid_reasons text[] not null default '{}',
  created_at timestamptz not null default pg_catalog.now(),
  constraint redemption_economics_status check (economics_status in ('complete', 'invalid')),
  constraint redemption_economics_chain_id_length check (
    budget_chain_id is null or octet_length(budget_chain_id) between 1 and 32
  ),
  constraint redemption_economics_complete check (
    economics_status <> 'complete'
    or (
      original_amount is not null
      and discount_amount is not null
      and discounted_price is not null
      and commission_amount is not null
      and provider_reimbursement is not null
      and cardinality(invalid_reasons) = 0
    )
  )
);

comment on table private.redemption_economics is
  'Immutable economics and settlement identity captured with the redemption. Provider and platform token accounts, mint, program, and network are the values used for that redemption. Later configuration changes do not update this row.';

create table private.settlement_fixtures (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  budget_id uuid not null references private.reward_budgets (id),
  label text not null,
  is_demo boolean not null default true,
  provider_partner_id uuid not null references public.partners (id),
  provider_token_account text not null,
  platform_token_account text not null,
  mint text not null,
  program_id text not null,
  network text not null,
  budget_pda text not null,
  vault_pda text not null,
  authority_wallet text not null,
  budget_chain_id bytea not null,
  original_amount bigint not null,
  discount_amount bigint not null,
  discounted_price bigint not null,
  commission_amount bigint not null,
  provider_reimbursement bigint not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint settlement_fixtures_label_present check (char_length(pg_catalog.btrim(label)) > 0),
  constraint settlement_fixtures_chain_id_length check (octet_length(budget_chain_id) between 1 and 32),
  constraint settlement_fixtures_amounts_positive check (
    original_amount > 0
    and discount_amount > 0
    and discounted_price >= 0
    and commission_amount >= 0
    and provider_reimbursement >= 0
  )
);

comment on table private.settlement_fixtures is
  'Fixed-value settlement identity copied when a demo fixture is queued. It is not a customer purchase.';

create table private.settlements (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  redemption_id uuid unique references public.redemptions (id),
  fixture_id uuid unique references private.settlement_fixtures (id),
  budget_id uuid not null references private.reward_budgets (id),
  chain_identifier bytea not null,
  discount_amount bigint,
  commission_amount bigint,
  provider_reimbursement bigint,
  status text not null,
  signature text,
  confirmed_at timestamptz,
  retry_count integer not null default 0,
  last_error text,
  processing_lease_until timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  constraint settlements_subject check (
    (redemption_id is not null and fixture_id is null)
    or (redemption_id is null and fixture_id is not null)
  ),
  constraint settlements_chain_identifier_length check (octet_length(chain_identifier) = 16),
  constraint settlements_status check (
    status in ('pending', 'processing', 'confirmed', 'failed', 'needs_reconciliation')
  ),
  constraint settlements_retry_nonnegative check (retry_count >= 0),
  constraint settlements_amounts_when_submittable check (
    status = 'needs_reconciliation'
    or (
      discount_amount is not null
      and commission_amount is not null
      and provider_reimbursement is not null
    )
  ),
  unique (budget_id, chain_identifier)
);

comment on table private.settlements is
  'One settlement obligation for a redemption or a labeled fixture. Amounts are copied from a complete snapshot. Confirmation is a receipt match, not a submission receipt.';

create index settlements_claimable
  on private.settlements (created_at)
  where status in ('pending', 'processing', 'failed');

alter table private.reward_budgets enable row level security;
alter table private.offer_budgets enable row level security;
alter table private.redemption_economics enable row level security;
alter table private.settlement_fixtures enable row level security;
alter table private.settlements enable row level security;

revoke all on private.reward_budgets from public, anon, authenticated, service_role;
revoke all on private.offer_budgets from public, anon, authenticated, service_role;
revoke all on private.redemption_economics from public, anon, authenticated, service_role;
revoke all on private.settlement_fixtures from public, anon, authenticated, service_role;
revoke all on private.settlements from public, anon, authenticated, service_role;

grant select on private.reward_budgets to service_role;
grant select on private.offer_budgets to service_role;
grant select on private.redemption_economics to service_role;
grant select on private.settlement_fixtures to service_role;
grant select on private.settlements to service_role;

create or replace function private.protect_redemption_economics()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'redemption economics are immutable';
end;
$$;

create trigger redemption_economics_immutable
  before update or delete on private.redemption_economics
  for each row execute function private.protect_redemption_economics();

create or replace function private.protect_settlement_fixture()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'settlement fixtures are immutable';
  end if;

  if new.budget_id is distinct from old.budget_id
    or new.label is distinct from old.label
    or new.is_demo is distinct from old.is_demo
    or new.provider_partner_id is distinct from old.provider_partner_id
    or new.provider_token_account is distinct from old.provider_token_account
    or new.platform_token_account is distinct from old.platform_token_account
    or new.mint is distinct from old.mint
    or new.program_id is distinct from old.program_id
    or new.network is distinct from old.network
    or new.budget_pda is distinct from old.budget_pda
    or new.vault_pda is distinct from old.vault_pda
    or new.authority_wallet is distinct from old.authority_wallet
    or new.budget_chain_id is distinct from old.budget_chain_id
    or new.original_amount is distinct from old.original_amount
    or new.discount_amount is distinct from old.discount_amount
    or new.discounted_price is distinct from old.discounted_price
    or new.commission_amount is distinct from old.commission_amount
    or new.provider_reimbursement is distinct from old.provider_reimbursement
  then
    raise exception 'settlement fixtures are immutable';
  end if;

  return new;
end;
$$;

create trigger settlement_fixtures_immutable
  before update or delete on private.settlement_fixtures
  for each row execute function private.protect_settlement_fixture();

create or replace function private.protect_settlement_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'settlements cannot be deleted';
  end if;

  if new.redemption_id is distinct from old.redemption_id
    or new.fixture_id is distinct from old.fixture_id
    or new.budget_id is distinct from old.budget_id
    or new.chain_identifier is distinct from old.chain_identifier
    or new.discount_amount is distinct from old.discount_amount
    or new.commission_amount is distinct from old.commission_amount
    or new.provider_reimbursement is distinct from old.provider_reimbursement
    or new.created_at is distinct from old.created_at
  then
    raise exception 'settlement economics are immutable';
  end if;

  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    if pg_catalog.current_setting('reward_vault.receipt_matched', true) is distinct from 'on' then
      raise exception 'settlement confirmation requires a receipt match';
    end if;
  end if;

  return new;
end;
$$;

create trigger settlements_immutable_economics
  before update or delete on private.settlements
  for each row execute function private.protect_settlement_row();

create or replace function private.derive_settlement_amounts(
  p_list_price_cents integer,
  p_pay_price_cents integer,
  p_commission_bps integer
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_reasons text[] := array[]::text[];
  v_original bigint;
  v_discounted bigint;
  v_discount bigint;
  v_commission bigint;
  v_reimbursement bigint;
  v_prices boolean;
  v_bps_ok boolean;
begin
  if p_list_price_cents is null then
    v_reasons := pg_catalog.array_append(v_reasons, 'missing_list_price');
  elsif p_list_price_cents <= 0 then
    v_reasons := pg_catalog.array_append(v_reasons, 'list_price_not_positive');
  end if;

  if p_pay_price_cents is null then
    v_reasons := pg_catalog.array_append(v_reasons, 'missing_pay_price');
  elsif p_pay_price_cents < 0 then
    v_reasons := pg_catalog.array_append(v_reasons, 'pay_price_negative');
  end if;

  if p_commission_bps is null then
    v_reasons := pg_catalog.array_append(v_reasons, 'missing_commission_bps');
  elsif p_commission_bps < 0 or p_commission_bps > 10000 then
    v_reasons := pg_catalog.array_append(v_reasons, 'commission_bps_out_of_range');
  end if;

  v_prices := p_list_price_cents is not null
    and p_list_price_cents > 0
    and p_pay_price_cents is not null
    and p_pay_price_cents >= 0;
  v_bps_ok := p_commission_bps is not null
    and p_commission_bps between 0 and 10000;

  if v_prices and p_pay_price_cents > p_list_price_cents then
    v_reasons := pg_catalog.array_append(v_reasons, 'pay_exceeds_list');
  elsif v_prices then
    begin
      v_original := p_list_price_cents::bigint * 10000;
      v_discounted := p_pay_price_cents::bigint * 10000;
      v_discount := v_original - v_discounted;
    exception
      when numeric_value_out_of_range then
        v_reasons := pg_catalog.array_append(v_reasons, 'amount_overflow');
        v_original := null;
        v_discounted := null;
        v_discount := null;
    end;

    if v_discount is not null and v_discount <= 0 then
      v_reasons := pg_catalog.array_append(v_reasons, 'discount_not_positive');
    elsif v_discount is not null and v_discount > 0 and v_bps_ok then
      begin
        v_commission := (v_discounted * p_commission_bps::bigint) / 10000;
      exception
        when numeric_value_out_of_range then
          v_reasons := pg_catalog.array_append(v_reasons, 'amount_overflow');
          v_commission := null;
      end;

      if v_commission is not null and v_commission > v_discount then
        v_reasons := pg_catalog.array_append(v_reasons, 'commission_exceeds_discount');
      elsif v_commission is not null then
        v_reimbursement := v_discount - v_commission;
      end if;
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'list_price_cents', pg_catalog.to_jsonb(p_list_price_cents),
    'pay_price_cents', pg_catalog.to_jsonb(p_pay_price_cents),
    'commission_bps', pg_catalog.to_jsonb(p_commission_bps),
    'original_amount', pg_catalog.to_jsonb(v_original),
    'discount_amount', pg_catalog.to_jsonb(v_discount),
    'discounted_price', pg_catalog.to_jsonb(v_discounted),
    'commission_amount', pg_catalog.to_jsonb(v_commission),
    'provider_reimbursement', pg_catalog.to_jsonb(v_reimbursement),
    'economics_status', case
      when v_original is not null
        and v_discount is not null
        and v_discounted is not null
        and v_commission is not null
        and v_reimbursement is not null
        and cardinality(v_reasons) = 0
      then 'complete'
      else 'invalid'
    end,
    'invalid_reasons', pg_catalog.to_jsonb(v_reasons)
  );
end;
$$;

create or replace function private.capture_redemption_economics(p_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer_id uuid;
  v_budget_id uuid;
  v_budget private.reward_budgets%rowtype;
  v_offer public.offers%rowtype;
  v_amounts jsonb;
  v_reasons text[] := array[]::text[];
  v_status text;
  v_identity_missing boolean;
  v_settlement_status text;
  v_last_error text;
  v_reason text;
begin
  select offer_id into v_offer_id
  from public.redemptions
  where id = p_redemption_id;

  if v_offer_id is null then
    return;
  end if;

  select budget_id into v_budget_id
  from private.offer_budgets
  where offer_id = v_offer_id
    and active
  for update;

  if v_budget_id is null then
    return;
  end if;

  select * into v_budget
  from private.reward_budgets
  where id = v_budget_id
  for update;

  select * into v_offer
  from public.offers
  where id = v_offer_id;

  v_amounts := private.derive_settlement_amounts(
    v_offer.list_price_cents,
    v_offer.pay_price_cents,
    v_budget.commission_bps
  );
  v_status := v_amounts ->> 'economics_status';

  for v_reason in
    select pg_catalog.jsonb_array_elements_text(v_amounts -> 'invalid_reasons')
  loop
    v_reasons := pg_catalog.array_append(v_reasons, v_reason);
  end loop;

  v_identity_missing := v_budget.provider_token_account is null
    or v_budget.platform_token_account is null
    or v_budget.mint is null
    or v_budget.program_id is null
    or v_budget.network is null
    or v_budget.budget_pda is null
    or v_budget.vault_pda is null
    or v_budget.authority_wallet is null
    or v_budget.budget_chain_id is null;

  insert into private.redemption_economics (
    redemption_id,
    budget_id,
    provider_partner_id,
    provider_token_account,
    platform_token_account,
    mint,
    program_id,
    network,
    budget_pda,
    vault_pda,
    authority_wallet,
    budget_chain_id,
    list_price_cents,
    pay_price_cents,
    commission_bps,
    original_amount,
    discount_amount,
    discounted_price,
    commission_amount,
    provider_reimbursement,
    economics_status,
    invalid_reasons
  )
  values (
    p_redemption_id,
    v_budget.id,
    v_budget.provider_partner_id,
    v_budget.provider_token_account,
    v_budget.platform_token_account,
    v_budget.mint,
    v_budget.program_id,
    v_budget.network,
    v_budget.budget_pda,
    v_budget.vault_pda,
    v_budget.authority_wallet,
    v_budget.budget_chain_id,
    (v_amounts ->> 'list_price_cents')::integer,
    (v_amounts ->> 'pay_price_cents')::integer,
    (v_amounts ->> 'commission_bps')::integer,
    (v_amounts ->> 'original_amount')::bigint,
    (v_amounts ->> 'discount_amount')::bigint,
    (v_amounts ->> 'discounted_price')::bigint,
    (v_amounts ->> 'commission_amount')::bigint,
    (v_amounts ->> 'provider_reimbursement')::bigint,
    v_status,
    v_reasons
  );

  if v_status = 'complete' and not v_identity_missing then
    v_settlement_status := 'pending';
    v_last_error := null;
  else
    v_settlement_status := 'needs_reconciliation';
    if v_identity_missing then
      v_reasons := pg_catalog.array_append(v_reasons, 'missing_settlement_identity');
    end if;
    v_last_error := pg_catalog.array_to_string(v_reasons, ',');
  end if;

  insert into private.settlements (
    redemption_id,
    budget_id,
    chain_identifier,
    discount_amount,
    commission_amount,
    provider_reimbursement,
    status,
    last_error
  )
  values (
    p_redemption_id,
    v_budget.id,
    pg_catalog.uuid_send(p_redemption_id),
    case
      when v_status = 'complete' then (v_amounts ->> 'discount_amount')::bigint
      else null
    end,
    case
      when v_status = 'complete' then (v_amounts ->> 'commission_amount')::bigint
      else null
    end,
    case
      when v_status = 'complete' then (v_amounts ->> 'provider_reimbursement')::bigint
      else null
    end,
    v_settlement_status,
    v_last_error
  );
end;
$$;

create or replace function private.settlement_snapshot(p_settlement private.settlements)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_economics private.redemption_economics%rowtype;
  v_fixture private.settlement_fixtures%rowtype;
begin
  if p_settlement.redemption_id is not null then
    select * into v_economics
    from private.redemption_economics
    where redemption_id = p_settlement.redemption_id;

    return pg_catalog.jsonb_build_object(
      'budget_id', v_economics.budget_id,
      'budget_pda', v_economics.budget_pda,
      'vault_pda', v_economics.vault_pda,
      'authority_wallet', v_economics.authority_wallet,
      'budget_chain_id', pg_catalog.encode(v_economics.budget_chain_id, 'hex'),
      'provider_token_account', v_economics.provider_token_account,
      'platform_token_account', v_economics.platform_token_account,
      'mint', v_economics.mint,
      'program_id', v_economics.program_id,
      'network', v_economics.network,
      'original_amount', v_economics.original_amount::text,
      'discount_amount', v_economics.discount_amount::text,
      'commission_amount', v_economics.commission_amount::text,
      'provider_reimbursement', v_economics.provider_reimbursement::text,
      'economics_status', v_economics.economics_status,
      'chain_identifier', pg_catalog.encode(p_settlement.chain_identifier, 'hex')
    );
  end if;

  select * into v_fixture
  from private.settlement_fixtures
  where id = p_settlement.fixture_id;

  return pg_catalog.jsonb_build_object(
    'budget_id', v_fixture.budget_id,
    'budget_pda', v_fixture.budget_pda,
    'vault_pda', v_fixture.vault_pda,
    'authority_wallet', v_fixture.authority_wallet,
    'budget_chain_id', pg_catalog.encode(v_fixture.budget_chain_id, 'hex'),
    'provider_token_account', v_fixture.provider_token_account,
    'platform_token_account', v_fixture.platform_token_account,
    'mint', v_fixture.mint,
    'program_id', v_fixture.program_id,
    'network', v_fixture.network,
    'original_amount', v_fixture.original_amount::text,
    'discount_amount', v_fixture.discount_amount::text,
    'commission_amount', v_fixture.commission_amount::text,
    'provider_reimbursement', v_fixture.provider_reimbursement::text,
    'economics_status', 'complete',
    'chain_identifier', pg_catalog.encode(p_settlement.chain_identifier, 'hex')
  );
end;
$$;

create or replace function private.claim_reward_settlement(
  p_settlement_id uuid,
  p_redemption_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_explicit boolean := p_settlement_id is not null or p_redemption_id is not null;
  v_row private.settlements%rowtype;
  v_snapshot jsonb;
  v_identity_missing boolean;
begin
  select * into v_row
  from private.settlements
  where (
      (p_settlement_id is not null and id = p_settlement_id)
      or (
        p_settlement_id is null
        and p_redemption_id is not null
        and redemption_id = p_redemption_id
      )
      or (p_settlement_id is null and p_redemption_id is null)
    )
    and (
      status = 'pending'
      or (
        status = 'processing'
        and (processing_lease_until is null or processing_lease_until <= pg_catalog.now())
      )
      or (v_explicit and status = 'failed')
    )
    and discount_amount is not null
    and commission_amount is not null
    and provider_reimbursement is not null
  order by created_at
  limit 1
  for update skip locked;

  if v_row.id is null then
    if not v_explicit then
      return pg_catalog.jsonb_build_object('ok', true, 'reason', 'idle');
    end if;

    select * into v_row
    from private.settlements
    where (p_settlement_id is not null and id = p_settlement_id)
      or (p_settlement_id is null and redemption_id = p_redemption_id);

    if v_row.id is null then
      return pg_catalog.jsonb_build_object('ok', true, 'reason', 'idle');
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'reason', v_row.status,
      'settlement_id', v_row.id,
      'last_error', v_row.last_error
    );
  end if;

  v_snapshot := private.settlement_snapshot(v_row);
  v_identity_missing := v_snapshot ->> 'budget_pda' is null
    or v_snapshot ->> 'vault_pda' is null
    or v_snapshot ->> 'authority_wallet' is null
    or v_snapshot ->> 'budget_chain_id' is null
    or v_snapshot ->> 'provider_token_account' is null
    or v_snapshot ->> 'platform_token_account' is null
    or v_snapshot ->> 'mint' is null
    or v_snapshot ->> 'program_id' is null
    or v_snapshot ->> 'network' is null
    or v_snapshot ->> 'economics_status' is distinct from 'complete';

  if v_identity_missing then
    update private.settlements
    set
      status = 'needs_reconciliation',
      last_error = 'missing_settlement_identity',
      processing_lease_until = null
    where id = v_row.id;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'reason', 'needs_reconciliation',
      'settlement_id', v_row.id,
      'last_error', 'missing_settlement_identity'
    );
  end if;

  update private.settlements
  set
    status = 'processing',
    processing_lease_until = pg_catalog.now() + interval '2 minutes',
    retry_count = case
      when v_row.status in ('processing', 'failed') then retry_count + 1
      else retry_count
    end
  where id = v_row.id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'reason', 'claimed',
    'settlement_id', v_row.id,
    'signature', v_row.signature,
    'snapshot', v_snapshot
  );
end;
$$;

create or replace function private.record_reward_settlement_signature(
  p_settlement_id uuid,
  p_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.settlements%rowtype;
begin
  if p_signature is null or char_length(pg_catalog.btrim(p_signature)) = 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid_signature');
  end if;

  select * into v_row
  from private.settlements
  where id = p_settlement_id
  for update;

  if v_row.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'idle');
  end if;

  if v_row.signature is null then
    update private.settlements
    set signature = p_signature
    where id = v_row.id;
    return pg_catalog.jsonb_build_object('ok', true, 'reason', 'recorded');
  end if;

  if v_row.signature = p_signature then
    return pg_catalog.jsonb_build_object('ok', true, 'reason', 'recorded');
  end if;

  update private.settlements
  set
    status = 'needs_reconciliation',
    last_error = 'signature_mismatch',
    processing_lease_until = null
  where id = v_row.id;

  return pg_catalog.jsonb_build_object('ok', true, 'reason', 'needs_reconciliation');
end;
$$;

create or replace function private.match_reward_settlement_receipt(
  p_settlement_id uuid,
  p_budget_pda text,
  p_redemption_id_hex text,
  p_original_amount bigint,
  p_discount_amount bigint,
  p_commission_amount bigint,
  p_provider_reimbursement bigint,
  p_receipt_owner text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.settlements%rowtype;
  v_snapshot jsonb;
  v_presented bytea;
  v_fields text[] := array[]::text[];
  v_budget_pda text;
  v_program_id text;
  v_chain bytea;
  v_original bigint;
  v_discount bigint;
  v_commission bigint;
  v_provider bigint;
  v_matched boolean;
begin
  select * into v_row
  from private.settlements
  where id = p_settlement_id
  for update;

  if v_row.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'idle');
  end if;

  v_snapshot := private.settlement_snapshot(v_row);
  v_budget_pda := v_snapshot ->> 'budget_pda';
  v_program_id := v_snapshot ->> 'program_id';
  v_chain := v_row.chain_identifier;
  v_original := nullif(v_snapshot ->> 'original_amount', '')::bigint;
  v_discount := nullif(v_snapshot ->> 'discount_amount', '')::bigint;
  v_commission := nullif(v_snapshot ->> 'commission_amount', '')::bigint;
  v_provider := nullif(v_snapshot ->> 'provider_reimbursement', '')::bigint;

  begin
    v_presented := pg_catalog.decode(p_redemption_id_hex, 'hex');
  exception
    when others then
      v_presented := null;
  end;

  if p_receipt_owner is distinct from v_program_id or v_program_id is null then
    v_fields := pg_catalog.array_append(v_fields, 'receipt_owner');
  end if;
  if p_budget_pda is distinct from v_budget_pda or v_budget_pda is null then
    v_fields := pg_catalog.array_append(v_fields, 'budget');
  end if;
  if v_presented is distinct from v_chain or v_presented is null or octet_length(v_presented) <> 16 then
    v_fields := pg_catalog.array_append(v_fields, 'redemption_identifier');
  end if;
  if p_original_amount is distinct from v_original or v_original is null then
    v_fields := pg_catalog.array_append(v_fields, 'original_price');
  end if;
  if p_discount_amount is distinct from v_discount or v_discount is null then
    v_fields := pg_catalog.array_append(v_fields, 'discount');
  end if;
  if p_commission_amount is distinct from v_commission or v_commission is null then
    v_fields := pg_catalog.array_append(v_fields, 'commission');
  end if;
  if p_provider_reimbursement is distinct from v_provider or v_provider is null then
    v_fields := pg_catalog.array_append(v_fields, 'provider_reimbursement');
  end if;
  if v_snapshot ->> 'economics_status' is distinct from 'complete' then
    v_fields := pg_catalog.array_append(v_fields, 'economics_status');
  end if;

  v_matched := cardinality(v_fields) = 0;

  if v_row.status = 'confirmed' then
    if v_matched then
      return pg_catalog.jsonb_build_object('ok', true, 'reason', 'confirmed');
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', false,
      'reason', 'receipt_mismatch',
      'last_error', 'receipt_mismatch:' || pg_catalog.array_to_string(v_fields, ',')
    );
  end if;

  if v_matched then
    perform pg_catalog.set_config('reward_vault.receipt_matched', 'on', true);
    update private.settlements
    set
      status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, pg_catalog.now()),
      processing_lease_until = null,
      last_error = null
    where id = v_row.id;

    return pg_catalog.jsonb_build_object('ok', true, 'reason', 'confirmed');
  end if;

  update private.settlements
  set
    status = 'needs_reconciliation',
    last_error = 'receipt_mismatch:' || pg_catalog.array_to_string(v_fields, ','),
    processing_lease_until = null
  where id = v_row.id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'reason', 'needs_reconciliation',
    'last_error', 'receipt_mismatch:' || pg_catalog.array_to_string(v_fields, ',')
  );
end;
$$;

create or replace function private.fail_reward_settlement(
  p_settlement_id uuid,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status
  from private.settlements
  where id = p_settlement_id
  for update;

  if v_status is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'idle');
  end if;

  if v_status = 'confirmed' then
    return pg_catalog.jsonb_build_object('ok', true, 'reason', 'confirmed');
  end if;

  update private.settlements
  set
    status = 'failed',
    last_error = p_error,
    processing_lease_until = null
  where id = p_settlement_id;

  return pg_catalog.jsonb_build_object('ok', true, 'reason', 'failed');
end;
$$;

create or replace function private.reconcile_reward_settlement(
  p_settlement_id uuid,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status
  from private.settlements
  where id = p_settlement_id
  for update;

  if v_status is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'idle');
  end if;

  if v_status = 'confirmed' then
    return pg_catalog.jsonb_build_object('ok', true, 'reason', 'confirmed');
  end if;

  update private.settlements
  set
    status = 'needs_reconciliation',
    last_error = p_error,
    processing_lease_until = null
  where id = p_settlement_id;

  return pg_catalog.jsonb_build_object('ok', true, 'reason', 'needs_reconciliation');
end;
$$;

create or replace function private.queue_demo_settlement_fixture(p_budget_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget private.reward_budgets%rowtype;
  v_amounts jsonb;
  v_fixture_id uuid;
  v_reasons text;
begin
  select * into v_budget
  from private.reward_budgets
  where id = p_budget_id
  for update;

  if v_budget.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'idle');
  end if;

  if v_budget.budget_pda is null or v_budget.vault_pda is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'missing_settlement_identity');
  end if;

  v_amounts := private.derive_settlement_amounts(400, 320, v_budget.commission_bps);
  if v_amounts ->> 'economics_status' is distinct from 'complete' then
    select pg_catalog.string_agg(value, ',') into v_reasons
    from pg_catalog.jsonb_array_elements_text(v_amounts -> 'invalid_reasons') as value;
    return pg_catalog.jsonb_build_object('ok', false, 'reason', coalesce(v_reasons, 'invalid'));
  end if;

  insert into private.settlement_fixtures (
    budget_id,
    label,
    is_demo,
    provider_partner_id,
    provider_token_account,
    platform_token_account,
    mint,
    program_id,
    network,
    budget_pda,
    vault_pda,
    authority_wallet,
    budget_chain_id,
    original_amount,
    discount_amount,
    discounted_price,
    commission_amount,
    provider_reimbursement
  )
  values (
    v_budget.id,
    'Demo fixture: 20% off a 4.00 coffee. Not a customer purchase.',
    true,
    v_budget.provider_partner_id,
    v_budget.provider_token_account,
    v_budget.platform_token_account,
    v_budget.mint,
    v_budget.program_id,
    v_budget.network,
    v_budget.budget_pda,
    v_budget.vault_pda,
    v_budget.authority_wallet,
    v_budget.budget_chain_id,
    (v_amounts ->> 'original_amount')::bigint,
    (v_amounts ->> 'discount_amount')::bigint,
    (v_amounts ->> 'discounted_price')::bigint,
    (v_amounts ->> 'commission_amount')::bigint,
    (v_amounts ->> 'provider_reimbursement')::bigint
  )
  returning id into v_fixture_id;

  insert into private.settlements (
    fixture_id,
    budget_id,
    chain_identifier,
    discount_amount,
    commission_amount,
    provider_reimbursement,
    status
  )
  values (
    v_fixture_id,
    v_budget.id,
    pg_catalog.uuid_send(v_fixture_id),
    (v_amounts ->> 'discount_amount')::bigint,
    (v_amounts ->> 'commission_amount')::bigint,
    (v_amounts ->> 'provider_reimbursement')::bigint,
    'pending'
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'reason', 'queued',
    'fixture_id', v_fixture_id
  );
end;
$$;

create or replace function public.claim_reward_settlement(
  p_settlement_id uuid,
  p_redemption_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.claim_reward_settlement(p_settlement_id, p_redemption_id);
$$;

create or replace function public.record_reward_settlement_signature(
  p_settlement_id uuid,
  p_signature text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.record_reward_settlement_signature(p_settlement_id, p_signature);
$$;

create or replace function public.match_reward_settlement_receipt(
  p_settlement_id uuid,
  p_budget_pda text,
  p_redemption_id_hex text,
  p_original_amount bigint,
  p_discount_amount bigint,
  p_commission_amount bigint,
  p_provider_reimbursement bigint,
  p_receipt_owner text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.match_reward_settlement_receipt(
    p_settlement_id,
    p_budget_pda,
    p_redemption_id_hex,
    p_original_amount,
    p_discount_amount,
    p_commission_amount,
    p_provider_reimbursement,
    p_receipt_owner
  );
$$;

create or replace function public.fail_reward_settlement(
  p_settlement_id uuid,
  p_error text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.fail_reward_settlement(p_settlement_id, p_error);
$$;

create or replace function public.reconcile_reward_settlement(
  p_settlement_id uuid,
  p_error text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.reconcile_reward_settlement(p_settlement_id, p_error);
$$;

create or replace function public.queue_demo_settlement_fixture(p_budget_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.queue_demo_settlement_fixture(p_budget_id);
$$;

revoke all on function private.derive_settlement_amounts(integer, integer, integer) from public, anon, authenticated, service_role;
revoke all on function private.capture_redemption_economics(uuid) from public, anon, authenticated, service_role;
revoke all on function private.settlement_snapshot(private.settlements) from public, anon, authenticated, service_role;
revoke all on function private.claim_reward_settlement(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.record_reward_settlement_signature(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.match_reward_settlement_receipt(uuid, text, text, bigint, bigint, bigint, bigint, text) from public, anon, authenticated, service_role;
revoke all on function private.fail_reward_settlement(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.reconcile_reward_settlement(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.queue_demo_settlement_fixture(uuid) from public, anon, authenticated, service_role;
revoke all on function private.protect_redemption_economics() from public, anon, authenticated, service_role;
revoke all on function private.protect_settlement_fixture() from public, anon, authenticated, service_role;
revoke all on function private.protect_settlement_row() from public, anon, authenticated, service_role;

revoke all on function public.claim_reward_settlement(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_reward_settlement_signature(uuid, text) from public, anon, authenticated;
revoke all on function public.match_reward_settlement_receipt(uuid, text, text, bigint, bigint, bigint, bigint, text) from public, anon, authenticated;
revoke all on function public.fail_reward_settlement(uuid, text) from public, anon, authenticated;
revoke all on function public.reconcile_reward_settlement(uuid, text) from public, anon, authenticated;
revoke all on function public.queue_demo_settlement_fixture(uuid) from public, anon, authenticated;

grant execute on function private.claim_reward_settlement(uuid, uuid) to service_role;
grant execute on function private.record_reward_settlement_signature(uuid, text) to service_role;
grant execute on function private.match_reward_settlement_receipt(uuid, text, text, bigint, bigint, bigint, bigint, text) to service_role;
grant execute on function private.fail_reward_settlement(uuid, text) to service_role;
grant execute on function private.reconcile_reward_settlement(uuid, text) to service_role;
grant execute on function private.queue_demo_settlement_fixture(uuid) to service_role;
grant execute on function public.claim_reward_settlement(uuid, uuid) to service_role;
grant execute on function public.record_reward_settlement_signature(uuid, text) to service_role;
grant execute on function public.match_reward_settlement_receipt(uuid, text, text, bigint, bigint, bigint, bigint, text) to service_role;
grant execute on function public.fail_reward_settlement(uuid, text) to service_role;
grant execute on function public.reconcile_reward_settlement(uuid, text) to service_role;
grant execute on function public.queue_demo_settlement_fixture(uuid) to service_role;

-- Redeem still deducts Brew Points in this same transaction. The economics row
-- and the settlement obligation commit with that redemption. An offer with no
-- active budget gets neither row. Invalid economics do not invent amounts.

create or replace function private.redeem_offer(
  p_member_id uuid,
  p_offer_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_request_id uuid,
  p_commit boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.redemptions%rowtype;
  v_member uuid;
  v_offer public.offers%rowtype;
  v_latitude double precision;
  v_longitude double precision;
  v_location_name text;
  v_partner_name text;
  v_used integer;
  v_balance integer;
  v_distance double precision;
  v_new public.redemptions%rowtype;
begin
  if p_commit is not true and p_commit is not false then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  if p_member_id is null or p_offer_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  if p_commit then
    if p_request_id is null then
      return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid_payload');
    end if;

    select * into v_existing
    from public.redemptions
    where member_id = p_member_id
      and client_request_id = p_request_id;

    if v_existing.id is not null then
      return private.redemption_result(v_existing);
    end if;
  end if;

  if p_latitude is null
    or p_longitude is null
    or p_latitude <> p_latitude
    or p_longitude <> p_longitude
    or p_latitude < -90
    or p_latitude > 90
    or p_longitude < -180
    or p_longitude > 180
  then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  select id into v_member
  from public.members
  where id = p_member_id
  for update;

  if v_member is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'not_onboarded');
  end if;

  if p_commit then
    select * into v_existing
    from public.redemptions
    where member_id = p_member_id
      and client_request_id = p_request_id;

    if v_existing.id is not null then
      return private.redemption_result(v_existing);
    end if;
  end if;

  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if v_offer.id is null
    or v_offer.status is distinct from 'active'
    or (v_offer.expires_at is not null and v_offer.expires_at <= pg_catalog.now())
  then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'offer_unavailable');
  end if;

  if v_offer.quantity is not null then
    select count(*)::integer into v_used
    from public.redemptions
    where offer_id = v_offer.id;

    if v_used >= v_offer.quantity then
      return pg_catalog.jsonb_build_object('ok', false, 'reason', 'sold_out');
    end if;
  end if;

  select locations.latitude, locations.longitude, locations.name, partners.name
  into v_latitude, v_longitude, v_location_name, v_partner_name
  from public.locations
  join public.partners on partners.id = locations.partner_id
  where locations.id = v_offer.location_id
  for update of locations;

  if v_latitude is null or v_longitude is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'location_unavailable');
  end if;

  v_distance := private.metres_between(v_latitude, v_longitude, p_latitude, p_longitude);
  if v_distance > 100 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'outside_geofence');
  end if;

  insert into public.member_balances (member_id, balance)
  values (p_member_id, 0)
  on conflict (member_id) do nothing;

  select balance into v_balance
  from public.member_balances
  where member_id = p_member_id
  for update;

  if v_balance < v_offer.points_cost then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_balance',
      'balance', v_balance
    );
  end if;

  if p_commit is not true then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'reason', 'eligible',
      'offer_id', v_offer.id,
      'partner', v_partner_name,
      'location', v_location_name,
      'title', v_offer.title,
      'value_label', v_offer.value_label,
      'points_cost', v_offer.points_cost,
      'balance', v_balance
    );
  end if;

  begin
    update public.member_balances
    set
      balance = balance - v_offer.points_cost,
      updated_at = pg_catalog.now()
    where member_id = p_member_id
      and balance >= v_offer.points_cost
    returning balance into v_balance;

    if v_balance is null then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'reason', 'insufficient_balance',
        'balance', (
          select balance from public.member_balances where member_id = p_member_id
        )
      );
    end if;

    insert into public.redemptions (
      member_id,
      partner_id,
      location_id,
      offer_id,
      partner_name,
      location_name,
      offer_title,
      points_spent,
      value_label,
      client_request_id
    )
    values (
      p_member_id,
      (select partner_id from public.locations where id = v_offer.location_id),
      v_offer.location_id,
      v_offer.id,
      v_partner_name,
      v_location_name,
      v_offer.title,
      v_offer.points_cost,
      v_offer.value_label,
      p_request_id
    )
    returning * into v_new;

    insert into private.point_redemptions (
      redemption_id,
      member_id,
      offer_id,
      points,
      solana_status
    )
    values (
      v_new.id,
      p_member_id,
      v_offer.id,
      v_offer.points_cost,
      'blocked'
    );

    perform private.capture_redemption_economics(v_new.id);
  exception
    when unique_violation then
      select * into v_existing
      from public.redemptions
      where member_id = p_member_id
        and client_request_id = p_request_id;

      if v_existing.id is null then
        return pg_catalog.jsonb_build_object('ok', false, 'reason', 'unavailable');
      end if;

      return private.redemption_result(v_existing);
  end;

  return private.redemption_result(v_new);
end;
$$;

-- 3fe Demo Café is a labeled demonstration record. It is not a commercial partnership.
-- The coordinates are the demo geofence the phone must be inside. They are not a claim
-- that a café at that point participates.

insert into public.partners (id, name)
values ('d1111111-1111-4111-8111-111111111111', '3fe Demo Café');

insert into public.locations (id, partner_id, name, address, latitude, longitude)
values (
  'd2222222-2222-4222-8222-222222222222',
  'd1111111-1111-4111-8111-111111111111',
  'Demo counter',
  'Demo counter, not a participating café',
  53.349805,
  -6.260310
);

insert into public.offers (
  id,
  location_id,
  slug,
  title,
  description,
  value_label,
  points_cost,
  list_price_cents,
  pay_price_cents
)
values (
  'd3333333-3333-4333-8333-333333333333',
  'd2222222-2222-4222-8222-222222222222',
  'demo-3fe-coffee',
  '20% off a coffee',
  'Demo offer: 20% off a 4.00 coffee. 3fe Demo Café is a labeled demonstration record, not a commercial partnership.',
  '20% off a 4.00 coffee (demo)',
  50,
  400,
  320
);
