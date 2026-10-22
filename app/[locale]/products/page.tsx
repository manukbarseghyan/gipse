import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { ProductCard, ProductGrid } from "@/components/product/product-card";
import { Skeleton } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { AutoSubmitSelect } from "@/components/catalog/auto-submit-select";
import { getCategories, searchProducts } from "@/lib/data/catalog";
import { parseCatalogParams, type RawSearchParams } from "@/lib/catalog-params";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getTranslator, type StoreTranslator } from "@/lib/i18n/messages";
import { localized } from "@/lib/i18n/localized";
import { alternateLanguages } from "@/lib/seo";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/products">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);
  return {
    title: t("meta.catalogTitle"),
    description: t("meta.catalogDescription"),
    alternates: { canonical: `/${locale}/products`, languages: alternateLanguages("/products") },
    openGraph: { title: t("meta.catalogTitle"), description: t("meta.catalogDescription"), url: `/${locale}/products` },
  };
}

export default async function CatalogPage({ params, searchParams }: PageProps<"/[locale]/products">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getTranslator(locale);

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-4xl text-ink sm:text-5xl">{t("catalog.title")}</h1>
        <p className="mt-3 text-muted">{t("catalog.subtitle")}</p>
      </header>
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogResults locale={locale} t={t} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CatalogResults({
  locale,
  t,
  searchParams,
}: {
  locale: Locale;
  t: StoreTranslator;
  searchParams: Promise<RawSearchParams>;
}) {
  const filters = parseCatalogParams(await searchParams);
  const [categories, result] = await Promise.all([
    getCategories(),
    searchProducts({ q: filters.q, category: filters.category, sort: filters.sort, page: filters.page }),
  ]);
  const base = `/${locale}/products`;
  const hasFilters = Boolean(filters.q || filters.category || filters.sort !== "newest");

  const buildHref = (overrides: Partial<typeof filters>) => {
    const next = { ...filters, page: 1, ...overrides };
    const query = new URLSearchParams();
    if (next.q) query.set("q", next.q);
    if (next.category) query.set("category", next.category);
    if (next.sort !== "newest") query.set("sort", next.sort);
    if (next.page > 1) query.set("page", String(next.page));
    const qs = query.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <>
      <form action={base} method="get" role="search" className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
        <div className="relative">
          <label htmlFor="catalog-search" className="sr-only">
            {t("catalog.searchLabel")}
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-taupe" aria-hidden />
          <input
            id="catalog-search"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder={t("catalog.searchPlaceholder")}
            maxLength={60}
            className="h-12 w-full rounded-full border border-stone bg-white pr-4 pl-11 text-base placeholder:text-taupe focus:border-clay focus:ring-2 focus:ring-clay/20 focus:outline-none"
          />
        </div>
        <div className="relative">
          <label htmlFor="catalog-sort" className="sr-only">
            {t("catalog.sortLabel")}
          </label>
          <SlidersHorizontal className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-taupe" aria-hidden />
          <AutoSubmitSelect
            id="catalog-sort"
            name="sort"
            defaultValue={filters.sort}
            className="h-12 w-full appearance-none rounded-full border border-stone bg-white pr-8 pl-11 text-sm focus:border-clay focus:ring-2 focus:ring-clay/20 focus:outline-none sm:w-auto"
          >
            <option value="newest">{t("catalog.sortNewest")}</option>
            <option value="price_asc">{t("catalog.sortPriceAsc")}</option>
            <option value="price_desc">{t("catalog.sortPriceDesc")}</option>
          </AutoSubmitSelect>
        </div>
        <button type="submit" className={buttonClasses("primary", "md", "h-12")}>
          {t("catalog.search")}
        </button>
      </form>

      {categories.length > 0 ? (
        <nav aria-label={t("catalog.categoryLabel")} className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            <li>
              <CategoryChip href={buildHref({ category: "" })} active={!filters.category}>
                {t("catalog.allCategories")}
              </CategoryChip>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <CategoryChip href={buildHref({ category: category.slug })} active={filters.category === category.slug}>
                  {localized(category, "name", locale)}
                </CategoryChip>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="mb-5 flex items-center justify-between gap-4 text-sm text-muted" aria-live="polite">
        <p>{t.plural("catalog.results", result.total)}</p>
        {hasFilters ? (
          <Link href={base} className="font-medium text-clay-dark hover:text-ink">
            {t("catalog.clearFilters")}
          </Link>
        ) : null}
      </div>

      {result.products.length > 0 ? (
        <ProductGrid>
          {result.products.map((product, index) => (
            <ProductCard key={product.id} product={product} locale={locale} t={t} priority={index < 2} />
          ))}
        </ProductGrid>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-dashed border-stone bg-white/60 px-6 py-16 text-center">
          <p className="text-muted">{hasFilters ? t("catalog.emptyFiltered") : t("catalog.empty")}</p>
          {hasFilters ? (
            <Link href={base} className={buttonClasses("outline", "md", "mt-6")}>
              {t("catalog.clearFilters")}
            </Link>
          ) : null}
        </div>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label={t("catalog.pagination")} className="mt-12 flex items-center justify-center gap-3">
          <PageLink href={buildHref({ page: result.page - 1 })} disabled={result.page <= 1} label={t("catalog.previous")}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </PageLink>
          <span className="px-2 text-sm text-muted">{t("catalog.pageOf", { page: result.page, total: result.pageCount })}</span>
          <PageLink href={buildHref({ page: result.page + 1 })} disabled={result.page >= result.pageCount} label={t("catalog.next")}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </PageLink>
        </nav>
      ) : null}
    </>
  );
}

function CategoryChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors",
        active ? "border-ink bg-ink text-ivory" : "border-stone bg-white text-ink hover:border-ink",
      )}
    >
      {children}
    </Link>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled className={buttonClasses("outline", "md", "opacity-40")}>
        {children}
        <span className="sr-only sm:not-sr-only">{label}</span>
      </span>
    );
  }
  return (
    <Link href={href} className={buttonClasses("outline", "md")}>
      {children}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </Link>
  );
}

function CatalogSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="mb-6 h-12 w-full rounded-full" />
      <div className="mb-8 flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>
      <ProductGrid>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-[var(--radius-card)] bg-white">
            <Skeleton className="aspect-[4/5] rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-9 w-full rounded-full" />
            </div>
          </div>
        ))}
      </ProductGrid>
    </div>
  );
}
