export function formatMinorEuro(amount: string | number | bigint | null | undefined) {
  if (amount == null || amount === '') {
    return '—';
  }
  const cents = BigInt(amount) / 10_000n;
  return `€${(cents / 100n).toString()}.${(cents % 100n).toString().padStart(2, '0')}`;
}

export function parseEuroToCents(value: string) {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    return null;
  }
  const euros = Number(match[1]);
  const cents = match[2] ? Number(match[2].padEnd(2, '0')) : 0;
  return euros * 100 + cents;
}

export function parsePercent(value: string) {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    return null;
  }
  const whole = Number(match[1]);
  const fraction = match[2] ? Number(match[2].padEnd(2, '0')) : 0;
  const percent = whole + fraction / 100;
  return percent >= 0 && percent <= 100 ? percent : null;
}

function formatPercent(percent: number) {
  if (Number.isInteger(percent)) {
    return String(percent);
  }
  return (Math.round(percent * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
}

/** 400 Brew Points = €4.50. */
const ANCHOR_POINTS = 400;
const ANCHOR_CENTS = 450;

export function discountCentsFromPercent(listCents: number, discountPercent: number) {
  return Math.round((listCents * discountPercent) / 100);
}

export function brewPointsFromDiscountCents(discountCents: number) {
  return Math.max(1, Math.round((discountCents * ANCHOR_POINTS) / ANCHOR_CENTS));
}

export function discountPercentFromPrices(listCents: number, payCents: number) {
  if (listCents <= 0) {
    return '';
  }
  return formatPercent(((listCents - payCents) * 100) / listCents);
}

export function campaignValueLabel(listCents: number, discountPercent: number) {
  return `${formatPercent(discountPercent)}% off a ${(listCents / 100).toFixed(2)} coffee`;
}

export function campaignFromCoffeeAndDiscount(listCents: number, discountPercent: number) {
  const discountCents = discountCentsFromPercent(listCents, discountPercent);
  return {
    discountCents,
    payCents: listCents - discountCents,
    pointsCost: brewPointsFromDiscountCents(discountCents),
    valueLabel: campaignValueLabel(listCents, discountPercent),
  };
}

export function settlementPreview(listCents: number, payCents: number, commissionBps: number) {
  const original = BigInt(listCents) * 10_000n;
  const discounted = BigInt(payCents) * 10_000n;
  const discount = original - discounted;
  const commission = (discounted * BigInt(commissionBps)) / 10_000n;
  const provider = discount - commission;
  return { commission, discount, discounted, original, provider };
}
