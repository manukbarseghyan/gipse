import "server-only";
import { getArcaConfig } from "@/lib/env.server";
import { createArcaProvider } from "./arca";
import type { PaymentProvider } from "./types";

/** The active online payment provider, or null when online payments are not configured. */
export function getPaymentProvider(): PaymentProvider | null {
  const arca = getArcaConfig();
  return arca ? createArcaProvider(arca) : null;
}

export function isOnlinePaymentEnabled(): boolean {
  return getArcaConfig() !== null;
}
