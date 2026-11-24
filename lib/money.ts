// Money is always stored and calculated as integer cents. Never use floats for money.

export type Currency = "USD";

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: Currency, locale: string): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Throws unless the value is a whole number of cents (no fractions, NaN or Infinity). */
export function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Money must be a whole number of cents, got ${cents}`);
  }
}

/** formatCents(24900) → "$249.00" */
export function formatCents(cents: number, currency: Currency = "USD", locale = "en-US"): string {
  assertCents(cents);
  return formatterFor(currency, locale).format(cents / 100);
}

/** Line total for a quantity of items, in cents. */
export function lineTotalCents(unitPriceCents: number, quantity: number): number {
  assertCents(unitPriceCents);
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new RangeError(`Quantity must be a whole number of at least 1, got ${quantity}`);
  }
  return unitPriceCents * quantity;
}
