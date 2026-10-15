-- Split spend into exchange (points + reserved cover) and a later till swipe.
-- Settlement is queued only at till confirm. Cover is shared across all offers
-- on a budget. Issued vouchers keep frozen economics when campaigns change.

alter table private.reward_budgets
  add column recorded_deposited bigint not null default 0;

alter table private.reward_budgets
  add constraint reward_budgets_recorded_deposited_nonnegative check (recorded_deposited >= 0);

comment on column private.reward_budgets.recorded_deposited is
  'Demo-token deposits recorded after Fund. Available cover is this minus frozen discounts of every issued voucher on the budget.';

alter table public.redemptions
  add column till_confirmed_at timestamptz;

comment on column public.redemptions.redeemed_at is
  'When points were deducted at exchange. The staff five-minute clock uses till_confirmed_at.';

comment on column public.redemptions.till_confirmed_at is
  'First successful café swipe. Later swipes return this instant and do not restart the clock.';

update public.redemptions
set till_confirmed_at = redeemed_at
where till_confirmed_at is null;

update private.reward_budgets
set recorded_deposited = 97600000
where id = 'f1111111-1111-4111-8111-111111111111';

update public.offers
set quantity = greatest(10, (
  select count(*)::integer
  from public.redemptions
  where redemptions.offer_id = 'd3333333-3333-4333-8333-333333333333'
))
where id = 'd3333333-3333-4333-8333-333333333333';

create or replace function private.budget_reserved(p_budget_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(economics.discount_amount), 0)
  from private.redemption_economics as economics
  where economics.budget_id = p_budget_id
    and economics.discount_amount is not null
    and economics.discount_amount > 0;
$$;

create or replace function private.budget_available(p_budget_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select greatest(
    coalesce((
      select recorded_deposited from private.reward_budgets where id = p_budget_id
    ), 0) - private.budget_reserved(p_budget_id),
    0
  );
$$;

create or replace function private.redemption_result(p_row public.redemptions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'ok', true,
    'reason', case
      when p_row.till_confirmed_at is not null then 'redeemed'
      else 'issued'
    end,
    'redemption_id', p_row.id,
    'offer_id', p_row.offer_id,
    'partner', p_row.partner_name,
    'location', p_row.location_name,
    'title', p_row.offer_title,
    'value_label', p_row.value_label,
    'points_spent', p_row.points_spent,
    'redeemed_at', p_row.redeemed_at,
    'till_confirmed_at', p_row.till_confirmed_at,
    'balance', coalesce((
      select balance
      from public.member_balances
      where member_id = p_row.member_id
    ), 0)
  );
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
end;
$$;

create or replace function private.queue_redemption_settlement(p_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_economics private.redemption_economics%rowtype;
  v_identity_missing boolean;
  v_reasons text[];
  v_settlement_status text;
  v_last_error text;
begin
  if exists (select 1 from private.settlements where redemption_id = p_redemption_id) then
    return;
  end if;

  select * into v_economics
  from private.redemption_economics
  where redemption_id = p_redemption_id;

  if v_economics.redemption_id is null then
    return;
  end if;

  v_reasons := v_economics.invalid_reasons;
  v_identity_missing := v_economics.provider_token_account is null
    or v_economics.platform_token_account is null
    or v_economics.mint is null
    or v_economics.program_id is null
    or v_economics.network is null
    or v_economics.budget_pda is null
    or v_economics.vault_pda is null
    or v_economics.authority_wallet is null
    or v_economics.budget_chain_id is null;

  if v_economics.economics_status = 'complete' and not v_identity_missing then
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
    v_economics.budget_id,
    pg_catalog.uuid_send(p_redemption_id),
    case
      when v_economics.economics_status = 'complete' then v_economics.discount_amount
      else null
    end,
    case
      when v_economics.economics_status = 'complete' then v_economics.commission_amount
      else null
    end,
    case
      when v_economics.economics_status = 'complete' then v_economics.provider_reimbursement
      else null
    end,
    v_settlement_status,
    v_last_error
  );
end;
$$;

create or replace function private.exchange_offer(
  p_member_id uuid,
  p_offer_id uuid,
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
  v_location_name text;
  v_partner_name text;
  v_used integer;
  v_balance integer;
  v_budget_id uuid;
  v_budget private.reward_budgets%rowtype;
  v_amounts jsonb;
  v_cover bigint;
  v_available bigint;
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

  select id into v_member
  from public.members
  where id = p_member_id
  for update;

  if v_member is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'not_onboarded');
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

  select locations.name, partners.name
  into v_location_name, v_partner_name
  from public.locations
  join public.partners on partners.id = locations.partner_id
  where locations.id = v_offer.location_id;

  if v_location_name is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'location_unavailable');
  end if;

  select budget_id into v_budget_id
  from private.offer_budgets
  where offer_id = v_offer.id
    and active
  for update;

  if v_budget_id is not null then
    select * into v_budget
    from private.reward_budgets
    where id = v_budget_id
    for update;

    v_amounts := private.derive_settlement_amounts(
      v_offer.list_price_cents,
      v_offer.pay_price_cents,
      v_budget.commission_bps
    );
    v_cover := coalesce((v_amounts ->> 'discount_amount')::bigint, 0);
    if v_cover > 0 then
      v_available := private.budget_available(v_budget_id);
      if v_available < v_cover then
        return pg_catalog.jsonb_build_object('ok', false, 'reason', 'budget_exhausted');
      end if;
    end if;
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

