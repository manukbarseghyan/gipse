import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getPublicSupabaseConfig } from "@/lib/env";

/**
 * Anonymous, cookie-free client for public catalog reads. Because it never
 * touches request data it is safe to call inside `"use cache"` scopes.
 * RLS limits it to published products, categories and shop settings.
 */
export function createPublicClient() {
  const config = getPublicSupabaseConfig();
  if (!config) return null;
  return createClient<Database>(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
