// Delivery estimates. Production and shipping are counted in business days (Mon–Fri).
// The range is deliberately cautious: promising late and arriving early builds trust, and US
// rules require telling customers (and offering a refund) if we miss a promised date.

export const SHIPPING_BUSINESS_DAYS = { min: 4, max: 7 } as const;
export const BUFFER_BUSINESS_DAYS = 1;

export type DayRange = { min: number; max: number };

/** Total business days from order to delivery for a piece that takes `productionDays`. */
export function deliveryDayRange(productionDays: number): DayRange {
  if (!Number.isInteger(productionDays) || productionDays < 0) {
    throw new RangeError(`Production days must be a whole number ≥ 0, got ${productionDays}`);
  }
  return {
    min: productionDays + SHIPPING_BUSINESS_DAYS.min,
    max: productionDays + SHIPPING_BUSINESS_DAYS.max + BUFFER_BUSINESS_DAYS,
  };
}

/** Adds business days to a date, skipping Saturdays and Sundays. Uses the date's local calendar. */
export function addBusinessDays(start: Date, days: number): Date {
  const date = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const weekday = date.getDay();
    if (weekday !== 0 && weekday !== 6) added += 1;
  }
  return date;
}

export function deliveryWindow(
  orderDate: Date,
  productionDays: number,
): { earliest: Date; latest: Date } {
  const range = deliveryDayRange(productionDays);
  return {
    earliest: addBusinessDays(orderDate, range.min),
    latest: addBusinessDays(orderDate, range.max),
  };
}
