import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { ServiceClient } from "@/lib/supabase/service";

/** Client IP as reported by Vercel's edge (x-forwarded-for is set by the platform). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Fixed-window rate limit backed by Postgres, so it holds across serverless
 * instances. IPs are hashed before storage to avoid keeping raw addresses.
 * Fails open on database errors: a limiter outage must not block real orders.
 */
export async function isRateLimited(
  db: ServiceClient,
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const hashed = createHash("sha256").update(identifier).digest("hex").slice(0, 32);
  const { data, error } = await db.rpc("check_rate_limit", {
    p_bucket: `${scope}:${hashed}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] check failed", { scope, code: error.code });
    return false;
  }
  return data === false;
}
