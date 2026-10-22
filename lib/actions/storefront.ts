"use server";

import { after } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/service";
import { cartValidationRequestSchema } from "@/lib/validation/checkout";
import { maxOrderableQuantity } from "@/lib/pricing";
import type { FreshProduct } from "@/lib/cart/cart";
import { createOrder, type CheckoutResult } from "@/lib/orders/checkout";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { notifyNewOrder } from "@/lib/telegram/notify";
import { getPaymentProvider } from "@/lib/payments";
import { startCardPayment } from "@/lib/payments/service";
import { isLocale } from "@/lib/i18n/config";

export type CartValidationResult =
  | {
      ok: true;
      products: FreshProduct[];
      delivery: { deliveryFeeAmd: number; freeDeliveryThresholdAmd: number | null };
      cardPaymentsEnabled: boolean;
    }
  | { ok: false };

/**
 * Returns the current price and orderable quantity for the products in a cart.
 * Uncached on purpose: the cart and checkout must reflect the latest data.
 */
export async function validateCartAction(lines: unknown): Promise<CartValidationResult> {
  const parsed = cartValidationRequestSchema.safeParse(lines);
  const db = createPublicClient();
  if (!parsed.success || !db) return { ok: false };

  const ids = [...new Set(parsed.data.map((line) => line.productId))];
  const [productsResult, settingsResult] = await Promise.all([
    ids.length
      ? db
          .from("products")
          .select("id, slug, name_hy, name_ru, name_en, price_amd, is_available, stock_quantity, product_images(storage_path, sort_order)")
          .in("id", ids)
          .eq("is_published", true)
      : Promise.resolve({ data: [], error: null }),
    db.from("shop_settings").select("delivery_fee_amd, free_delivery_threshold_amd").eq("id", 1).maybeSingle(),
  ]);

  if (productsResult.error || settingsResult.error) return { ok: false };

  const products: FreshProduct[] = (productsResult.data ?? []).map((product) => {
    const images = [...(product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    return {
      id: product.id,
      slug: product.slug,
      name: { hy: product.name_hy, ru: product.name_ru, en: product.name_en },
      priceAmd: product.price_amd,
      image: images[0]?.storage_path ?? null,
      maxQuantity: product.is_available ? maxOrderableQuantity(product.stock_quantity) : 0,
    };
  });

  return {
    ok: true,
    products,
    delivery: {
      deliveryFeeAmd: settingsResult.data?.delivery_fee_amd ?? 0,
      freeDeliveryThresholdAmd: settingsResult.data?.free_delivery_threshold_amd ?? null,
    },
    cardPaymentsEnabled: getPaymentProvider() !== null,
  };
}

export type PlaceOrderResult =
  | (Extract<CheckoutResult, { ok: true }> & { redirectUrl: string | null; paymentError: boolean })
  | Extract<CheckoutResult, { ok: false }>;

export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  const db = createServiceClient();
  const provider = getPaymentProvider();
  const ip = await getClientIp();

  const result = await createOrder(input, {
    db,
    cardPaymentsEnabled: provider !== null,
    // 8 checkout attempts per 10 minutes per IP is generous for real customers.
    isRateLimited: () => (db ? isRateLimited(db, "checkout", ip, 8, 600) : Promise.resolve(false)),
  });

  if (!result.ok || !db) return result as Extract<CheckoutResult, { ok: false }>;

  // Notify after the response is sent. The order is already committed, and a
  // failed send is recorded on the order for the admin panel and the retry job.
  after(async () => {
    await notifyNewOrder(db, result.orderId);
  });

  const locale = typeof input === "object" && input && "locale" in input && isLocale(input.locale) ? input.locale : "hy";
  const isCard = typeof input === "object" && input && "paymentMethod" in input && input.paymentMethod === "card";

  if (isCard && provider) {
    const payment = await startCardPayment(db, provider, result.orderId, locale);
    return { ...result, redirectUrl: payment.ok ? payment.redirectUrl : null, paymentError: !payment.ok };
  }

  return { ...result, redirectUrl: null, paymentError: false };
}
