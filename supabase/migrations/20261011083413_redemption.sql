-- In-person redemption. Brew Points in member_balances are spendable while the
-- Solana row stays blocked. This migration does not submit a chain transaction.

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint partners_name_present check (char_length(pg_catalog.btrim(name)) > 0)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id),
  name text not null,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default pg_catalog.now(),
  constraint locations_name_present check (char_length(pg_catalog.btrim(name)) > 0),
  constraint locations_coordinates check (
    (latitude is null and longitude is null)
    or (
      latitude is not null
      and longitude is not null
      and latitude >= -90
      and latitude <= 90
      and longitude >= -180
      and longitude <= 180
    )
  )
);

create index locations_partner on public.locations (partner_id);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id),
  slug text not null,
  title text not null,
  value_label text not null,
  points_cost integer not null,
  quantity integer,
  expires_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default pg_catalog.now(),
  constraint offers_slug_present check (char_length(pg_catalog.btrim(slug)) > 0),
  constraint offers_title_present check (char_length(pg_catalog.btrim(title)) > 0),
  constraint offers_value_present check (char_length(pg_catalog.btrim(value_label)) > 0),
  constraint offers_points_positive check (points_cost > 0),
  constraint offers_quantity_positive check (quantity is null or quantity > 0),
  constraint offers_status check (status in ('active', 'paused', 'removed')),
  unique (slug)
);

create index offers_location on public.offers (location_id);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  partner_id uuid not null references public.partners (id),
  location_id uuid not null references public.locations (id),
  offer_id uuid not null references public.offers (id),
  partner_name text not null,
  location_name text not null,
  offer_title text not null,
  points_spent integer not null,
  value_label text not null,
  redeemed_at timestamptz not null default pg_catalog.now(),
  client_request_id uuid not null,
  constraint redemptions_partner_name_present check (char_length(pg_catalog.btrim(partner_name)) > 0),
  constraint redemptions_location_name_present check (char_length(pg_catalog.btrim(location_name)) > 0),
  constraint redemptions_title_present check (char_length(pg_catalog.btrim(offer_title)) > 0),
  constraint redemptions_points_positive check (points_spent > 0),
  constraint redemptions_value_present check (char_length(pg_catalog.btrim(value_label)) > 0),
  unique (member_id, client_request_id)
);

create index redemptions_member on public.redemptions (member_id);
create index redemptions_offer on public.redemptions (offer_id);

