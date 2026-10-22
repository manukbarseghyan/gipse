import Link from "next/link";
import { Plus, Search, Star } from "lucide-react";
import { AdminPageHeader, AdminPagination, buildQuery, Card } from "@/components/admin/admin-ui";
import { AvailabilityToggle } from "@/components/admin/product-actions";
import { ProductImage } from "@/components/product/product-image";
import { Badge, Notice } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/auth/admin";
import { listCategories, listProducts, parseProductFilters } from "@/lib/admin/queries";
import { getAdminT } from "@/lib/i18n/admin-server";
import { localized } from "@/lib/i18n/localized";
import { formatAmd } from "@/lib/format";

export const metadata = { title: "Products" };

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const { supabase } = await requireAdminPage();
  const raw = await searchParams;
  const filters = parseProductFilters(raw);
  const [{ locale, t }, { products, pageCount }, categories] = await Promise.all([
    getAdminT(),
    listProducts(supabase, filters),
    listCategories(supabase),
  ]);
  const categoryName = new Map(categories.map((c) => [c.id, localized(c, "name", locale)]));
  const hasFilters = Boolean(filters.q || filters.category || filters.availability);
  const href = (page: number) => buildQuery("/admin/products", { q: filters.q, category: filters.category, availability: filters.availability, page });

  return (
    <>
      <AdminPageHeader
        title={t("products.title")}
        actions={
          <Link href="/admin/products/new" className={buttonClasses("primary", "md")}>
            <Plus className="h-4 w-4" aria-hidden /> {t("products.new")}
          </Link>
        }
      />
      {raw.deleted ? <Notice tone="success" className="mb-4" role="status">{t("products.deleted")}</Notice> : null}

      <form method="get" role="search" className="mb-6 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <label htmlFor="product-search" className="sr-only">{t("products.searchPlaceholder")}</label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-taupe" aria-hidden />
          <input
            id="product-search"
            name="q"
            defaultValue={filters.q}
            placeholder={t("products.searchPlaceholder")}
            className="h-11 w-full rounded-full border border-stone bg-white pr-4 pl-10 text-sm focus:border-clay focus:ring-2 focus:ring-clay/20 focus:outline-none"
          />
        </div>
        <label htmlFor="product-category" className="sr-only">{t("products.category")}</label>
        <select id="product-category" name="category" defaultValue={filters.category ?? ""} className="h-11 rounded-full border border-stone bg-white px-4 text-sm">
          <option value="">{t("products.allCategories")}</option>
          <option value="none">{t("products.uncategorized")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{localized(c, "name", locale)}</option>
          ))}
        </select>
        <label htmlFor="product-availability" className="sr-only">{t("products.availability")}</label>
        <select id="product-availability" name="availability" defaultValue={filters.availability ?? ""} className="h-11 rounded-full border border-stone bg-white px-4 text-sm">
          <option value="">{t("common.all")}</option>
          <option value="available">{t("products.available")}</option>
          <option value="unavailable">{t("products.unavailable")}</option>
          <option value="hidden">{t("products.draft")}</option>
        </select>
        <button type="submit" className={buttonClasses("outline", "md", "h-11")}>{t("common.filter")}</button>
      </form>

      {products.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-muted">{hasFilters ? t("products.emptyFiltered") : t("products.empty")}</p>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {products.map((product) => {
            const name = localized(product, "name", locale);
            return (
              <li key={product.id} className="flex items-center gap-4 rounded-2xl bg-white p-3 shadow-[var(--shadow-soft)] sm:p-4">
                <Link href={`/admin/products/${product.id}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream" aria-hidden tabIndex={-1}>
                  <ProductImage path={product.cover} alt="" sizes="64px" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/products/${product.id}`} className="font-medium text-ink hover:text-clay-dark">
                    {name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{product.category_id ? categoryName.get(product.category_id) : t("products.uncategorized")}</span>
                    <span aria-hidden>·</span>
                    <span>{product.stock_quantity === null ? t("products.madeToOrder") : `${t("products.stock")}: ${product.stock_quantity}`}</span>
                  </div>
                </div>
                <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                  {!product.is_published ? <Badge>{t("products.draft")}</Badge> : null}
                  {product.is_featured ? (
                    <Badge tone="accent"><Star className="h-3 w-3" aria-hidden />{t("products.featured")}</Badge>
                  ) : null}
                  <Badge tone={product.is_available ? "success" : "danger"}>
                    {product.is_available ? t("products.available") : t("products.unavailable")}
                  </Badge>
                </div>
                <div className="flex w-28 shrink-0 flex-col items-end gap-1">
                  <span className="font-semibold tabular-nums">{formatAmd(product.price_amd)}</span>
                  <AvailabilityToggle productId={product.id} isAvailable={product.is_available} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <AdminPagination page={filters.page} pageCount={pageCount} hrefFor={href} t={t} />
    </>
  );
}
