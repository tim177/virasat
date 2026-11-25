// Public address of the shop, used for canonical links, the sitemap and structured data.
// Set SITE_URL on the server (e.g. https://www.example.com). Defaults to local development.
export const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Only the live shop should be indexed by search engines; staging and local stay hidden. */
export const allowIndexing = process.env.ALLOW_INDEXING === "true";
