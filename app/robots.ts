import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/*/cart", "/*/checkout", "/*/order/"],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
  };
}
