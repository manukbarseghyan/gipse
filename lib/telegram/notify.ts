import "server-only";
import { getSiteUrl } from "@/lib/env";
import { getTelegramConfig } from "@/lib/env.server";
import type { ServiceClient } from "@/lib/supabase/service";
import { buildOrderMessage } from "./format";
import { sendTelegramMessage, type TelegramConfig } from "./client";

export type NotifyOutcome = "sent" | "already_sent_or_in_progress" | "not_configured" | "failed";

/**
 * Sends the new-order notification exactly once.
 *
 * The order is already committed before this runs, so a Telegram outage can
 * never lose an order. Delivery is claimed in the database first
 * (claim_telegram_notification), which stops concurrent retries from sending
 * duplicates; failures are recorded on the order and shown in the admin panel,
 * which offers a "resend" button, and the cron job retries them.
 */
export async function notifyNewOrder(
  db: ServiceClient,
  orderId: string,
  deps: { config?: TelegramConfig | null; fetchImpl?: typeof fetch } = {},
): Promise<NotifyOutcome> {
  const config = deps.config === undefined ? getTelegramConfig() : deps.config;
  if (!config) return "not_configured";

  const { data: claimed, error: claimError } = await db.rpc("claim_telegram_notification", { p_order_id: orderId });
  if (claimError) {
    console.error("[telegram] claim failed", { orderId, code: claimError.code });
    return "failed";
  }
  if (!claimed) return "already_sent_or_in_progress";

  const { data: order, error: orderError } = await db
    .from("orders")
    .select(
      "id, order_number, created_at, customer_name, customer_phone, delivery_address, delivery_notes, customer_note, payment_method, subtotal_amd, delivery_fee_amd, total_amd, order_items(product_name_snapshot, quantity, unit_price_amd, line_total_amd)",
    )
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    await db.rpc("complete_telegram_notification", { p_order_id: orderId, p_error: "order lookup failed" });
    console.error("[telegram] order lookup failed", { orderId });
    return "failed";
  }

  const text = buildOrderMessage(order, order.order_items ?? [], `${getSiteUrl()}/admin/orders/${order.id}`);
  const result = await sendTelegramMessage(config, text, deps.fetchImpl);

  await db.rpc("complete_telegram_notification", {
    p_order_id: orderId,
    p_error: result.ok ? null : result.error,
  });

  if (!result.ok) {
    // Log only the order id and the (token-free) error, never customer data.
    console.error("[telegram] send failed", { orderId, error: result.error });
    return "failed";
  }
  return "sent";
}
