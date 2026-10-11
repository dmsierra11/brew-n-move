const irelandNumberFormat = new Intl.NumberFormat('en-IE');
const euroFormat = new Intl.NumberFormat('en-IE', {
  currency: 'EUR',
  style: 'currency',
});

export function formatNumber(value: number) {
  return irelandNumberFormat.format(value);
}

export function formatEuro(cents: number) {
  return euroFormat.format(cents / 100);
}