create or replace function private.confirm_till(
  p_member_id uuid,
  p_redemption_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.redemptions%rowtype;
  v_latitude double precision;
  v_longitude double precision;
  v_distance double precision;
begin
  if p_member_id is null or p_redemption_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid_payload');
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

  select * into v_row
  from public.redemptions
  where id = p_redemption_id
    and member_id = p_member_id
  for update;

  if v_row.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_row.till_confirmed_at is not null then
    return private.redemption_result(v_row);
  end if;

  select locations.latitude, locations.longitude
  into v_latitude, v_longitude
  from public.locations
  where locations.id = v_row.location_id
  for update;

  if v_latitude is null or v_longitude is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'location_unavailable');
  end if;

  v_distance := private.metres_between(v_latitude, v_longitude, p_latitude, p_longitude);
  if v_distance > 100 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'outside_geofence');
  end if;

  update public.redemptions
  set till_confirmed_at = pg_catalog.now()
  where id = v_row.id
    and till_confirmed_at is null
  returning * into v_row;

  if v_row.till_confirmed_at is null then
    select * into v_row from public.redemptions where id = p_redemption_id;
    return private.redemption_result(v_row);
  end if;

  perform private.queue_redemption_settlement(v_row.id);
  return private.redemption_result(v_row);
end;
$$;

