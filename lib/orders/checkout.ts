import "server-only";
import { z } from "zod";
import { checkoutRequestSchema, normalizePhone } from "@/lib/validation/checkout";
import type { ServiceClient } from "@/lib/supabase/service";

// Checkout business logic, independent of Next.js so it can be unit tested.
// The database function create_order does the authoritative work atomically.

export type CheckoutResult =
  | { ok: true; orderId: string; orderNumber: string; publicToken: string; existing: boolean }
  | { ok: false; error: "invalid_input"; fieldErrors: Record<string, string> }
  | { ok: false; error: "price_changed"; totals: { subtotalAmd: number; deliveryFeeAmd: number; totalAmd: number } }
  | { ok: false; error: "product_unavailable"; productIds: string[] }
  | { ok: false; error: "insufficient_stock"; items: { productId: string; available: number }[] }
  | { ok: false; error: "card_unavailable" | "rate_limited" | "not_configured" | "server_error" };

const rpcResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    existing: z.boolean(),
    order_id: z.string(),
    order_number: z.string(),
    public_token: z.string(),
    total_amd: z.number(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
    product_ids: z.array(z.string()).optional(),
    items: z.array(z.object({ product_id: z.string(), available: z.number() })).optional(),
    subtotal_amd: z.number().optional(),
    delivery_fee_amd: z.number().optional(),
    total_amd: z.number().optional(),
  }),
]);

export type CheckoutDeps = {
  db: ServiceClient | null;
  cardPaymentsEnabled: boolean;
  isRateLimited: () => Promise<boolean>;
};

export async function createOrder(input: unknown, deps: CheckoutDeps): Promise<CheckoutResult> {
  const parsed = checkoutRequestSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      fieldErrors[field] ??= issue.message in VALIDATION_CODES ? issue.message : "invalid";
    }
    return { ok: false, error: "invalid_input", fieldErrors };
  }
  const request = parsed.data;

  if (request.paymentMethod === "card" && !deps.cardPaymentsEnabled) {
    return { ok: false, error: "card_unavailable" };
  }
  if (!deps.db) return { ok: false, error: "not_configured" };
  if (await deps.isRateLimited()) return { ok: false, error: "rate_limited" };

  const phone = normalizePhone(request.customerPhone);
  if (!phone) return { ok: false, error: "invalid_input", fieldErrors: { customerPhone: "phoneInvalid" } };

  const { data, error } = await deps.db.rpc("create_order", {
    p_idempotency_key: request.idempotencyKey,
    p_locale: request.locale,
    p_customer_name: request.customerName,
    p_customer_phone: phone,
    p_delivery_address: request.deliveryAddress,
    p_delivery_notes: request.deliveryNotes ?? null,
    p_customer_note: request.customerNote ?? null,
    p_payment_method: request.paymentMethod,
    p_items: request.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
    p_expected_total_amd: request.expectedTotalAmd,
  });

  if (error) {
    // Constraint violations (e.g. a name that is only whitespace) surface as 23xxx.
    if (error.code?.startsWith("23")) {
      return { ok: false, error: "invalid_input", fieldErrors: { form: "invalid" } };
    }
    console.error("[checkout] create_order failed", { code: error.code });
    return { ok: false, error: "server_error" };
  }

  const result = rpcResultSchema.safeParse(data);
  if (!result.success) {
    console.error("[checkout] unexpected create_order response");
    return { ok: false, error: "server_error" };
  }

  const value = result.data;
  if (value.ok) {
    return {
      ok: true,
      orderId: value.order_id,
      orderNumber: value.order_number,
      publicToken: value.public_token,
      existing: value.existing,
    };
  }

  switch (value.error) {
    case "price_changed":
      return {
        ok: false,
        error: "price_changed",
        totals: {
          subtotalAmd: value.subtotal_amd ?? 0,
          deliveryFeeAmd: value.delivery_fee_amd ?? 0,
          totalAmd: value.total_amd ?? 0,
        },
      };
    case "product_unavailable":
      return { ok: false, error: "product_unavailable", productIds: value.product_ids ?? [] };
    case "insufficient_stock":
      return {
        ok: false,
        error: "insufficient_stock",
        items: (value.items ?? []).map((item) => ({ productId: item.product_id, available: item.available })),
      };
    case "invalid_input":
      return { ok: false, error: "invalid_input", fieldErrors: { form: "invalid" } };
    default:
      return { ok: false, error: "server_error" };
  }
}

const VALIDATION_CODES = {
  required: true,
  nameTooShort: true,
  tooLong: true,
  phoneInvalid: true,
  addressTooShort: true,
  invalid: true,
} as const;
