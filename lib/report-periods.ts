import { ADMIN_TIME_ZONE } from "@/lib/admin-format";

// Where "today", "this week" and "this month" start for the admin dashboard, in the admin's
// time zone (India). Weeks start on Monday. Pure, so it is unit-tested.

/** A time zone's offset from UTC at an instant, in minutes (India → 330). */
export function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0; // "GMT" alone means UTC
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

export type ReportPeriods = { today: Date; week: Date; month: Date };

/** The instants (UTC) at which today, this week (Monday) and this month began locally. */
export function periodStarts(now: Date, timeZone: string = ADMIN_TIME_ZONE): ReportPeriods {
  const offsetMs = timeZoneOffsetMinutes(now, timeZone) * 60_000;
  // Shift the clock so the UTC getters read the local date.
  const local = new Date(now.getTime() + offsetMs);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const localMidnight = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) - offsetMs);
  return {
    today: localMidnight(year, month, day),
    week: localMidnight(year, month, day - daysSinceMonday),
    month: localMidnight(year, month, 1),
  };
}
