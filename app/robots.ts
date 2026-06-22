import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://natebowers.dev";

// Allow crawling everything except /ask — the Ask station is hidden from nav
// (lib/visibility.ts SHOW_ASK=false) and unbuilt, so we don't want it indexed yet.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/ask" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
