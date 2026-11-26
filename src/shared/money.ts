/** How platform units read as money, as `/me` says it. */
export type Money = { readonly currency: string; readonly unitsPerMinor: number };
/** How the platform's units read as money: dollars, at the worth `/me` states. */
export const dollars = (unitsPerDollar: number): Money => ({ currency: "USD", unitsPerMinor: unitsPerDollar / 100 });

/** Two decimals, as money reads — except under one whole unit of the currency, where a price per native unit needs the smaller places. */
export function formatMoney(units: number, money: Money, language: string): string {
  const major = units / money.unitsPerMinor / 100;
  const places = Math.abs(major) >= 1 ? 2 : Math.abs(major) >= 0.01 ? 4 : 6;
  return new Intl.NumberFormat(language, { style: "currency", currency: money.currency, minimumFractionDigits: 2, maximumFractionDigits: places }).format(major);
}
