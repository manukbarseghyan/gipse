import "server-only";
import { z } from "zod";
import type { AdminContext } from "@/lib/auth/admin";
import { sanitizeSearchTerm } from "@/lib/data/catalog";
import { orderStatusValues } from "@/lib/validation/admin";
import type { OrderStatus } from "@/types/database";

type Db = AdminContext["supabase"];

export const ADMIN_PAGE_SIZE = 20;

export class AdminQueryError extends Error {
  constructor(context: string) {
    super(`Admin query failed: ${context}`);
    this.name = "AdminQueryError";
  }
}

const statsSchema = z.object({
  total_products: z.number(),
  available_products: z.number(),
  total_orders: z.number(),
  new_orders: z.number(),
  active_orders: z.number(),
  telegram_failed: z.number(),
  revenue_amd: z.number(),
});

export type DashboardStats = z.infer<typeof statsSchema>;

const ORDER_LIST_COLUMNS =
  "id, order_number, customer_name, customer_phone, total_amd, order_status, payment_status, payment_method, created_at, telegram_sent_at, telegram_attempts";

export async function getDashboard(db: Db) {
  const [stats, recent] = await Promise.all([
    db.rpc("admin_dashboard_stats"),
    db.from("orders").select(ORDER_LIST_COLUMNS).order("created_at", { ascending: false }).limit(8),
  ]);
  if (stats.error || recent.error) throw new AdminQueryError("dashboard");
  return { stats: statsSchema.parse(stats.data), recent: recent.data };
}

export type OrderFilters = { status?: OrderStatus; q?: string; page: number };

export function parseOrderFilters(raw: Record<string, string | string[] | undefined>): OrderFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const status = one(raw.status);
  const page = Number.parseInt(one(raw.page) ?? "1", 10);
  return {
    status: (orderStatusValues as readonly string[]).includes(status ?? "") ? (status as OrderStatus) : undefined,
    q: (one(raw.q) ?? "").trim().slice(0, 40) || undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export async function listOrders(db: Db, filters: OrderFilters) {
  let query = db.from("orders").select(ORDER_LIST_COLUMNS, { count: "exact" });
  if (filters.status) query = query.eq("order_status", filters.status);
  if (filters.q) {
    const term = sanitizeSearchTerm(filters.q).replace(/\s+/g, "");
    const digits = term.replace(/\D/g, "");
    const clauses = [`order_number.ilike.*${term}*`];
    if (digits.length >= 3) clauses.push(`customer_phone.ilike.*${digits.slice(-8)}*`);
    if (term) query = query.or(clauses.join(","));
  }
  const from = (filters.page - 1) * ADMIN_PAGE_SIZE;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error && error.code !== "PGRST103") throw new AdminQueryError("orders");
  const total = count ?? 0;
  return { orders: data ?? [], total, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

export async function getOrderDetails(db: Db, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await db
    .from("orders")
    .select(
      "*, order_items(id, product_id, product_slug_snapshot, product_name_snapshot, unit_price_amd, quantity, line_total_amd), order_events(id, event_type, from_value, to_value, created_at)",
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "order_events", ascending: true })
    .maybeSingle();
  if (error) throw new AdminQueryError("order");
  return data;
}

export type ProductFilters = { q?: string; category?: string; availability?: "available" | "unavailable" | "hidden"; page: number };

export function parseProductFilters(raw: Record<string, string | string[] | undefined>): ProductFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const availability = one(raw.availability);
  const page = Number.parseInt(one(raw.page) ?? "1", 10);
  const category = one(raw.category);
  return {
    q: (one(raw.q) ?? "").trim().slice(0, 60) || undefined,
    category: category && (category === "none" || z.uuid().safeParse(category).success) ? category : undefined,
    availability: availability === "available" || availability === "unavailable" || availability === "hidden" ? availability : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export async function listProducts(db: Db, filters: ProductFilters) {
  let query = db
    .from("products")
    .select(
      "id, slug, name_hy, name_ru, name_en, price_amd, is_available, is_featured, is_published, stock_quantity, updated_at, category_id, product_images(storage_path, sort_order)",
      { count: "exact" },
    );
  if (filters.q) {
    const term = sanitizeSearchTerm(filters.q);
    if (term) query = query.or(`name_hy.ilike.*${term}*,name_ru.ilike.*${term}*,name_en.ilike.*${term}*,slug.ilike.*${term}*`);
  }
  if (filters.category === "none") query = query.is("category_id", null);
  else if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.availability === "available") query = query.eq("is_available", true).eq("is_published", true);
  if (filters.availability === "unavailable") query = query.eq("is_available", false);
  if (filters.availability === "hidden") query = query.eq("is_published", false);

  const from = (filters.page - 1) * ADMIN_PAGE_SIZE;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error && error.code !== "PGRST103") throw new AdminQueryError("products");
  const total = count ?? 0;
  return {
    products: (data ?? []).map((p) => ({
      ...p,
      cover: [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null,
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

export async function getProductForEdit(db: Db, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await db
    .from("products")
    .select("*, product_images(storage_path, sort_order)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AdminQueryError("product");
  if (!data) return null;
  const { product_images, ...product } = data;
  return {
    ...product,
    images: [...(product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.storage_path),
  };
}

export async function listCategories(db: Db) {
  const [categories, products] = await Promise.all([
    db.from("categories").select("id, slug, name_hy, name_ru, name_en, sort_order").order("sort_order").order("name_hy"),
    db.from("products").select("category_id"),
  ]);
  if (categories.error || products.error) throw new AdminQueryError("categories");
  const counts = new Map<string, number>();
  for (const row of products.data) if (row.category_id) counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  return categories.data.map((c) => ({ ...c, productCount: counts.get(c.id) ?? 0 }));
}

export async function getSettings(db: Db) {
  const { data, error } = await db.from("shop_settings").select("*").eq("id", 1).single();
  if (error) throw new AdminQueryError("settings");
  return data;
}
