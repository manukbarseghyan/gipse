import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database";

// Public catalog reads. Cached with `use cache` and tagged so admin mutations
// can expire them instantly via updateTag(CATALOG_TAG). The short "minutes"
// lifetime is a safety net in case an invalidation is ever missed.

export const CATALOG_TAG = "catalog";
export const SETTINGS_TAG = "shop-settings";
export const PAGE_SIZE = 12;

export type Category = Pick<Tables<"categories">, "id" | "slug" | "name_hy" | "name_ru" | "name_en" | "sort_order">;

export type CatalogProduct = Pick<
  Tables<"products">,
  | "id"
  | "slug"
  | "name_hy"
  | "name_ru"
  | "name_en"
  | "description_hy"
  | "description_ru"
  | "description_en"
  | "price_amd"
  | "category_id"
  | "is_available"
  | "stock_quantity"
  | "is_featured"
  | "created_at"
  | "updated_at"
> & {
  images: string[];
  category: Pick<Category, "slug" | "name_hy" | "name_ru" | "name_en"> | null;
};

export type ShopSettings = Omit<Tables<"shop_settings">, "id" | "updated_at">;

export type SortOption = "newest" | "price_asc" | "price_desc";

export class CatalogQueryError extends Error {
  constructor(context: string, cause?: { message: string; code?: string }) {
    super(`Catalog query failed: ${context}${cause ? ` (${cause.code ?? "unknown"}: ${cause.message})` : ""}`, { cause });
    this.name = "CatalogQueryError";
    // Next.js may drop the message when the error crosses a "use cache"
    // boundary, so log the PostgREST reason here (no secrets or customer data).
    console.error(`[catalog] ${context} query failed:`, cause?.code ?? "unknown", cause?.message ?? "");
  }
}

const PRODUCT_SELECT =
  "id, slug, name_hy, name_ru, name_en, description_hy, description_ru, description_en, price_amd, category_id, is_available, stock_quantity, is_featured, created_at, updated_at, product_images(storage_path, sort_order), categories(slug, name_hy, name_ru, name_en)";

type ProductRow = Omit<CatalogProduct, "images" | "category"> & {
  product_images: { storage_path: string; sort_order: number }[] | null;
  categories: CatalogProduct["category"];
};

