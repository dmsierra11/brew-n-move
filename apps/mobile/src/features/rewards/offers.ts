import type { IllustrationKind } from '../../components/OfferIllustration';
import { supabase } from '../auth/supabase';

export type Offer = {
  id: string;
  slug: string;
  partner: string;
  location: string;
  address: string;
  title: string;
  description: string;
  value: string;
  points: number;
  listPriceCents: number;
  payPriceCents: number;
  collectLabel: string | null;
  imageUrl: string | null;
  accent: string;
  illustration: IllustrationKind;
};

const presentation: Record<string, { accent: string; illustration: IllustrationKind }> = {
  'brew-lab-flat-white': { accent: '#D9E8DF', illustration: 'flat-white' },
  'canal-coffee-pastry': { accent: '#E9DDC7', illustration: 'coffee-pastry' },
  'oak-and-bean-lunch': { accent: '#DAD8C7', illustration: 'lunch' },
};

const catalogColumns =
  'id, slug, partner_name, location_name, title, value_label, points_cost, location_address, description, list_price_cents, pay_price_cents, collect_start, collect_end, image_url';

type CatalogOfferRow = {
  collect_end: string | null;
  collect_start: string | null;
  description: string;
  id: string;
  image_url: string | null;
  list_price_cents: number;
  location_address: string | null;
  location_name: string;
  partner_name: string;
  pay_price_cents: number;
  points_cost: number;
  slug: string;
  title: string;
  value_label: string;
};

function look(slug: string) {
  return presentation[slug] ?? { accent: '#D9E8DF', illustration: 'flat-white' as const };
}

function formatClock(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    return value;
  }

  return `${match[1]}:${match[2]}`;
}

function collectLabel(start: string | null, end: string | null) {
  if (!start || !end) {
    return null;
  }

  return `Collect: ${formatClock(start)} - ${formatClock(end)}`;
}

export function mapCatalogOffer(row: CatalogOfferRow): Offer {
  const visual = look(row.slug);
  const address = row.location_address?.trim();

  return {
    accent: visual.accent,
    address: address ? address : row.location_name,
    collectLabel: collectLabel(row.collect_start, row.collect_end),
    description: row.description,
    id: row.id,
    illustration: visual.illustration,
    imageUrl: row.image_url,
    listPriceCents: row.list_price_cents,
    location: row.location_name,
    partner: row.partner_name,
    payPriceCents: row.pay_price_cents,
    points: row.points_cost,
    slug: row.slug,
    title: row.title,
    value: row.value_label,
  };
}

export async function loadOffers() {
  const { data, error } = await supabase
    .from('catalog_offers')
    .select(catalogColumns)
    .order('partner_name')
    .order('title');

  if (error || !data) {
    return null;
  }

  return data.map(mapCatalogOffer);
}

export async function loadOffer(id: string) {
  const { data, error } = await supabase
    .from('catalog_offers')
    .select(catalogColumns)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapCatalogOffer(data);
}
