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

/**
 * Plain decimal string for machine-readable prices (structured data, Stripe metadata),
 * built from integer cents without any floating-point maths: 24900 → "249.00".
 */
export function centsToDecimalString(cents: number): string {
  assertCents(cents);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * A dollar amount typed by a person, as cents, without floating-point maths:
 * "249" → 24900, "249.5" → 24950, "$1,249.00" → 124900. Null if it isn't a valid amount.
 */
export function parseDollars(text: string): number | null {
  const clean = text.trim().replace(/^\$/, "").replaceAll(",", "");
  const match = clean.match(/^(\d{1,7})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** Line total for a quantity of items, in cents. */
export function lineTotalCents(unitPriceCents: number, quantity: number): number {
  assertCents(unitPriceCents);
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new RangeError(`Quantity must be a whole number of at least 1, got ${quantity}`);
  }
  return unitPriceCents * quantity;
}
