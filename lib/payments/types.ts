// Provider-agnostic payment interface. Adding a provider means implementing
// this interface and registering it in lib/payments/index.ts.

export type PaymentLanguage = "hy" | "ru" | "en";

export type CreateSessionInput = {
  /** Unique per attempt; the gateway rejects duplicates. */
  attemptReference: string;
  amountAmd: number;
  returnUrl: string;
  failUrl: string;
  description: string;
  language: PaymentLanguage;
};

export type CreateSessionResult =
  | { ok: true; providerOrderId: string; redirectUrl: string }
  | { ok: false; error: string };

export type NormalizedPaymentStatus = "paid" | "pending" | "failed";

export type PaymentStatusResult =
  | {
      ok: true;
      status: NormalizedPaymentStatus;
      /** Amount the gateway reports, in AMD minor units (luma: AMD × 100). */
      amountMinor: number | null;
      /** ISO 4217 numeric code, e.g. "051" for AMD. */
      currency: string | null;
      gatewayStatus: string;
    }
  | { ok: false; error: string };

export interface PaymentProvider {
  readonly id: "arca";
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  /** Authenticated server-to-server status lookup — the only source of truth. */
  getStatus(providerOrderId: string): Promise<PaymentStatusResult>;
  /** Verifies a callback's signature. Returns false for forged/garbled callbacks. */
  verifyCallback(params: URLSearchParams): boolean;
  /** Whether callbacks carry a verifiable signature for this configuration. */
  readonly signsCallbacks: boolean;
}
