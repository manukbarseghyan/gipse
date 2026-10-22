import { createHmac, timingSafeEqual } from "node:crypto";
import type { ArcaConfig } from "@/lib/env.server";
import type {
  CreateSessionInput,
  CreateSessionResult,
  NormalizedPaymentStatus,
  PaymentProvider,
  PaymentStatusResult,
} from "./types";

// ArCa iPay (BPC SmartVista e-commerce REST API), the gateway behind most
// Armenian acquiring banks' vPOS. One-stage payments via register.do; status
// via getOrderStatusExtended.do. See PAYMENTS.md for onboarding details.

export const AMD_CURRENCY_CODE = "051";
const TIMEOUT_MS = 15000;

/**
 * getOrderStatusExtended orderStatus codes:
 * 0 registered, not paid · 1 pre-authorised (two-stage hold) · 2 fully paid ·
 * 3 authorisation reversed · 4 refunded · 5 ACS (3-D Secure) in progress · 6 declined
 */
export function mapArcaOrderStatus(orderStatus: number): NormalizedPaymentStatus {
  switch (orderStatus) {
    case 2:
      return "paid";
    case 3:
    case 4:
    case 6:
      return "failed";
    default:
      // 0, 1, 5 and unknown codes: not (yet) money we can count as received.
      return "pending";
  }
}

/**
 * Callback checksum: all parameters except `checksum` (and `sign_alias`),
 * sorted by name, concatenated as `name;value;`, HMAC-SHA256 with the shared
 * secret, uppercase hex.
 */
export function arcaCallbackChecksum(params: URLSearchParams, secret: string): string {
  const entries = [...params.entries()]
    .filter(([key]) => key !== "checksum" && key !== "sign_alias")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const payload = entries.map(([key, value]) => `${key};${value};`).join("");
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex").toUpperCase();
}

export function verifyArcaChecksum(params: URLSearchParams, secret: string): boolean {
  const received = params.get("checksum");
  if (!received || !/^[0-9a-fA-F]{64}$/.test(received)) return false;
  const expected = Buffer.from(arcaCallbackChecksum(params, secret), "utf8");
  const actual = Buffer.from(received.toUpperCase(), "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

type FetchLike = typeof fetch;

export function createArcaProvider(config: ArcaConfig, fetchImpl: FetchLike = fetch): PaymentProvider {
  async function call(endpoint: string, params: Record<string, string>): Promise<Record<string, unknown> | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const body = new URLSearchParams({ userName: config.username, password: config.password, ...params });
      const response = await fetchImpl(`${config.baseUrl}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) return null;
      return (await response.json()) as Record<string, unknown>;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    id: "arca",
    signsCallbacks: Boolean(config.callbackSecret),

    async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
      const result = await call("register.do", {
        orderNumber: input.attemptReference,
        amount: String(input.amountAmd * 100),
        currency: AMD_CURRENCY_CODE,
        returnUrl: input.returnUrl,
        failUrl: input.failUrl,
        description: input.description.slice(0, 99),
        language: input.language,
      });
      if (!result) return { ok: false, error: "gateway_unreachable" };
      const errorCode = String(result.errorCode ?? "0");
      if (errorCode !== "0") return { ok: false, error: `gateway_error_${errorCode}` };
      const providerOrderId = typeof result.orderId === "string" ? result.orderId : null;
      const redirectUrl = typeof result.formUrl === "string" ? result.formUrl : null;
      if (!providerOrderId || !redirectUrl || !redirectUrl.startsWith("https://")) {
        return { ok: false, error: "gateway_bad_response" };
      }
      return { ok: true, providerOrderId, redirectUrl };
    },

    async getStatus(providerOrderId: string): Promise<PaymentStatusResult> {
      const result = await call("getOrderStatusExtended.do", { orderId: providerOrderId });
      if (!result) return { ok: false, error: "gateway_unreachable" };
      const errorCode = String(result.errorCode ?? "0");
      if (errorCode !== "0") return { ok: false, error: `gateway_error_${errorCode}` };
      const orderStatus = Number(result.orderStatus);
      if (!Number.isInteger(orderStatus)) return { ok: false, error: "gateway_bad_response" };
      return {
        ok: true,
        status: mapArcaOrderStatus(orderStatus),
        amountMinor: typeof result.amount === "number" ? result.amount : Number(result.amount ?? NaN) || null,
        currency: result.currency != null ? String(result.currency) : null,
        gatewayStatus: `orderStatus=${orderStatus}`,
      };
    },

    verifyCallback(params: URLSearchParams): boolean {
      if (!config.callbackSecret) return true; // Unsigned mode: the callback is only a trigger (see service.ts).
      return verifyArcaChecksum(params, config.callbackSecret);
    },
  };
}
