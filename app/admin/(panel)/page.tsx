import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import { AdminPageHeader, Card, OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/admin-ui";
import { requireAdminPage } from "@/lib/auth/admin";
import { getDashboard } from "@/lib/admin/queries";
import { getAdminT } from "@/lib/i18n/admin-server";
import { getTelegramConfig } from "@/lib/env.server";
import { isOnlinePaymentEnabled } from "@/lib/payments";
import { formatAmd, formatDateTime } from "@/lib/format";

export const metadata = { title: "Overview" };

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdminPage();
  const [{ locale, t }, { stats, recent }] = await Promise.all([getAdminT(), getDashboard(supabase)]);
  const telegramReady = getTelegramConfig() !== null;
  const paymentsReady = isOnlinePaymentEnabled();

  const tiles = [
    { label: t("dashboard.newOrders"), value: stats.new_orders, href: "/admin/orders?status=new", highlight: stats.new_orders > 0 },
    { label: t("dashboard.activeOrders"), value: stats.active_orders, href: "/admin/orders" },
    { label: t("dashboard.totalOrders"), value: stats.total_orders, href: "/admin/orders" },
    { label: t("dashboard.totalProducts"), value: stats.total_products, href: "/admin/products" },
    { label: t("dashboard.availableProducts"), value: stats.available_products, href: "/admin/products?availability=available" },
  ];

  return (
    <>
      <AdminPageHeader title={t("dashboard.title")} />

      {stats.telegram_failed > 0 ? (
        <div className="mb-6 flex gap-3 rounded-2xl border border-rose/30 bg-rose-soft px-4 py-3 text-sm text-rose" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t("dashboard.telegramFailed", { count: stats.telegram_failed })}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className={`rounded-2xl p-5 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)] ${tile.highlight ? "bg-ink text-ivory" : "bg-white"}`}
          >
            <p className={`text-sm ${tile.highlight ? "text-ivory/75" : "text-muted"}`}>{tile.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{tile.value}</p>
          </Link>
        ))}
        <div className="col-span-2 rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)] lg:col-span-1">
          <p className="text-sm text-muted">{t("dashboard.revenue")}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatAmd(stats.revenue_amd)}</p>
          <p className="mt-1 text-xs text-muted">{t("dashboard.revenueHint")}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card className="overflow-hidden p-0 sm:p-0">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
            <h2 className="text-xl text-ink">{t("dashboard.recentOrders")}</h2>
            <Link href="/admin/orders" className="text-sm font-medium text-accent-dark hover:text-ink">
              {t("dashboard.viewAllOrders")}
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="px-6 py-10 text-sm text-muted">{t("dashboard.noOrders")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-sand">
              {recent.map((order) => (
                <li key={order.id}>
                  <Link href={`/admin/orders/${order.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-cream/60 sm:px-6">
                    <span className="w-24 font-medium text-ink">{order.order_number}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted">{order.customer_name}</span>
                    <span className="text-sm text-muted">{formatDateTime(order.created_at, locale)}</span>
                    <span className="w-28 text-right text-sm font-medium tabular-nums">{formatAmd(order.total_amd)}</span>
                    <span className="flex gap-1.5">
                      <OrderStatusBadge status={order.order_status} t={t} />
                      <PaymentStatusBadge status={order.payment_status} t={t} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-xl text-ink">{t("dashboard.setupTitle")}</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <SetupItem ok={telegramReady} text={telegramReady ? t("dashboard.telegramOk") : t("dashboard.telegramMissing")} />
            <SetupItem ok={paymentsReady} text={paymentsReady ? t("dashboard.paymentsOk") : t("dashboard.paymentsMissing")} />
          </ul>
        </Card>
      </div>
    </>
  );
}

function SetupItem({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex gap-2.5">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />}
      <span className={ok ? "text-ink" : "text-muted"}>{text}</span>
    </li>
  );
}
