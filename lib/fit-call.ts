import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/en";

// Fit calls for custom-fit orders: a short video call with the tailor before production, booked
// on Cal.com (CALCOM_FIT_CALL_URL). Without the URL, emails and pages say we'll be in touch.

/** Days after payment before the "book your fit call" reminder goes out (once). */
export const FIT_CALL_REMINDER_DAYS = 2;
/** No reminders for orders older than this, so an old order never gets a surprise email. */
export const FIT_CALL_REMINDER_MAX_DAYS = 14;

/** The booking page, if set: an https address such as https://cal.com/virasat/fit-call. */
export function fitCallBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = env.CALCOM_FIT_CALL_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * The booking link for an order, with the customer's name, email and the order number filled in
 * (Cal.com reads name, email and notes from the address, and keeps metadata[...] on the booking).
 */
export function fitCallUrl(
  base: string | null,
  order: { number: string; customerName: string; email: string },
): string | null {
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set("name", order.customerName);
  url.searchParams.set("email", order.email);
  url.searchParams.set("notes", en.fitCall.bookingNotes(order.number));
  url.searchParams.set("metadata[order]", order.number);
  return url.toString();
}

/** A custom-fit order waits for its fit call while it's paid and not yet booked. */
export function needsFitCall(order: {
  status: OrderStatus;
  hasCustomItems: boolean;
  fitCallBookedAt: Date | null;
}): boolean {
  return order.hasCustomItems && order.status === "paid" && order.fitCallBookedAt === null;
}
