// Public (browser-safe) configuration. Only NEXT_PUBLIC_* values belong here.
// Server-only secrets live in lib/env.server.ts.

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function getPublicSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export const PRODUCT_IMAGE_BUCKET = "product-images";

/** Public URL for an object in the product image bucket. */
export function productImageUrl(storagePath: string): string | null {
  const config = getPublicSupabaseConfig();
  if (!config) return null;
  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${config.url}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${encoded}`;
}
