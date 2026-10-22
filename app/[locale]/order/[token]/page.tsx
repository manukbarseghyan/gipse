import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CheckCircle2, CreditCard, RefreshCw } from "lucide-react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Badge, Notice, Skeleton } from "@/components/ui/misc";
import { createServiceClient } from "@/lib/supabase/service";
import { getPublicOrder } from "@/lib/orders/public-order";
import { getPaymentProvider } from "@/lib/payments";
import { startPaymentAction } from "@/lib/actions/payment";
import { formatAmd, formatDateTime } from "@/lib/format";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/messages";
import { localizedFromMap } from "@/lib/i18n/localized";
import type { Json } from "@/types/database";

export async function generateMetadata({ params }: PageProps<"/[locale]/order/[token]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  // Private page: never indexed, no order details in metadata.
  return { title: getTranslator(locale)("order.thanks"), robots: { index: false, follow: false } };
}

export default function OrderPage({ params, searchParams }: PageProps<"/[locale]/order/[token]">) {
  return (
    <div className="container-page max-w-3xl py-10 sm:py-16">
      <Suspense fallback={<Skeleton className="h-[28rem] w-full rounded-[var(--radius-card)]" />}>
        <OrderDetails params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function asNameMap(value: Json): Partial<Record<Locale, string>> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<Record<Locale, string>>) : {};
}

async function OrderDetails({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale, token }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const t = getTranslator(locale);

  const db = createServiceClient();
  const order = db ? await getPublicOrder(db, token) : null;
  if (!order) {
    return (
      <div className="text-center">
        <h1 className="text-4xl text-ink">{t("order.notFoundTitle")}</h1>
        <p className="mt-3 text-muted">{t("order.notFoundText")}</p>
        <ButtonLink href={`/${locale}`} className="mt-8">
          {t("order.backHome")}
        </ButtonLink>
      </div>
    );
  }

  const cardEnabled = getPaymentProvider() !== null;
  const isCard = order.payment_method === "card";
  const awaitingCard = isCard && (order.payment_status === "pending" || order.payment_status === "failed") && order.order_status !== "cancelled";
  const paymentUnavailableFlag = query.payment === "unavailable";

  return (
    <article>
      <header className="text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-sage" aria-hidden />
        <h1 className="mt-5 text-4xl text-ink sm:text-5xl">{t("order.thanks")}</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted">{t("order.received")}</p>
      </header>

      <div className="mt-10 rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">{t("order.number")}</dt>
            <dd className="mt-1 font-display text-3xl tracking-wide text-ink">{order.order_number}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">{t("order.placedAt")}</dt>
            <dd className="mt-1 text-ink">{formatDateTime(order.created_at, locale)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">{t("order.status")}</dt>
            <dd className="mt-1">
              <Badge tone={order.order_status === "cancelled" ? "danger" : "accent"}>{t.dynamic(`orderStatus.${order.order_status}`)}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">{t("order.payment")}</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2 text-ink">
              {t.dynamic(`paymentMethod.${order.payment_method}`)}
              <Badge tone={order.payment_status === "paid" ? "success" : order.payment_status === "failed" ? "danger" : "neutral"}>
                {t.dynamic(`paymentStatus.${order.payment_status}`)}
              </Badge>
            </dd>
          </div>
        </dl>
        <p className="mt-5 text-sm text-muted">{t("order.keepNumber")}</p>

        <h2 className="mt-8 border-t border-sand pt-6 font-sans text-sm font-semibold tracking-wide text-ink uppercase">{t("order.items")}</h2>
        <ul className="mt-4 divide-y divide-sand">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-4 py-3 text-sm">
              <span className="min-w-0 text-ink">
                {localizedFromMap(asNameMap(item.name), locale) || item.fallbackName}
                <span className="ml-2 text-muted tabular-nums">
                  {item.quantity} × {formatAmd(item.unit_price_amd)}
                </span>
              </span>
              <span className="shrink-0 text-ink tabular-nums">{formatAmd(item.line_total_amd)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-sand pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("cart.subtotal")}</dt>
            <dd className="tabular-nums">{formatAmd(order.subtotal_amd)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t("cart.delivery")}</dt>
            <dd className="tabular-nums">{order.delivery_fee_amd === 0 ? t("cart.deliveryFree") : formatAmd(order.delivery_fee_amd)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>{t("cart.total")}</dt>
            <dd className="tabular-nums">{formatAmd(order.total_amd)}</dd>
          </div>
        </dl>
      </div>

      <section className="mt-6 rounded-[var(--radius-card)] bg-cream/70 p-6 sm:p-8" aria-labelledby="next-heading">
        <h2 id="next-heading" className="text-2xl text-ink">
          {t("order.nextTitle")}
        </h2>
        {!isCard ? <p className="mt-3 text-muted">{t("order.nextCod")}</p> : null}

        {isCard && order.payment_status === "paid" ? (
          <Notice tone="success" className="mt-4" role="status">
            {t("order.paymentConfirmed")}
          </Notice>
        ) : null}

        {awaitingCard ? (
          <div className="mt-4 space-y-4">
            {!cardEnabled || paymentUnavailableFlag ? (
              <Notice tone="info">{t("order.paymentUnavailable")}</Notice>
            ) : order.payment_status === "failed" ? (
              <Notice tone="error">{t("order.paymentFailedText")}</Notice>
            ) : (
              <p className="text-muted">
                {t("order.nextCard")} {t("order.paymentPendingCheck")}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {cardEnabled ? (
                <form action={startPaymentAction}>
                  <input type="hidden" name="token" value={order.public_token} />
                  <input type="hidden" name="locale" value={locale} />
                  <button type="submit" className={buttonClasses("primary", "md")}>
                    <CreditCard className="h-4 w-4" aria-hidden /> {t("order.payNow")}
                  </button>
                </form>
              ) : null}
              <Link href={`/${locale}/order/${order.public_token}`} className={buttonClasses("outline", "md")}>
                <RefreshCw className="h-4 w-4" aria-hidden /> {t("order.refresh")}
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <p className="mt-10 text-center">
        <ButtonLink href={`/${locale}`} variant="outline">
          {t("order.backHome")}
        </ButtonLink>
      </p>
    </article>
  );
}
