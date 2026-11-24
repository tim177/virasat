// What Sentry is allowed to collect (shared by the server and browser setup).
// Customers' names, emails, addresses, measurements and private order links must never reach
// Sentry, so we switch off user info, cookies, bodies and query strings, and only keep a few
// harmless headers that help with debugging.
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: { allow: ["user-agent", "referer", "accept-language"] },
  httpBodies: [],
  urlQueryParams: false,
};
