import { describe, expect, it, vi } from "vitest";
import { createOrder, type CheckoutDeps } from "@/lib/orders/checkout";
import type { ServiceClient } from "@/lib/supabase/service";

const request = {
  customerName: "Anna Petrosyan",
  customerPhone: "077 123456",
  deliveryAddress: "Yerevan, Abovyan 1",
  paymentMethod: "cash_on_delivery",
  idempotencyKey: "6f1c2a3b-1d2e-4f5a-8b6c-7d8e9f0a1b2c",
  locale: "en",
  items: [{ productId: "20000000-0000-4000-8000-000000000001", quantity: 2, priceAmd: 1 }],
  expectedTotalAmd: 11000,
};

function fakeDb(response: { data: unknown; error: { code?: string; message?: string } | null }) {
  const rpc = vi.fn(async () => response);
  return { db: { rpc } as unknown as ServiceClient, rpc };
}

function deps(db: ServiceClient | null, overrides: Partial<CheckoutDeps> = {}): CheckoutDeps {
  return { db, cardPaymentsEnabled: false, isRateLimited: async () => false, ...overrides };
}

describe("createOrder (server-side checkout)", () => {
  it("sends only product ids and quantities to the database — never prices", async () => {
    const { db, rpc } = fakeDb({
      data: { ok: true, existing: false, order_id: "o1", order_number: "GP-1001", public_token: "tok", total_amd: 11000 },
      error: null,
    });
    const result = await createOrder(request, deps(db));
    expect(result).toEqual({ ok: true, orderId: "o1", orderNumber: "GP-1001", publicToken: "tok", existing: false });
    expect(rpc).toHaveBeenCalledWith("create_order", expect.objectContaining({
      p_customer_phone: "+37477123456",
      p_items: [{ product_id: request.items[0]!.productId, quantity: 2 }],
      p_expected_total_amd: 11000,
      p_payment_method: "cash_on_delivery",
    }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("priceAmd");
  });

  it("returns field errors without touching the database for invalid input", async () => {
    const { db, rpc } = fakeDb({ data: null, error: null });
    const result = await createOrder({ ...request, customerPhone: "12", customerName: "" }, deps(db));
    expect(result).toMatchObject({ ok: false, error: "invalid_input", fieldErrors: { customerPhone: "phoneInvalid", customerName: "required" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses card payments when no provider is configured", async () => {
    const { db, rpc } = fakeDb({ data: null, error: null });
    expect(await createOrder({ ...request, paymentMethod: "card" }, deps(db))).toEqual({ ok: false, error: "card_unavailable" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("enforces the rate limit", async () => {
    const { db, rpc } = fakeDb({ data: null, error: null });
    expect(await createOrder(request, deps(db, { isRateLimited: async () => true }))).toEqual({ ok: false, error: "rate_limited" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports when Supabase is not configured", async () => {
    expect(await createOrder(request, deps(null))).toEqual({ ok: false, error: "not_configured" });
  });

  it("passes back recalculated totals when prices changed", async () => {
    const { db } = fakeDb({ data: { ok: false, error: "price_changed", subtotal_amd: 12000, delivery_fee_amd: 1000, total_amd: 13000 }, error: null });
    expect(await createOrder(request, deps(db))).toEqual({
      ok: false,
      error: "price_changed",
      totals: { subtotalAmd: 12000, deliveryFeeAmd: 1000, totalAmd: 13000 },
    });
  });

  it("maps unavailable and stock errors", async () => {
    const unavailable = fakeDb({ data: { ok: false, error: "product_unavailable", product_ids: ["p1"] }, error: null });
    expect(await createOrder(request, deps(unavailable.db))).toEqual({ ok: false, error: "product_unavailable", productIds: ["p1"] });

    const stock = fakeDb({ data: { ok: false, error: "insufficient_stock", items: [{ product_id: "p1", available: 1 }] }, error: null });
    expect(await createOrder(request, deps(stock.db))).toEqual({ ok: false, error: "insufficient_stock", items: [{ productId: "p1", available: 1 }] });
  });

  it("hides database errors behind a generic error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fakeDb({ data: null, error: { code: "XX000", message: "connection to 10.0.0.1 failed" } });
    expect(await createOrder(request, deps(db))).toEqual({ ok: false, error: "server_error" });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("Anna");
  });

  it("rejects malformed RPC responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fakeDb({ data: { ok: true }, error: null });
    expect(await createOrder(request, deps(db))).toEqual({ ok: false, error: "server_error" });
  });
});
