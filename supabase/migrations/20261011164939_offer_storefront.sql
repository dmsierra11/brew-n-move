-- Storefront details for the rewards list and offer screen.
-- Coordinates stay off the catalog. Address is the public place line.

alter table public.locations
  add column address text;

alter table public.locations
  add constraint locations_address_present check (
    address is null or char_length(pg_catalog.btrim(address)) > 0
  );

comment on column public.locations.address is
  'Street address shown on the offer. The app uses the location name when this is null.';

grant select (address) on public.locations to anon, authenticated;

alter table public.offers
  add column description text,
  add column list_price_cents integer,
  add column pay_price_cents integer,
  add column collect_start time,
  add column collect_end time,
  add column image_url text;

update public.offers
set
  description = title,
  list_price_cents = 450,
  pay_price_cents = 0
where description is null
  or list_price_cents is null
  or pay_price_cents is null;

update public.offers
set
  description = 'A specialty flat white from the espresso bar, made when you redeem at the counter.',
  list_price_cents = 450,
  pay_price_cents = 0
where slug = 'brew-lab-flat-white';

update public.offers
set
  description = 'A coffee paired with a pastry from the counter.',
  list_price_cents = 750,
  pay_price_cents = 350,
  collect_start = time '16:00',
  collect_end = time '18:00'
where slug = 'canal-coffee-pastry';

update public.offers
set
  description = 'The lunch special from the café, redeemed at the counter.',
  list_price_cents = 1250,
  pay_price_cents = 750
where slug = 'oak-and-bean-lunch';

update public.locations
set address = '49 Pearse Street, Dublin 2'
where id = 'a1111111-1111-4111-8111-111111111111';

update public.locations
set address = '18 Richmond Street South, Dublin 8'
where id = 'a2222222-2222-4222-8222-222222222222';

update public.locations
set address = '8 Smithfield Square, Dublin 7'
where id = 'a3333333-3333-4333-8333-333333333333';

alter table public.offers
  alter column description set not null,
  alter column list_price_cents set not null,
  alter column pay_price_cents set not null;

alter table public.offers
  add constraint offers_description_present check (char_length(pg_catalog.btrim(description)) > 0),
  add constraint offers_list_price_positive check (list_price_cents > 0),
  add constraint offers_pay_price_nonnegative check (pay_price_cents >= 0),
  add constraint offers_pay_within_list check (pay_price_cents <= list_price_cents),
  add constraint offers_collect_window check (
    (collect_start is null and collect_end is null)
    or (
      collect_start is not null
      and collect_end is not null
      and collect_start < collect_end
    )
  ),
  add constraint offers_image_url_present check (
    image_url is null or char_length(pg_catalog.btrim(image_url)) > 0
  );

comment on column public.offers.list_price_cents is
  'Café price in euro cents before the Brew Points discount.';

comment on column public.offers.pay_price_cents is
  'Price in euro cents paid at the till after the Brew Points discount. Zero means the item is free.';

comment on column public.offers.collect_start is
  'Optional daily collect window start. Null when the offer has no collect time.';

comment on column public.offers.image_url is
  'Optional partner photo. The app draws the offer illustration when this is null.';

drop view public.catalog_offers;

create view public.catalog_offers
with (security_invoker = true) as
select
  offers.id,
  offers.slug,
  partners.name as partner_name,
  locations.name as location_name,
  offers.title,
  offers.value_label,
  offers.points_cost,
  locations.address as location_address,
  offers.description,
  offers.list_price_cents,
  offers.pay_price_cents,
  offers.collect_start,
  offers.collect_end,
  offers.image_url
from public.offers
join public.locations on locations.id = offers.location_id
join public.partners on partners.id = locations.partner_id;

revoke all on public.catalog_offers from anon, authenticated;
grant select on public.catalog_offers to anon, authenticated;
