import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { AdminPageHeader, Card, OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/admin-ui";
import { OrderManageForm } from "@/components/admin/order-manage-form";
import { TelegramStatus } from "@/components/admin/telegram-status";
import { requireAdminPage } from "@/lib/auth/admin";
import { getOrderDetails } from "@/lib/admin/queries";
import { getAdminT } from "@/lib/i18n/admin-server";
import { formatAmd, formatDateTime } from "@/lib/format";
import type { AdminTranslator } from "@/lib/i18n/admin";

export const metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { supabase } = await requireAdminPage();
  const { id } = await params;
  const [{ locale, t }, order] = await Promise.all([getAdminT(), getOrderDetails(supabase, id)]);
  if (!order) notFound();

  const statusLabel = (kind: "orderStatus" | "paymentStatus", value: string | null) => (value ? t.dynamic(`${kind}.${value}`, value) : "—");

  return (
    <>
      <AdminPageHeader
        title={t("orders.details", { number: order.order_number })}
        back={{ href: "/admin/orders", label: t("orders.title") }}
        actions={
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.order_status} t={t} />
            <PaymentStatusBadge status={order.payment_status} t={t} />
          </div>
        }
      />
      <p className="-mt-4 mb-6 text-sm text-muted">{formatDateTime(order.created_at, locale)}</p>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl text-ink">{t("orders.customerSection")}</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <Item label={t("orders.customer")}>{order.customer_name}</Item>
              <Item label={t("orders.phone")}>
                <a href={`tel:${order.customer_phone}`} className="inline-flex items-center gap-1.5 font-medium text-accent-dark hover:text-ink">
                  <Phone className="h-3.5 w-3.5" aria-hidden /> {order.customer_phone}
                </a>
              </Item>
              <Item label={t("orders.address")} wide>
                <span className="whitespace-pre-line">{order.delivery_address}</span>
              </Item>
              {order.delivery_notes ? (
                <Item label={t("orders.deliveryNotes")} wide>
                  <span className="whitespace-pre-line">{order.delivery_notes}</span>
                </Item>
              ) : null}
              {order.customer_note ? (
                <Item label={t("orders.customerNote")} wide>
                  <span className="whitespace-pre-line">{order.customer_note}</span>
                </Item>
              ) : null}
              <Item label={t("orders.paymentMethod")}>{t.dynamic(`paymentMethod.${order.payment_method}`)}</Item>
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <h2 className="text-xl text-ink">{t("orders.items")}</h2>
            <div className="-mx-5 mt-4 overflow-x-auto sm:-mx-6">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="border-y border-sand bg-cream/50 text-left text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium sm:px-6">{t("orders.product")}</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("orders.price")}</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("orders.qty")}</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium sm:px-6">{t("orders.lineTotal")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand">
                  {order.order_items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-3 sm:px-6">
                        <span className="text-ink">{item.product_name_snapshot}</span>
                        {item.product_id ? null : <span className="ml-2 text-xs text-muted">({t("orders.productDeleted")})</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatAmd(item.unit_price_amd)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums sm:px-6">{formatAmd(item.line_total_amd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
              <Row label={t("orders.subtotal")} value={formatAmd(order.subtotal_amd)} />
              <Row label={t("orders.delivery")} value={formatAmd(order.delivery_fee_amd)} />
              <Row label={t("orders.grandTotal")} value={formatAmd(order.total_amd)} strong />
            </dl>
          </Card>

          <Card>
            <h2 className="text-xl text-ink">{t("orders.history")}</h2>
            <ol className="mt-4 space-y-3 border-l border-sand pl-5 text-sm">
              {order.order_events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute top-1.5 -left-[1.4rem] h-2 w-2 rounded-full bg-accent" aria-hidden />
                  <span className="text-ink">{describeEvent(event, t, statusLabel)}</span>
                  <span className="block text-xs text-muted">{formatDateTime(event.created_at, locale)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-xl text-ink">{t("orders.workflow")}</h2>
            <OrderManageForm
              orderId={order.id}
              initial={{ order_status: order.order_status, payment_status: order.payment_status, admin_note: order.admin_note ?? "" }}
            />
          </Card>
          <Card>
            <h2 className="mb-3 text-xl text-ink">{t("orders.telegram")}</h2>
            <TelegramStatus
              orderId={order.id}
              sentAt={order.telegram_sent_at ? formatDateTime(order.telegram_sent_at, locale) : null}
              attempts={order.telegram_attempts}
              lastError={order.telegram_last_error}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

function describeEvent(
  event: { event_type: string; from_value: string | null; to_value: string | null },
  t: AdminTranslator,
  label: (kind: "orderStatus" | "paymentStatus", value: string | null) => string,
): string {
  switch (event.event_type) {
    case "created":
      return t("orders.historyCreated");
    case "order_status":
      return t("orders.historyOrderStatus", { from: label("orderStatus", event.from_value), to: label("orderStatus", event.to_value) });
    case "payment_status":
      return t("orders.historyPaymentStatus", { from: label("paymentStatus", event.from_value), to: label("paymentStatus", event.to_value) });
    case "admin_note":
      return t("orders.historyNote");
    case "telegram":
      return t("orders.historyTelegram");
    case "payment":
      return t("orders.historyPayment", { to: label("paymentStatus", event.to_value) });
    default:
      return event.event_type;
  }
}

function Item({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-sand pt-1.5 text-base font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
