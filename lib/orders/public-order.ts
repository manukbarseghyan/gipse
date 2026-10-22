import "server-only";
import { z } from "zod";
import type { ServiceClient } from "@/lib/supabase/service";
import type { Json, OrderStatus, PaymentMethod, PaymentStatus } from "@/types/database";

/**
 * What a customer may see on their confirmation page. Deliberately excludes
 * phone, address, notes and admin fields: the page is reachable by anyone
 * holding the (unguessable) link.
 */
export type PublicOrder = {
  id: string;
  order_number: string;
  public_token: string;
  created_at: string;
  order_status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal_amd: number;
  delivery_fee_amd: number;
  total_amd: number;
  items: { id: string; name: Json; fallbackName: string; quantity: number; unit_price_amd: number; line_total_amd: number }[];
};

export async function getPublicOrder(db: ServiceClient, token: string): Promise<PublicOrder | null> {
  if (!z.uuid().safeParse(token).success) return null;
  const { data, error } = await db
    .from("orders")
    .select(
      "id, order_number, public_token, created_at, order_status, payment_method, payment_status, subtotal_amd, delivery_fee_amd, total_amd, order_items(id, product_name_snapshot, product_name_i18n, quantity, unit_price_amd, line_total_amd)",
    )
    .eq("public_token", token)
    .maybeSingle();
  if (error || !data) return null;
  const { order_items, ...order } = data;
  return {
    ...order,
    items: (order_items ?? []).map((item) => ({
      id: item.id,
      name: item.product_name_i18n,
      fallbackName: item.product_name_snapshot,
      quantity: item.quantity,
      unit_price_amd: item.unit_price_amd,
      line_total_amd: item.line_total_amd,
    })),
  };
}
