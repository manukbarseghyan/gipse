import Link from "next/link";
import { Search } from "lucide-react";
import { AdminPageHeader, AdminPagination, buildQuery, Card, OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/admin-ui";
import { requireAdminPage } from "@/lib/auth/admin";
import { listOrders, parseOrderFilters } from "@/lib/admin/queries";
import { getAdminT } from "@/lib/i18n/admin-server";
import { orderStatusValues } from "@/lib/validation/admin";
import { formatAmd, formatDateTime } from "@/lib/format";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const { supabase } = await requireAdminPage();
  const filters = parseOrderFilters(await searchParams);
  const [{ locale, t }, { orders, pageCount }] = await Promise.all([getAdminT(), listOrders(supabase, filters)]);
  const href = (overrides: Partial<typeof filters>) =>
    buildQuery("/admin/orders", { status: filters.status, q: filters.q, page: 1, ...overrides });

  return (
    <>
      <AdminPageHeader title={t("orders.title")} />

      <form method="get" className="mb-4 flex gap-2" role="search">
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        <label htmlFor="order-search" className="sr-only">
          {t("orders.searchPlaceholder")}
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-taupe" aria-hidden />
          <input
            id="order-search"
            name="q"
            defaultValue={filters.q}
            placeholder={t("orders.searchPlaceholder")}
            className="h-11 w-full rounded-full border border-stone bg-white pr-4 pl-10 text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
          />
        </div>
        <button type="submit" className={buttonClasses("primary", "md")}>
          {t("common.search")}
        </button>
      </form>

      <nav aria-label={t("orders.status")} className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2">
          {[undefined, ...orderStatusValues].map((status) => (
            <li key={status ?? "all"}>
              <Link
                href={href({ status })}
                aria-current={filters.status === status ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-sm whitespace-nowrap",
                  filters.status === status ? "border-ink bg-ink text-ivory" : "border-stone bg-white hover:border-ink",
                )}
              >
                {status ? t.dynamic(`orderStatus.${status}`) : t("common.all")}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Card className="overflow-hidden p-0 sm:p-0">
        {orders.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted">{t("orders.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="border-b border-sand bg-cream/50 text-left text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">{t("orders.number")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("orders.date")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("orders.customer")}</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">{t("orders.total")}</th>
                  <th scope="col" className="px-3 py-3 font-medium">{t("orders.status")}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{t("orders.payment")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-cream/40">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/orders/${order.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                        {order.order_number}
                      </Link>
                      {!order.telegram_sent_at && order.telegram_attempts > 0 ? (
                        <span className="ml-2 text-xs text-rose" title="Telegram">●</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap text-muted">{formatDateTime(order.created_at, locale)}</td>
                    <td className="px-3 py-3.5">
                      <span className="block text-ink">{order.customer_name}</span>
                      <span className="text-xs text-muted">{order.customer_phone}</span>
                    </td>
                    <td className="px-3 py-3.5 text-right font-medium tabular-nums">{formatAmd(order.total_amd)}</td>
                    <td className="px-3 py-3.5"><OrderStatusBadge status={order.order_status} t={t} /></td>
                    <td className="px-5 py-3.5">
                      <span className="flex flex-col items-start gap-1">
                        <PaymentStatusBadge status={order.payment_status} t={t} />
                        <span className="text-xs text-muted">{t.dynamic(`paymentMethod.${order.payment_method}`)}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <AdminPagination page={filters.page} pageCount={pageCount} hrefFor={(page) => href({ page })} t={t} />
    </>
  );
}
