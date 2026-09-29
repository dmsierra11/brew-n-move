const irelandNumberFormat = new Intl.NumberFormat('en-IE');

export function formatNumber(value: number) {
  return irelandNumberFormat.format(value);
}
