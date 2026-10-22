import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getPublicSupabaseConfig } from "@/lib/env";
import { getSupabaseSecretKey } from "@/lib/env.server";

/**
 * Privileged client (bypasses RLS). Server-only: used for checkout, rate
 * limiting, Telegram bookkeeping, payment callbacks and the order
 * confirmation page. Never pass its results to the client unfiltered.
 */
export function createServiceClient() {
  const config = getPublicSupabaseConfig();
  const secret = getSupabaseSecretKey();
  if (!config || !secret) return null;
  return createClient<Database>(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>;
