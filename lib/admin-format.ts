// Dates in the admin are shown in India time: the team works from India, while the server
// runs on UTC. (Customer-facing dates stay in US formats.)

export const ADMIN_TIME_ZONE = "Asia/Kolkata";

const dateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: ADMIN_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

const dateOnly = new Intl.DateTimeFormat("en-IN", {
  timeZone: ADMIN_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "26 Nov 2026, 9:05 pm IST" */
export function formatAdminDateTime(date: Date): string {
  return dateTime.format(date);
}

/** "26 Nov 2026" */
export function formatAdminDate(date: Date): string {
  return dateOnly.format(date);
}
