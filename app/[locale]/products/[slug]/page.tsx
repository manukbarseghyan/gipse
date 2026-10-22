import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChevronRight, Info } from "lucide-react";
import { ProductGallery } from "@/components/product/product-gallery";
import { AddToCart } from "@/components/product/add-to-cart";
import { isOrderable, ProductCard, ProductGrid, toCartItem } from "@/components/product/product-card";
import { Badge, Notice, Skeleton } from "@/components/ui/misc";
import { getProductBySlug, getRelatedProducts } from "@/lib/data/catalog";
import { getSiteUrl, productImageUrl } from "@/lib/env";
import { formatAmd } from "@/lib/format";
import { isLocale, localeTags, type Locale } from "@/lib/i18n/config";
import { getTranslator, type StoreTranslator } from "@/lib/i18n/messages";
import { localized } from "@/lib/i18n/localized";
import { alternateLanguages } from "@/lib/seo";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function generateMetadata({ params }: PageProps<"/[locale]/products/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !SLUG_PATTERN.test(slug)) return {};
  const product = await getProductBySlug(slug);
  const t = getTranslator(locale);
  if (!product) return { title: t("product.notFoundTitle"), robots: { index: false } };

  const name = localized(product, "name", locale);
  const description = (localized(product, "description", locale) || t("product.noDescription")).slice(0, 160);
  const image = product.images[0] ? productImageUrl(product.images[0]) : null;
  const path = `/products/${product.slug}`;

  return {
    title: name,
    description,
    alternates: { canonical: `/${locale}${path}`, languages: alternateLanguages(path) },
    openGraph: {
      type: "website",
      title: name,
      description,
      url: `/${locale}${path}`,
      locale: localeTags[locale].replace("-", "_"),
      images: image ? [{ url: image, alt: name }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: name, description, images: image ? [image] : undefined },
  };
}

export default async function ProductPage({ params }: PageProps<"/[locale]/products/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductContent params={params} />
    </Suspense>
  );
}

async function ProductContent({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !SLUG_PATTERN.test(slug)) notFound();
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const t = getTranslator(locale);
  const name = localized(product, "name", locale);
  const description = localized(product, "description", locale);
  const categoryName = product.category ? localized(product.category, "name", locale) : null;
  const available = isOrderable(product);
  const lowStock = available && product.stock_quantity !== null && product.stock_quantity <= 3;

  return (
    <div className="container-page py-8 sm:py-12">
      <Breadcrumbs locale={locale} t={t} name={name} category={product.category ? { slug: product.category.slug, name: categoryName! } : null} />

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={product.images} name={name} dimmed={!available} />

        <div className="lg:py-4">
          {categoryName ? <p className="eyebrow">{categoryName}</p> : null}
          <h1 className="mt-3 text-4xl leading-tight text-ink sm:text-5xl">{name}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <p className="text-2xl font-semibold text-ink tabular-nums">{formatAmd(product.price_amd)}</p>
            {available ? (
              <Badge tone="success">
                <span className="h-1.5 w-1.5 rounded-full bg-sage" aria-hidden />
                {t("product.available")}
              </Badge>
            ) : (
              <Badge tone="danger">{t("product.unavailable")}</Badge>
            )}
            {lowStock ? <Badge tone="accent">{t.plural("product.lowStock", product.stock_quantity!)}</Badge> : null}
          </div>

          <div className="mt-8">
            {available ? (
              <AddToCart item={toCartItem(product)} withQuantity size="lg" />
            ) : (
              <Notice tone="info" role="status">
                {t("product.unavailableExplain")}
              </Notice>
            )}
          </div>

          <section className="mt-10 border-t border-sand pt-8" aria-labelledby="description-heading">
            <h2 id="description-heading" className="font-sans text-sm font-semibold tracking-wide text-ink uppercase">
              {t("product.description")}
            </h2>
            <div className="mt-4 space-y-4 leading-relaxed whitespace-pre-line text-muted">
              {description || t("product.noDescription")}
            </div>
            <p className="mt-6 flex gap-2 text-sm text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              {t("product.handmadeNote")}
            </p>
          </section>
        </div>
      </div>

      <ProductJsonLd locale={locale} name={name} description={description || t("product.noDescription")} product={product} available={available} />

      <Suspense fallback={null}>
        <Related locale={locale} t={t} productId={product.id} categoryId={product.category_id} />
      </Suspense>
    </div>
  );
}

async function Related({ locale, t, productId, categoryId }: { locale: Locale; t: StoreTranslator; productId: string; categoryId: string | null }) {
  let related = await getRelatedProducts(productId, categoryId, 4);
  if (related.length === 0 && categoryId) related = await getRelatedProducts(productId, null, 4);
  if (related.length === 0) return null;
  return (
    <section className="mt-20" aria-labelledby="related-heading">
      <h2 id="related-heading" className="mb-8 text-3xl text-ink">
        {t("product.related")}
      </h2>
      <ProductGrid>
        {related.map((product) => (
          <ProductCard key={product.id} product={product} locale={locale} t={t} />
        ))}
      </ProductGrid>
    </section>
  );
}

function Breadcrumbs({
  locale,
  t,
  name,
  category,
}: {
  locale: Locale;
  t: StoreTranslator;
  name: string;
  category: { slug: string; name: string } | null;
}) {
  return (
    <nav aria-label={t("product.breadcrumb")}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <li>
          <Link href={`/${locale}`} className="hover:text-ink">
            {t("nav.home")}
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRight className="h-3.5 w-3.5" />
        </li>
        <li>
          <Link href={`/${locale}/products`} className="hover:text-ink">
            {t("nav.catalog")}
          </Link>
        </li>
        {category ? (
          <>
            <li aria-hidden>
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li>
              <Link href={`/${locale}/products?category=${encodeURIComponent(category.slug)}`} className="hover:text-ink">
                {category.name}
              </Link>
            </li>
          </>
        ) : null}
        <li aria-hidden>
          <ChevronRight className="h-3.5 w-3.5" />
        </li>
        <li aria-current="page" className="max-w-[16rem] truncate text-ink">
          {name}
        </li>
      </ol>
    </nav>
  );
}

function ProductJsonLd({
  locale,
  name,
  description,
  product,
  available,
}: {
  locale: Locale;
  name: string;
  description: string;
  product: { slug: string; price_amd: number; images: string[] };
  available: boolean;
}) {
  const url = `${getSiteUrl()}/${locale}/products/${product.slug}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    url,
    image: product.images.map((path) => productImageUrl(path)).filter(Boolean),
    brand: { "@type": "Brand", name: "GIPSE" },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "AMD",
      price: product.price_amd,
      availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be raw JSON; "<" is escaped so content can't close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

function ProductSkeleton() {
  return (
    <div className="container-page py-8 sm:py-12" aria-hidden>
      <Skeleton className="h-4 w-64" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-14">
        <Skeleton className="aspect-square rounded-[var(--radius-card)] sm:aspect-[4/5]" />
        <div className="space-y-4 lg:py-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-8 h-13 w-full rounded-full" />
          <Skeleton className="mt-10 h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
