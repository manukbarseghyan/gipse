import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getPublicSupabaseConfig } from "@/lib/env";

/**
 * Cookie-bound client acting as the signed-in user. Every query runs through
 * Row Level Security with that user's identity. Use for admin pages/actions.
 */
export async function createSessionClient() {
  const config = getPublicSupabaseConfig();
  if (!config) throw new SupabaseNotConfiguredError();
  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session cookie on the next request.
        }
      },
    },
  });
}

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase environment variables are not configured");
    this.name = "SupabaseNotConfiguredError";
  }
}