create table private.point_redemptions (
  id uuid primary key default gen_random_uuid(),
  redemption_id uuid not null references public.redemptions (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  offer_id uuid not null references public.offers (id),
  points integer not null,
  solana_status text not null default 'blocked',
  created_at timestamptz not null default pg_catalog.now(),
  constraint point_redemptions_points_positive check (points > 0),
  constraint point_redemptions_solana_status check (solana_status in ('blocked', 'submitted')),
  unique (redemption_id)
);

comment on column private.point_redemptions.solana_status is
  'blocked means no devnet submission has run. submitted is reserved for a later retry of this same row. This status is not an on-chain recording.';

comment on column public.locations.latitude is
  'Stored on the location. Withheld from Data API roles so the catalog does not expose coordinates.';

create index point_redemptions_blocked
  on private.point_redemptions (created_at)
  where solana_status = 'blocked';

alter table public.partners enable row level security;
alter table public.locations enable row level security;
alter table public.offers enable row level security;
alter table public.redemptions enable row level security;
alter table private.point_redemptions enable row level security;

revoke all on public.partners from anon, authenticated;
grant select on public.partners to anon, authenticated;
revoke all on public.locations from anon, authenticated;
grant select (id, partner_id, name, created_at) on public.locations to anon, authenticated;
revoke all on public.offers from anon, authenticated;
grant select on public.offers to anon, authenticated;
revoke all on public.redemptions from anon, authenticated;
grant select on public.redemptions to authenticated;
revoke all on private.point_redemptions from public, anon, authenticated;

create policy partners_select on public.partners
  for select to anon, authenticated
  using (true);

create policy locations_select on public.locations
  for select to anon, authenticated
  using (true);

create policy offers_select_available on public.offers
  for select to anon, authenticated
  using (
    status = 'active'
    and (expires_at is null or expires_at > pg_catalog.now())
  );

create policy redemptions_select_own on public.redemptions
  for select to authenticated
  using (member_id = (select auth.uid()));

create view public.catalog_offers
with (security_invoker = true) as
select
  offers.id,
  offers.slug,
  partners.name as partner_name,
  locations.name as location_name,
  offers.title,
  offers.value_label,
  offers.points_cost
from public.offers
join public.locations on locations.id = offers.location_id
join public.partners on partners.id = locations.partner_id;

revoke all on public.catalog_offers from anon, authenticated;
grant select on public.catalog_offers to anon, authenticated;

create or replace function private.metres_between(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 6371000 * 2 * pg_catalog.asin(pg_catalog.sqrt(
    case
      when a > 1 then 1
      when a < 0 then 0
      else a
    end
  ))
  from (
    select
      pg_catalog.power(pg_catalog.sin(pg_catalog.radians(p_lat2 - p_lat1) / 2), 2)
      + pg_catalog.cos(pg_catalog.radians(p_lat1))
        * pg_catalog.cos(pg_catalog.radians(p_lat2))
        * pg_catalog.power(pg_catalog.sin(pg_catalog.radians(p_lng2 - p_lng1) / 2), 2)
      as a
  ) as haversine;
$$;

create or replace function private.redemption_result(p_row public.redemptions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'ok', true,
    'reason', 'redeemed',
    'redemption_id', p_row.id,
    'offer_id', p_row.offer_id,
    'partner', p_row.partner_name,
    'location', p_row.location_name,
    'title', p_row.offer_title,
    'value_label', p_row.value_label,
    'points_spent', p_row.points_spent,
    'redeemed_at', p_row.redeemed_at,
    'balance', coalesce((
      select balance
      from public.member_balances
      where member_id = p_row.member_id
    ), 0)
  );
$$;

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

create or replace function public.redeem_offer(
  p_member_id uuid,
  p_offer_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_request_id uuid,
  p_commit boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.redeem_offer(
    p_member_id,
    p_offer_id,
    p_latitude,
    p_longitude,
    p_request_id,
    p_commit
  );
$$;

revoke all on function private.metres_between(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function private.redemption_result(public.redemptions) from public, anon, authenticated;
revoke all on function private.redeem_offer(uuid, uuid, double precision, double precision, uuid, boolean) from public, anon, authenticated;
revoke all on function public.redeem_offer(uuid, uuid, double precision, double precision, uuid, boolean) from public, anon, authenticated;

grant execute on function private.metres_between(double precision, double precision, double precision, double precision) to service_role;
grant execute on function private.redeem_offer(uuid, uuid, double precision, double precision, uuid, boolean) to service_role;
grant execute on function public.redeem_offer(uuid, uuid, double precision, double precision, uuid, boolean) to service_role;

insert into public.partners (id, name)
values
  ('11111111-1111-4111-8111-111111111111', 'Brew Lab'),
  ('22222222-2222-4222-8222-222222222222', 'Canal Coffee'),
  ('33333333-3333-4333-8333-333333333333', 'Oak & Bean');

insert into public.locations (id, partner_id, name)
values
  ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Pearse Street'),
  ('a2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'Portobello'),
  ('a3333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', 'Smithfield');

insert into public.offers (id, location_id, slug, title, value_label, points_cost)
values
  (
    'b1111111-1111-4111-8111-111111111111',
    'a1111111-1111-4111-8111-111111111111',
    'brew-lab-flat-white',
    'Flat white',
    'Free coffee',
    200
  ),
  (
    'b2222222-2222-4222-8222-222222222222',
    'a2222222-2222-4222-8222-222222222222',
    'canal-coffee-pastry',
    'Coffee and pastry',
    '€4 off',
    260
  ),
  (
    'b3333333-3333-4333-8333-333333333333',
    'a3333333-3333-4333-8333-333333333333',
    'oak-and-bean-lunch',
    'Lunch special',
    '€5 off',
    340
  );
