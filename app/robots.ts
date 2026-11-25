import type { MetadataRoute } from "next";

import { absoluteUrl, allowIndexing } from "@/lib/site-url";

// Only the live shop (ALLOW_INDEXING=true) is open to search engines. Private and
// transactional pages are never crawled.
export default function robots(): MetadataRoute.Robots {
  if (!allowIndexing) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/account", "/bag", "/checkout", "/orders", "/search", "/dev/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
