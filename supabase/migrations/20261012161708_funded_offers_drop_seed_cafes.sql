-- Remove leftover seed cafés. Rewards lists active, unexpired offers only.
-- 3fe Demo Café stays. Admin create already writes offer_budgets with the offer.

delete from private.settlements
where redemption_id in (
  select id
  from public.redemptions
  where offer_id in (
    'b1111111-1111-4111-8111-111111111111',
    'b2222222-2222-4222-8222-222222222222',
    'b3333333-3333-4333-8333-333333333333'
  )
);

delete from private.redemption_economics
where redemption_id in (
  select id
  from public.redemptions
  where offer_id in (
    'b1111111-1111-4111-8111-111111111111',
    'b2222222-2222-4222-8222-222222222222',
    'b3333333-3333-4333-8333-333333333333'
  )
);

delete from private.point_redemptions
where offer_id in (
  'b1111111-1111-4111-8111-111111111111',
  'b2222222-2222-4222-8222-222222222222',
  'b3333333-3333-4333-8333-333333333333'
);

delete from public.redemptions
where offer_id in (
  'b1111111-1111-4111-8111-111111111111',
  'b2222222-2222-4222-8222-222222222222',
  'b3333333-3333-4333-8333-333333333333'
);

delete from private.offer_budgets
where offer_id in (
  'b1111111-1111-4111-8111-111111111111',
  'b2222222-2222-4222-8222-222222222222',
  'b3333333-3333-4333-8333-333333333333'
);

delete from public.offers
where id in (
  'b1111111-1111-4111-8111-111111111111',
  'b2222222-2222-4222-8222-222222222222',
  'b3333333-3333-4333-8333-333333333333'
);

delete from public.locations
where id in (
  'a1111111-1111-4111-8111-111111111111',
  'a2222222-2222-4222-8222-222222222222',
  'a3333333-3333-4333-8333-333333333333'
);

delete from public.partners
where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);

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
join public.partners on partners.id = locations.partner_id
where offers.status = 'active'
  and (offers.expires_at is null or offers.expires_at > pg_catalog.now());

revoke all on public.catalog_offers from anon, authenticated;
grant select on public.catalog_offers to anon, authenticated;
