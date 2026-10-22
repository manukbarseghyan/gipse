import Link from "next/link";
import { ProductImage } from "@/components/product/product-image";
import { AddToCart } from "@/components/product/add-to-cart";
import { Badge } from "@/components/ui/misc";
import type { CatalogProduct } from "@/lib/data/catalog";
import { formatAmd } from "@/lib/format";
import { localized } from "@/lib/i18n/localized";
import type { Locale } from "@/lib/i18n/config";
import type { StoreTranslator } from "@/lib/i18n/messages";
import { maxOrderableQuantity } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function toCartItem(product: CatalogProduct) {
  return {
    productId: product.id,
    slug: product.slug,
    name: { hy: product.name_hy, ru: product.name_ru, en: product.name_en },
    priceAmd: product.price_amd,
    image: product.images[0] ?? null,
    maxQuantity: product.is_available ? maxOrderableQuantity(product.stock_quantity) : 0,
  };
}

export function isOrderable(product: CatalogProduct): boolean {
  return product.is_available && (product.stock_quantity === null || product.stock_quantity > 0);
}

export function ProductCard({
  product,
  locale,
  t,
  priority = false,
}: {
  product: CatalogProduct;
  locale: Locale;
  t: StoreTranslator;
  priority?: boolean;
}) {
  const name = localized(product, "name", locale);
  const description = localized(product, "description", locale) || t("product.noDescription");
  const href = `/${locale}/products/${product.slug}`;
  const available = isOrderable(product);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] transition-shadow duration-300 hover:shadow-[var(--shadow-lift)]">
      <Link href={href} className="relative block aspect-[4/5] overflow-hidden bg-cream" tabIndex={-1} aria-hidden>
        <ProductImage
          path={product.images[0]}
          alt=""
          sizes="(min-width: 1280px) 300px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          priority={priority}
          className={cn("transition-transform duration-500 group-hover:scale-[1.03]", !available && "opacity-60 grayscale-[35%]")}
          placeholderLabel={t("product.noPhoto")}
        />
        {!available ? (
          <span className="absolute top-3 left-3">
            <Badge tone="danger">{t("product.unavailable")}</Badge>
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-display text-xl leading-snug text-ink">
          <Link href={href} className="hover:text-clay-dark">
            {name}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{description}</p>

        <div className="mt-auto pt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-lg font-semibold text-ink tabular-nums">{formatAmd(product.price_amd)}</p>
            {available ? (
              <Badge tone="success">
                <span className="h-1.5 w-1.5 rounded-full bg-sage" aria-hidden />
                {t("product.available")}
              </Badge>
            ) : (
              <span className="sr-only">{t("product.unavailable")}</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <AddToCart item={toCartItem(product)} size="sm" />
            <Link href={href} className="text-center text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
              {t("product.viewDetails")}
              <span className="sr-only">: {name}</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}
