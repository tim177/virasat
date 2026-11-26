import { en } from "@/lib/i18n/en";

// Couriers the admin can pick when marking an order as shipped, and their tracking pages.

export const COURIER_IDS = ["dhl", "fedex", "ups", "other"] as const;
export type CourierId = (typeof COURIER_IDS)[number];

const trackingPages: Record<CourierId, ((number: string) => string) | null> = {
  dhl: (n) =>
    `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${n}`,
  fedex: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  ups: (n) => `https://www.ups.com/track?tracknum=${n}`,
  other: null,
};

function isCourierId(value: string): value is CourierId {
  return (COURIER_IDS as readonly string[]).includes(value);
}

/** The courier's display name ("DHL Express"); unknown values are shown as saved. */
export function courierName(courier: string): string {
  return isCourierId(courier) ? en.couriers[courier] : courier;
}

/** The courier's public tracking page for a parcel, or null when we don't know it. */
export function trackingUrl(courier: string, trackingNumber: string): string | null {
  if (!isCourierId(courier)) return null;
  const page = trackingPages[courier];
  return page ? page(encodeURIComponent(trackingNumber.trim())) : null;
}
