-- Replace pg_catalog.isfinite, which is not callable with an empty search_path.

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
