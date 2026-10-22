import type { SortOption } from "@/lib/data/catalog";

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCatalogParams(raw: RawSearchParams) {
  const sortRaw = first(raw.sort);
  const sort: SortOption = sortRaw === "price_asc" || sortRaw === "price_desc" ? sortRaw : "newest";
  const pageRaw = Number.parseInt(first(raw.page) ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 && pageRaw < 10000 ? pageRaw : 1;
  const q = (first(raw.q) ?? "").slice(0, 60).trim();
  const category = (first(raw.category) ?? "").slice(0, 80).trim();
  return { q, category, sort, page };
}
