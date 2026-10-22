import "server-only";
import { getSiteUrl } from "@/lib/env";
import type { ServiceClient } from "@/lib/supabase/service";
import type { Locale } from "@/lib/i18n/config";
import { AMD_CURRENCY_CODE } from "./arca";
import type { PaymentProvider } from "./types";

export type StartPaymentResult = { ok: true; redirectUrl: string } | { ok: false; error: string };

/**
 * Registers a new payment attempt with the gateway for an unpaid card order.
 * Each attempt gets its own reference because gateways reject reused order numbers.
 */
export async function startCardPayment(
  db: ServiceClient,
  provider: PaymentProvider,
  orderId: string,
  locale: Locale,
): Promise<StartPaymentResult> {
  const { data: order, error } = await db
    .from("orders")
    .select("id, order_number, public_token, total_amd, payment_method, payment_status, order_status")
    .eq("id", orderId)
    .single();
  if (error || !order) return { ok: false, error: "order_not_found" };
  if (order.payment_method !== "card") return { ok: false, error: "not_card_order" };
  if (order.payment_status === "paid" || order.payment_status === "refunded") return { ok: false, error: "already_paid" };
  if (order.order_status === "cancelled") return { ok: false, error: "order_cancelled" };

  const { count } = await db.from("payments").select("id", { count: "exact", head: true }).eq("order_id", order.id);
  const attemptReference = `${order.order_number}-${(count ?? 0) + 1}`;

  const { data: payment, error: insertError } = await db
    .from("payments")
    .insert({ order_id: order.id, provider: provider.id, attempt_reference: attemptReference, amount_amd: order.total_amd })
    .select("id")
    .single();
  if (insertError || !payment) return { ok: false, error: "payment_record_failed" };

  const returnUrl = `${getSiteUrl()}/api/payments/${provider.id}/return?token=${order.public_token}&locale=${locale}`;
  const session = await provider.createSession({
    attemptReference,
    amountAmd: order.total_amd,
    returnUrl,
    failUrl: returnUrl,
    description: `GIPSE ${order.order_number}`,
    language: locale,
  });

  if (!session.ok) {
    await db.from("payments").update({ status: "failed", last_gateway_status: session.error }).eq("id", payment.id);
    console.error("[payments] session creation failed", { orderId: order.id, error: session.error });
    return { ok: false, error: session.error };
  }

  await db
    .from("payments")
    .update({ provider_order_id: session.providerOrderId, status: "pending" })
    .eq("id", payment.id);

  return { ok: true, redirectUrl: session.redirectUrl };
}

export type SyncOutcome = "paid" | "pending" | "failed" | "unknown_payment" | "gateway_error" | "amount_mismatch";

/**
 * Asks the gateway (authenticated, server-to-server) for the real status of a
 * payment and records it. This is the ONLY path that can mark an order paid;
 * browser redirects and callbacks merely trigger it. Safe to call repeatedly.
 */
export async function syncPaymentStatus(
  db: ServiceClient,
  provider: PaymentProvider,
  providerOrderId: string,
): Promise<SyncOutcome> {
  const { data: payment } = await db
    .from("payments")
    .select("id, order_id, amount_amd, status")
    .eq("provider", provider.id)
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  if (!payment) return "unknown_payment";
  if (payment.status === "paid") return "paid";

  const status = await provider.getStatus(providerOrderId);
  if (!status.ok) return "gateway_error";

  if (status.status === "paid") {
    const expectedMinor = payment.amount_amd * 100;
    if (status.amountMinor !== expectedMinor || (status.currency !== null && status.currency !== AMD_CURRENCY_CODE)) {
      console.error("[payments] amount/currency mismatch", { paymentId: payment.id });
      await db.from("payments").update({ last_gateway_status: "amount_mismatch" }).eq("id", payment.id);
      return "amount_mismatch";
    }
  }

  if (status.status !== "pending") {
    await db.rpc("record_payment_result", {
      p_payment_id: payment.id,
      p_status: status.status,
      p_gateway_status: status.gatewayStatus,
    });
  }
  return status.status;
}

/** Re-checks the most recent pending attempt of an order (used by the return page). */
export async function syncLatestPaymentForOrder(
  db: ServiceClient,
  provider: PaymentProvider,
  orderId: string,
): Promise<SyncOutcome | null> {
  const { data: payment } = await db
    .from("payments")
    .select("provider_order_id")
    .eq("order_id", orderId)
    .eq("provider", provider.id)
    .not("provider_order_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!payment?.provider_order_id) return null;
  return syncPaymentStatus(db, provider, payment.provider_order_id);
}