function toCatalogProduct(row: ProductRow): CatalogProduct {
  const { product_images, categories, ...rest } = row;
  const images = [...(product_images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => image.storage_path);
  return { ...rest, images, category: categories ?? null };
}

function cacheCatalog() {
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheCatalog();
  const db = createPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("categories")
    .select("id, slug, name_hy, name_ru, name_en, sort_order")
    .order("sort_order")
    .order("name_hy");
  if (error) throw new CatalogQueryError("categories", error);
  return data;
}

const DEFAULT_SETTINGS: ShopSettings = {
  delivery_fee_amd: 0,
  free_delivery_threshold_amd: null,
  contact_phone: null,
  contact_email: null,
  instagram_url: "https://www.instagram.com/gipse___/",
  facebook_url: null,
  pickup_location_hy: null,
  pickup_location_ru: null,
  pickup_location_en: null,
};

export async function getShopSettings(): Promise<ShopSettings> {
  "use cache";
  cacheLife("minutes");
  cacheTag(SETTINGS_TAG);
  const db = createPublicClient();
  if (!db) return DEFAULT_SETTINGS;
  const { data, error } = await db
    .from("shop_settings")
    .select(
      "delivery_fee_amd, free_delivery_threshold_amd, contact_phone, contact_email, instagram_url, facebook_url, pickup_location_hy, pickup_location_ru, pickup_location_en",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new CatalogQueryError("settings", error);
  return data ?? DEFAULT_SETTINGS;
}

export async function getFeaturedProducts(limit = 8): Promise<CatalogProduct[]> {
  "use cache";
  cacheCatalog();
  const db = createPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_published", true)
    .eq("is_featured", true)
    .order("is_available", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
    .overrideTypes<ProductRow[], { merge: false }>();
  if (error) throw new CatalogQueryError("featured", error);
  return data.map(toCatalogProduct);
}

export async function getNewestProducts(limit = 8): Promise<CatalogProduct[]> {
  "use cache";
  cacheCatalog();
  const db = createPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(limit)
    .overrideTypes<ProductRow[], { merge: false }>();
  if (error) throw new CatalogQueryError("newest", error);
  return data.map(toCatalogProduct);
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  "use cache";
  cacheCatalog();
  const db = createPublicClient();
  if (!db) return null;
  const { data, error } = await db
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_published", true)
    .eq("slug", slug)
    .maybeSingle()
    .overrideTypes<ProductRow | null, { merge: false }>();
  if (error) throw new CatalogQueryError("product", error);
  return data ? toCatalogProduct(data) : null;
}

export async function getRelatedProducts(
  productId: string,
  categoryId: string | null,
  limit = 4,
): Promise<CatalogProduct[]> {
  "use cache";
  cacheCatalog();
  const db = createPublicClient();
  if (!db) return [];
  let query = db
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_published", true)
    .neq("id", productId)
    .order("is_available", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (categoryId) query = query.eq("category_id", categoryId);
  const { data, error } = await query.overrideTypes<ProductRow[], { merge: false }>();
  if (error) throw new CatalogQueryError("related", error);
  return data.map(toCatalogProduct);
}

/** Removes characters with special meaning in PostgREST filter syntax. */
export function sanitizeSearchTerm(raw: string): string {
  return raw
    .replace(/[,()*%\\"'.:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export type CatalogQuery = {
  q?: string;
  category?: string;
  sort?: SortOption;
  page?: number;
};

export type CatalogPage = {
  products: CatalogProduct[];
  total: number;
  page: number;
  pageCount: number;
};

export async function searchProducts(query: CatalogQuery): Promise<CatalogPage> {
  "use cache";
  cacheCatalog();
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const db = createPublicClient();
  if (!db) return { products: [], total: 0, page, pageCount: 0 };

  let request = db.from("products").select(PRODUCT_SELECT, { count: "exact" }).eq("is_published", true);

  if (query.category) {
    const categories = await getCategories();
    const match = categories.find((c) => c.slug === query.category);
    if (!match) return { products: [], total: 0, page, pageCount: 0 };
    request = request.eq("category_id", match.id);
  }

  const term = query.q ? sanitizeSearchTerm(query.q) : "";
  if (term) {
    request = request.or(`name_hy.ilike.*${term}*,name_ru.ilike.*${term}*,name_en.ilike.*${term}*`);
  }

  switch (query.sort) {
    case "price_asc":
      request = request.order("price_amd", { ascending: true });
      break;
    case "price_desc":
      request = request.order("price_amd", { ascending: false });
      break;
    default:
      request = request.order("created_at", { ascending: false });
  }
  request = request.order("id");

  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await request
    .range(from, from + PAGE_SIZE - 1)
    .overrideTypes<ProductRow[], { merge: false }>();

  // Requesting a page past the end returns a range error; treat as empty.
  if (error && error.code === "PGRST103") {
    return { products: [], total: count ?? 0, page, pageCount: Math.ceil((count ?? 0) / PAGE_SIZE) };
  }
  if (error) throw new CatalogQueryError("search", error);

  const total = count ?? data.length;
  return { products: data.map(toCatalogProduct), total, page, pageCount: Math.ceil(total / PAGE_SIZE) };
}

export async function getSitemapProducts(): Promise<{ slug: string; updated_at: string }[]> {
  "use cache";
  cacheCatalog();
  const db = createPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("products")
    .select("slug, updated_at")
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(5000);
  if (error) throw new CatalogQueryError("sitemap", error);
  return data;
}
