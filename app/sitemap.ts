import type { MetadataRoute } from "next";
import { getSitemapProducts } from "@/lib/data/catalog";
import { getSiteUrl } from "@/lib/env";
import { locales, localeTags } from "@/lib/i18n/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const products = await getSitemapProducts().catch(() => []);

  const entry = (path: string, lastModified?: string, priority?: number): MetadataRoute.Sitemap => [
    {
      url: `${site}/hy${path}`,
      lastModified,
      priority,
      alternates: {
        languages: Object.fromEntries(locales.map((locale) => [localeTags[locale], `${site}/${locale}${path}`])),
      },
    },
  ];

  return [
    ...entry("", undefined, 1),
    ...entry("/products", undefined, 0.8),
    ...products.flatMap((product) => entry(`/products/${product.slug}`, product.updated_at, 0.7)),
  ];
}
