import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { arcaCallbackChecksum, createArcaProvider, mapArcaOrderStatus, verifyArcaChecksum } from "@/lib/payments/arca";
import { syncPaymentStatus } from "@/lib/payments/service";
import type { PaymentProvider } from "@/lib/payments/types";
import type { ServiceClient } from "@/lib/supabase/service";

const SECRET = "callback-secret";

function signed(params: Record<string, string>): URLSearchParams {
  // Reference implementation of the documented algorithm, written independently.
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key};${params[key]};`)
    .join("");
  const checksum = createHmac("sha256", SECRET).update(payload).digest("hex").toUpperCase();
  return new URLSearchParams({ ...params, checksum });
}

describe("ArCa callback signature", () => {
  const params = { mdOrder: "3ff6962a-7dcc-4283-ab50-a6d7dd3386fe", orderNumber: "GP-1001-1", operation: "deposited", status: "1", amount: "1450000" };

  it("accepts a correctly signed callback", () => {
    const query = signed(params);
    expect(verifyArcaChecksum(query, SECRET)).toBe(true);
    expect(arcaCallbackChecksum(query, SECRET)).toBe(query.get("checksum"));
  });

  it("rejects tampered, unsigned or wrongly signed callbacks", () => {
    const tampered = signed(params);
    tampered.set("status", "0");
    expect(verifyArcaChecksum(tampered, SECRET)).toBe(false);
    expect(verifyArcaChecksum(new URLSearchParams(params), SECRET)).toBe(false);
    expect(verifyArcaChecksum(signed(params), "other-secret")).toBe(false);
    const garbage = new URLSearchParams({ ...params, checksum: "zz" });
    expect(verifyArcaChecksum(garbage, SECRET)).toBe(false);
  });

  it("provider.verifyCallback enforces the checksum when a secret is configured", () => {
    const provider = createArcaProvider({ baseUrl: "https://gw.test", username: "u", password: "p", callbackSecret: SECRET });
    expect(provider.signsCallbacks).toBe(true);
    expect(provider.verifyCallback(signed(params))).toBe(true);
    expect(provider.verifyCallback(new URLSearchParams(params))).toBe(false);
  });
});

describe("ArCa gateway client", () => {
  it("maps order statuses conservatively", () => {
    expect(mapArcaOrderStatus(2)).toBe("paid");
    expect(mapArcaOrderStatus(1)).toBe("pending"); // held, not captured
    expect(mapArcaOrderStatus(0)).toBe("pending");
    expect(mapArcaOrderStatus(5)).toBe("pending");
    expect(mapArcaOrderStatus(6)).toBe("failed");
    expect(mapArcaOrderStatus(3)).toBe("failed");
    expect(mapArcaOrderStatus(99)).toBe("pending");
  });

  it("registers a one-stage payment in AMD minor units", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ orderId: "gw-1", formUrl: "https://ipay.arca.am/payment/form?mdOrder=gw-1" })));
    const provider = createArcaProvider({ baseUrl: "https://gw.test/payment/rest", username: "user", password: "pass", callbackSecret: null }, fetchImpl as typeof fetch);
    const result = await provider.createSession({
      attemptReference: "GP-1001-1",
      amountAmd: 14500,
      returnUrl: "https://shop/return",
      failUrl: "https://shop/return",
      description: "GIPSE GP-1001",
      language: "hy",
    });
    expect(result).toEqual({ ok: true, providerOrderId: "gw-1", redirectUrl: "https://ipay.arca.am/payment/form?mdOrder=gw-1" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://gw.test/payment/rest/register.do");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("amount")).toBe("1450000");
    expect(body.get("currency")).toBe("051");
    expect(body.get("orderNumber")).toBe("GP-1001-1");
  });

  it("surfaces gateway errors without throwing", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ errorCode: "1", errorMessage: "Order already processed" })));
    const provider = createArcaProvider({ baseUrl: "https://gw.test", username: "u", password: "p", callbackSecret: null }, fetchImpl as typeof fetch);
    expect(await provider.createSession({ attemptReference: "x", amountAmd: 1, returnUrl: "r", failUrl: "f", description: "d", language: "en" })).toEqual({
      ok: false,
      error: "gateway_error_1",
    });
    const down = createArcaProvider({ baseUrl: "https://gw.test", username: "u", password: "p", callbackSecret: null }, (async () => {
      throw new Error("ECONNRESET");
    }) as typeof fetch);
    expect(await down.getStatus("gw-1")).toEqual({ ok: false, error: "gateway_unreachable" });
  });
});

function paymentDb(payment: { id: string; order_id: string; amount_amd: number; status: string } | null) {
  const rpc = vi.fn(async () => ({ data: true, error: null }));
  const updateEq = vi.fn(async () => ({ error: null }));
  const from = vi.fn(() => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: payment }) }) }) }),
    update: () => ({ eq: updateEq }),
  }));
  return { db: { rpc, from } as unknown as ServiceClient, rpc };
}

function provider(status: Awaited<ReturnType<PaymentProvider["getStatus"]>>): PaymentProvider {
  return {
    id: "arca",
    signsCallbacks: true,
    createSession: vi.fn(),
    verifyCallback: () => true,
    getStatus: vi.fn(async () => status),
  };
}

describe("syncPaymentStatus (the only path that marks an order paid)", () => {
  const payment = { id: "pay-1", order_id: "o1", amount_amd: 14500, status: "pending" };

  it("marks paid only after the gateway confirms the full amount in AMD", async () => {
    const { db, rpc } = paymentDb(payment);
    const outcome = await syncPaymentStatus(db, provider({ ok: true, status: "paid", amountMinor: 1450000, currency: "051", gatewayStatus: "orderStatus=2" }), "gw-1");
    expect(outcome).toBe("paid");
    expect(rpc).toHaveBeenCalledWith("record_payment_result", { p_payment_id: "pay-1", p_status: "paid", p_gateway_status: "orderStatus=2" });
  });

  it("refuses to mark paid when the amount or currency does not match", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, rpc } = paymentDb(payment);
    expect(await syncPaymentStatus(db, provider({ ok: true, status: "paid", amountMinor: 100, currency: "051", gatewayStatus: "orderStatus=2" }), "gw-1")).toBe("amount_mismatch");
    expect(await syncPaymentStatus(db, provider({ ok: true, status: "paid", amountMinor: 1450000, currency: "840", gatewayStatus: "orderStatus=2" }), "gw-1")).toBe("amount_mismatch");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ignores unknown payments and gateway outages", async () => {
    const unknown = paymentDb(null);
    expect(await syncPaymentStatus(unknown.db, provider({ ok: true, status: "paid", amountMinor: 1, currency: "051", gatewayStatus: "" }), "forged")).toBe("unknown_payment");
    const outage = paymentDb(payment);
    expect(await syncPaymentStatus(outage.db, provider({ ok: false, error: "gateway_unreachable" }), "gw-1")).toBe("gateway_error");
    expect(outage.rpc).not.toHaveBeenCalled();
  });

  it("is idempotent for already-paid payments", async () => {
    const { db, rpc } = paymentDb({ ...payment, status: "paid" });
    const p = provider({ ok: true, status: "paid", amountMinor: 1450000, currency: "051", gatewayStatus: "" });
    expect(await syncPaymentStatus(db, p, "gw-1")).toBe("paid");
    expect(p.getStatus).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
