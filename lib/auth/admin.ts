import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase/server";

export type AdminContext = {
  user: Pick<User, "id" | "email">;
  supabase: Awaited<ReturnType<typeof createSessionClient>>;
};

export class UnauthorizedError extends Error {
  constructor(public readonly reason: "unauthenticated" | "forbidden") {
    super(reason);
    this.name = "UnauthorizedError";
  }
}

/**
 * Verifies the session with Supabase Auth (getUser() validates the JWT with
 * the auth server, so revoked sessions are rejected) and checks the
 * admin_profiles role mapping. Memoised per request.
 */
export const getAdminContext = cache(async (): Promise<AdminContext | { error: UnauthorizedError["reason"] }> => {
  // Authorization is always per request; this also tells Cache Components not
  // to prerender past this point (the auth client reads the clock).
  await connection();
  let supabase: AdminContext["supabase"];
  try {
    supabase = await createSessionClient();
  } catch {
    return { error: "unauthenticated" };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { error: "unauthenticated" };

  const { data: isAdmin, error: roleError } = await supabase.rpc("is_admin");
  if (roleError || isAdmin !== true) return { error: "forbidden" };

  return { user: { id: user.id, email: user.email }, supabase };
});

/** For admin pages: redirects instead of rendering when not authorized. */
export async function requireAdminPage(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if ("error" in ctx) {
    redirect(ctx.error === "forbidden" ? "/admin/login?error=forbidden" : "/admin/login");
  }
  return ctx;
}

/** For server actions and route handlers: throws so callers return a safe error. */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if ("error" in ctx) throw new UnauthorizedError(ctx.error);
  return ctx;
}