create or replace function public.exchange_offer(
  p_member_id uuid,
  p_offer_id uuid,
  p_request_id uuid,
  p_commit boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.exchange_offer(p_member_id, p_offer_id, p_request_id, p_commit);
$$;

create or replace function public.confirm_till(
  p_member_id uuid,
  p_redemption_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_request_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.confirm_till(
    p_member_id,
    p_redemption_id,
    p_latitude,
    p_longitude,
    p_request_id
  );
$$;

create or replace function private.admin_add_deposited(p_id uuid, p_amount bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_payload';
  end if;
  update private.reward_budgets
  set recorded_deposited = recorded_deposited + p_amount
  where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

create or replace function public.admin_add_deposited(p_id uuid, p_amount bigint)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_add_deposited(p_id, p_amount);
$$;

create or replace function private.admin_campaign_cover(p_budget_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_deposited bigint;
  v_reserved bigint;
begin
  select recorded_deposited into v_deposited
  from private.reward_budgets
  where id = p_budget_id;
  if v_deposited is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  v_reserved := private.budget_reserved(p_budget_id);
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'deposited', v_deposited,
    'reserved', v_reserved,
    'available', greatest(v_deposited - v_reserved, 0)
  );
end;
$$;

create or replace function public.admin_campaign_cover(p_budget_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_campaign_cover(p_budget_id);
$$;

create or replace function private.admin_list_budget_offers(p_budget_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  status text,
  quantity integer,
  issued_count integer,
  list_price_cents integer,
  pay_price_cents integer,
  points_cost integer,
  location_id uuid,
  partner_name text,
  value_label text,
  collect_start time,
  collect_end time,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    offers.id,
    offers.title,
    offers.description,
    offers.status,
    offers.quantity,
    (
      select count(*)::integer
      from public.redemptions
      where redemptions.offer_id = offers.id
    ) as issued_count,
    offers.list_price_cents,
    offers.pay_price_cents,
    offers.points_cost,
    offers.location_id,
    partners.name as partner_name,
    offers.value_label,
    offers.collect_start,
    offers.collect_end,
    offers.expires_at
  from private.offer_budgets
  join public.offers on offers.id = offer_budgets.offer_id
  join public.locations on locations.id = offers.location_id
  join public.partners on partners.id = locations.partner_id
  where offer_budgets.budget_id = p_budget_id
  order by offers.created_at;
$$;

create or replace function public.admin_list_budget_offers(p_budget_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  status text,
  quantity integer,
  issued_count integer,
  list_price_cents integer,
  pay_price_cents integer,
  points_cost integer,
  location_id uuid,
  partner_name text,
  value_label text,
  collect_start time,
  collect_end time,
  expires_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_budget_offers(p_budget_id);
$$;

create or replace function private.admin_update_campaign_offer(
  p_offer_id uuid,
  p_title text,
  p_description text,
  p_value_label text,
  p_list_price_cents integer,
  p_pay_price_cents integer,
  p_points_cost integer,
  p_quantity integer,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers%rowtype;
  v_budget_id uuid;
  v_budget private.reward_budgets%rowtype;
  v_issued integer;
  v_amounts jsonb;
  v_cover bigint;
  v_available bigint;
  v_remaining integer;
begin
  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;
  if v_offer.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select count(*)::integer into v_issued
  from public.redemptions
  where offer_id = p_offer_id;

  if p_quantity is null or p_quantity < 1 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'quantity_required');
  end if;
  if p_quantity < v_issued then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'quantity_below_issued');
  end if;
  if p_status not in ('active', 'paused') then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;
  if p_list_price_cents is null or p_list_price_cents <= 0
    or p_pay_price_cents is null or p_pay_price_cents < 0
    or p_pay_price_cents > p_list_price_cents
    or p_points_cost is null or p_points_cost <= 0
  then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  select budget_id into v_budget_id
  from private.offer_budgets
  where offer_id = p_offer_id
  for update;

  if v_budget_id is not null and p_status = 'active' then
    select * into v_budget
    from private.reward_budgets
    where id = v_budget_id
    for update;
    v_amounts := private.derive_settlement_amounts(
      p_list_price_cents,
      p_pay_price_cents,
      v_budget.commission_bps
    );
    v_cover := coalesce((v_amounts ->> 'discount_amount')::bigint, 0);
    v_remaining := p_quantity - v_issued;
    v_available := private.budget_available(v_budget_id);
    if v_cover > 0 and v_remaining > 0 and v_available < (v_cover * v_remaining) then
      return pg_catalog.jsonb_build_object('ok', false, 'reason', 'underfunded');
    end if;
  end if;

  update public.offers
  set
    title = p_title,
    description = p_description,
    value_label = p_value_label,
    list_price_cents = p_list_price_cents,
    pay_price_cents = p_pay_price_cents,
    points_cost = p_points_cost,
    quantity = p_quantity,
    status = p_status
  where id = p_offer_id;

  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_update_campaign_offer(
  p_offer_id uuid,
  p_title text,
  p_description text,
  p_value_label text,
  p_list_price_cents integer,
  p_pay_price_cents integer,
  p_points_cost integer,
  p_quantity integer,
  p_status text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_update_campaign_offer(
    p_offer_id,
    p_title,
    p_description,
    p_value_label,
    p_list_price_cents,
    p_pay_price_cents,
    p_points_cost,
    p_quantity,
    p_status
  );
$$;

create or replace function private.admin_insert_campaign_offer(
  p_budget_id uuid,
  p_location_id uuid,
  p_slug text,
  p_title text,
  p_description text,
  p_value_label text,
  p_list_price_cents integer,
  p_pay_price_cents integer,
  p_points_cost integer,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_quantity is null or p_quantity < 1 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'quantity_required');
  end if;
  insert into public.offers (
    location_id,
    slug,
    title,
    description,
    value_label,
    points_cost,
    list_price_cents,
    pay_price_cents,
    quantity,
    status
  ) values (
    p_location_id,
    p_slug,
    p_title,
    p_description,
    p_value_label,
    p_points_cost,
    p_list_price_cents,
    p_pay_price_cents,
    p_quantity,
    'paused'
  )
  returning id into v_id;
  insert into private.offer_budgets (offer_id, budget_id, active)
  values (v_id, p_budget_id, true);
  return pg_catalog.jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.admin_insert_campaign_offer(
  p_budget_id uuid,
  p_location_id uuid,
  p_slug text,
  p_title text,
  p_description text,
  p_value_label text,
  p_list_price_cents integer,
  p_pay_price_cents integer,
  p_points_cost integer,
  p_quantity integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_insert_campaign_offer(
    p_budget_id,
    p_location_id,
    p_slug,
    p_title,
    p_description,
    p_value_label,
    p_list_price_cents,
    p_pay_price_cents,
    p_points_cost,
    p_quantity
  );
$$;

revoke all on function private.budget_reserved(uuid) from public, anon, authenticated;
revoke all on function private.budget_available(uuid) from public, anon, authenticated;
revoke all on function private.queue_redemption_settlement(uuid) from public, anon, authenticated, service_role;
revoke all on function private.exchange_offer(uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function private.confirm_till(uuid, uuid, double precision, double precision, uuid) from public, anon, authenticated;
revoke all on function public.exchange_offer(uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.confirm_till(uuid, uuid, double precision, double precision, uuid) from public, anon, authenticated;
revoke all on function private.admin_add_deposited(uuid, bigint) from public, anon, authenticated;
revoke all on function public.admin_add_deposited(uuid, bigint) from public, anon, authenticated;
revoke all on function private.admin_campaign_cover(uuid) from public, anon, authenticated;
revoke all on function public.admin_campaign_cover(uuid) from public, anon, authenticated;
revoke all on function private.admin_list_budget_offers(uuid) from public, anon, authenticated;
revoke all on function public.admin_list_budget_offers(uuid) from public, anon, authenticated;
revoke all on function private.admin_update_campaign_offer(uuid, text, text, text, integer, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.admin_update_campaign_offer(uuid, text, text, text, integer, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function private.admin_insert_campaign_offer(uuid, uuid, text, text, text, text, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_insert_campaign_offer(uuid, uuid, text, text, text, text, integer, integer, integer, integer) from public, anon, authenticated;

grant execute on function private.queue_redemption_settlement(uuid) to service_role;
grant execute on function private.exchange_offer(uuid, uuid, uuid, boolean) to service_role;
grant execute on function private.confirm_till(uuid, uuid, double precision, double precision, uuid) to service_role;
grant execute on function public.exchange_offer(uuid, uuid, uuid, boolean) to service_role;
grant execute on function public.confirm_till(uuid, uuid, double precision, double precision, uuid) to service_role;
grant execute on function private.admin_add_deposited(uuid, bigint) to service_role;
grant execute on function public.admin_add_deposited(uuid, bigint) to service_role;
grant execute on function private.admin_campaign_cover(uuid) to service_role;
grant execute on function public.admin_campaign_cover(uuid) to service_role;
grant execute on function private.admin_list_budget_offers(uuid) to service_role;
grant execute on function public.admin_list_budget_offers(uuid) to service_role;
grant execute on function private.admin_update_campaign_offer(uuid, text, text, text, integer, integer, integer, integer, text) to service_role;
grant execute on function public.admin_update_campaign_offer(uuid, text, text, text, integer, integer, integer, integer, text) to service_role;
grant execute on function private.admin_insert_campaign_offer(uuid, uuid, text, text, text, text, integer, integer, integer, integer) to service_role;
grant execute on function public.admin_insert_campaign_offer(uuid, uuid, text, text, text, text, integer, integer, integer, integer) to service_role;
