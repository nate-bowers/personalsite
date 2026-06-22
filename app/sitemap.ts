import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://natebowers.dev";

// The publicly visible routes. /ask is intentionally omitted (hidden + unbuilt).
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/about", "/projects", "/resume", "/contact", "/about-the-site"];
  return paths.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
