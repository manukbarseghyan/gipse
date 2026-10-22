"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { QuantityStepper } from "@/components/product/add-to-cart";
import { ProductImage } from "@/components/product/product-image";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice, Skeleton } from "@/components/ui/misc";
import { useCartValidation } from "@/components/cart/use-cart-validation";
import { emptyCart, orderableItems, removeItem, removeUnavailable, setQuantity, type CartChange, type CartItem } from "@/lib/cart/cart";
import { updateCart } from "@/lib/cart/store";
import { formatAmd } from "@/lib/format";
import { localizedFromMap } from "@/lib/i18n/localized";
import { calculateTotals, type DeliverySettings } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function CartView() {
  const { locale, t } = useI18n();
  const { cart, hydrated, status, delivery, changes } = useCartValidation();
  const [confirmClear, setConfirmClear] = useState(false);

  if (!hydrated) return <CartSkeleton />;

  if (cart.items.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-white px-6 py-20 text-center shadow-[var(--shadow-soft)]">
        <ShoppingBag className="mx-auto h-10 w-10 text-taupe" aria-hidden />
        <p className="mt-4 text-lg text-ink">{t("cart.empty")}</p>
        <ButtonLink href={`/${locale}/products`} className="mt-8">
          {t("cart.emptyCta")}
        </ButtonLink>
      </div>
    );
  }

  const orderable = orderableItems(cart);
  const hasUnavailable = cart.items.some((line) => line.unavailable);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <section aria-label={t("cart.title")}>
        {status === "checking" ? (
          <p className="mb-4 text-sm text-muted" role="status">
            {t("cart.checking")}
          </p>
        ) : null}
        {status === "error" ? (
          <Notice tone="info" className="mb-4">
            {t("cart.checkFailed")}
          </Notice>
        ) : null}
        {hasUnavailable ? (
          <Notice tone="error" className="mb-4" role="alert">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{t("checkout.errorUnavailable")}</span>
              <button type="button" className="font-medium underline underline-offset-4" onClick={() => updateCart(removeUnavailable)}>
                {t("cart.removeUnavailable")}
              </button>
            </div>
          </Notice>
        ) : null}

        <ul className="divide-y divide-sand overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)]">
          {cart.items.map((line) => (
            <CartLine key={line.productId} line={line} changes={changes.filter((c) => c.productId === line.productId)} />
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Link href={`/${locale}/products`} className="text-sm font-medium text-accent-dark hover:text-ink">
            ← {t("cart.continueShopping")}
          </Link>
          {confirmClear ? (
            <div className="flex items-center gap-2" role="group">
              <span className="text-sm text-muted">{t("cart.clearConfirm")}</span>
              <Button size="sm" variant="danger" onClick={() => updateCart(() => emptyCart())}>
                {t("cart.confirm")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                {t("cart.cancel")}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
              <Trash2 className="h-4 w-4" aria-hidden /> {t("cart.clear")}
            </Button>
          )}
        </div>
      </section>

      <OrderSummary items={orderable} delivery={delivery}>
        <ButtonLink
          href={`/${locale}/checkout`}
          size="lg"
          className="mt-6 w-full"
          aria-disabled={orderable.length === 0}
          tabIndex={orderable.length === 0 ? -1 : undefined}
        >
          {t("cart.checkout")} <ArrowRight className="h-4 w-4" aria-hidden />
        </ButtonLink>
      </OrderSummary>
    </div>
  );
}

function CartLine({ line, changes }: { line: CartItem; changes: CartChange[] }) {
  const { locale, t } = useI18n();
  const name = localizedFromMap({ hy: line.name.hy, ru: line.name.ru ?? undefined, en: line.name.en ?? undefined }, locale);
  const href = `/${locale}/products/${line.slug}`;
  const priceChange = changes.find((c) => c.kind === "price");
  const quantityChange = changes.find((c) => c.kind === "quantity");

  return (
    <li className={cn("flex gap-4 p-4 sm:p-5", line.unavailable && "bg-cream/50")}>
      <Link href={href} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-cream sm:h-28 sm:w-24" tabIndex={-1} aria-hidden>
        <ProductImage path={line.image} alt="" sizes="96px" className={cn(line.unavailable && "opacity-50 grayscale")} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={href} className="font-display text-lg leading-snug text-ink hover:text-accent-dark">
              {name}
            </Link>
            <p className="mt-0.5 text-sm text-muted tabular-nums">{formatAmd(line.priceAmd)}</p>
          </div>
          <button
            type="button"
            onClick={() => updateCart((state) => removeItem(state, line.productId))}
            className="-mt-1 -mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-cream hover:text-rose"
            aria-label={t("cart.removeItem", { name })}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {line.unavailable ? (
          <p className="text-sm text-rose">{t("cart.itemUnavailable")}</p>
        ) : (
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
            <QuantityStepper
              value={line.quantity}
              min={1}
              max={Math.max(1, line.maxQuantity)}
              onChange={(value) => updateCart((state) => setQuantity(state, line.productId, value))}
            />
            <p className="font-semibold text-ink tabular-nums">{formatAmd(line.priceAmd * line.quantity)}</p>
          </div>
        )}
        {priceChange ? <p className="text-xs text-accent-dark">{t("cart.priceChanged")}</p> : null}
        {quantityChange && quantityChange.kind === "quantity" ? (
          <p className="text-xs text-accent-dark">{t("cart.quantityReduced", { count: quantityChange.to })}</p>
        ) : null}
      </div>
    </li>
  );
}

export function OrderSummary({
  items,
  delivery,
  totalsOverride,
  children,
  title,
}: {
  items: CartItem[];
  delivery: DeliverySettings | null;
  totalsOverride?: { subtotalAmd: number; deliveryFeeAmd: number; totalAmd: number } | null;
  children?: React.ReactNode;
  title?: string;
}) {
  const { t } = useI18n();
  const computed = calculateTotals(
    items.map((line) => ({ unitPriceAmd: line.priceAmd, quantity: line.quantity })),
    delivery ?? { deliveryFeeAmd: 0, freeDeliveryThresholdAmd: null },
  );
  const totals = totalsOverride ?? computed;
  const deliveryKnown = Boolean(delivery || totalsOverride);

  return (
    <aside className="rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-soft)] lg:sticky lg:top-28">
      <h2 className="text-2xl text-ink">{title ?? t("cart.summary")}</h2>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{t("cart.subtotal")}</dt>
          <dd className="text-ink tabular-nums">{formatAmd(totals.subtotalAmd)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{t("cart.delivery")}</dt>
          <dd className="text-ink tabular-nums">
            {!deliveryKnown ? "—" : totals.deliveryFeeAmd === 0 ? t("cart.deliveryFree") : formatAmd(totals.deliveryFeeAmd)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-sand pt-3 text-base">
          <dt className="font-semibold text-ink">{t("cart.total")}</dt>
          <dd className="font-semibold text-ink tabular-nums">{formatAmd(totals.totalAmd)}</dd>
        </div>
      </dl>
      {delivery?.freeDeliveryThresholdAmd && totals.deliveryFeeAmd > 0 ? (
        <p className="mt-3 text-xs text-muted">{t("cart.freeDeliveryFrom", { amount: formatAmd(delivery.freeDeliveryThresholdAmd) })}</p>
      ) : null}
      {children}
    </aside>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]" aria-hidden>
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-[var(--radius-card)]" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
    </div>
  );
}
