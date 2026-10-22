"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, UnauthorizedError, type AdminContext } from "@/lib/auth/admin";
import { CATALOG_TAG, SETTINGS_TAG } from "@/lib/data/catalog";
import { PRODUCT_IMAGE_BUCKET } from "@/lib/env";
import { ADMIN_LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";
import { createSessionClient, SupabaseNotConfiguredError } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { notifyNewOrder } from "@/lib/telegram/notify";
import {
  categoryInputSchema,
  fieldErrorsFrom,
  IMAGE_PATH_PATTERN,
  orderUpdateSchema,
  productInputSchema,
  settingsInputSchema,
} from "@/lib/validation/admin";

// Every action: (1) verifies the session + admin role on the server,
// (2) validates input with a strict schema, (3) writes through the user's own
// session so Row Level Security applies as a second line of defence.

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: "forbidden" | "invalid" | "conflict" | "not_found" | "server_error" | "rate_limited" | "not_configured"; fieldErrors?: Record<string, string> };

async function guard(): Promise<AdminContext | { ok: false; error: "forbidden" }> {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof UnauthorizedError) return { ok: false, error: "forbidden" };
    throw error;
  }
}

function isFailure(value: AdminContext | { ok: false; error: "forbidden" }): value is { ok: false; error: "forbidden" } {
  return "ok" in value;
}

const idSchema = z.uuid();

/** Removes objects from Storage that no product references any more. Best effort. */
async function removeStorageObjects(ctx: AdminContext, paths: string[]): Promise<void> {
  const safe = paths.filter((path) => IMAGE_PATH_PATTERN.test(path));
  if (safe.length === 0) return;
  const { error } = await ctx.supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(safe);
  if (error) console.error("[admin] storage cleanup failed", { count: safe.length });
}

function orphanedPaths(value: unknown): string[] {
  const parsed = z.object({ orphaned_paths: z.array(z.string()) }).safeParse(value);
  return parsed.success ? parsed.data.orphaned_paths : [];
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

const loginSchema = z.object({ email: z.email().max(200), password: z.string().min(1).max(200) });

export type LoginResult = { ok: false; error: "invalid" | "forbidden" | "rate_limited" | "not_configured" | "server_error" };

export async function signInAction(_prev: LoginResult | null, formData: FormData): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: "invalid" };

  const service = createServiceClient();
  if (service && (await isRateLimited(service, "admin-login", await getClientIp(), 10, 900))) {
    return { ok: false, error: "rate_limited" };
  }

  let supabase: Awaited<ReturnType<typeof createSessionClient>>;
  try {
    supabase = await createSessionClient();
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return { ok: false, error: "not_configured" };
    throw error;
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: error.status === 429 ? "rate_limited" : "invalid" };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    return { ok: false, error: "forbidden" };
  }
  redirect("/admin");
}

export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  } catch {
    // Not configured or already signed out.
  }
  redirect("/admin/login");
}

export async function setAdminLocaleAction(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  if (isLocale(locale)) {
    (await cookies()).set(ADMIN_LOCALE_COOKIE, locale, { path: "/admin", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  }
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function saveProductAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await guard();
  if (isFailure(ctx)) return ctx;
  if (id !== null && !idSchema.safeParse(id).success) return { ok: false, error: "invalid" };

  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrorsFrom(parsed.error) };
  const { images, ...fields } = parsed.data;

  const { data, error } = await ctx.supabase.rpc("admin_save_product", {
    p_id: id,
    p_data: fields,
    p_images: images,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "conflict", fieldErrors: { slug: "slugTaken" } };
    if (error.code === "P0002") return { ok: false, error: "not_found" };
    if (error.code === "42501") return { ok: false, error: "forbidden" };
    console.error("[admin] save product failed", { code: error.code });
    return { ok: false, error: "server_error" };
  }

  const parsedResult = z.object({ id: z.string() }).safeParse(data);
  if (!parsedResult.success) return { ok: false, error: "server_error" };
  await removeStorageObjects(ctx, orphanedPaths(data));
  updateTag(CATALOG_TAG);
  return { ok: true, data: { id: parsedResult.data.id } };
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  const ctx = await guard();
  if (isFailure(ctx)) return ctx;
  if (!idSchema.safeParse(id).success) return { ok: false, error: "invalid" };

  const { data, error } = await ctx.supabase.rpc("admin_delete_product", { p_id: id });
  if (error) {
    if (error.code === "P0002") return { ok: false, error: "not_found" };
    console.error("[admin] delete product failed", { code: error.code });
    return { ok: false, error: "server_error" };
  }
  await removeStorageObjects(ctx, orphanedPaths(data));
  updateTag(CATALOG_TAG);
  return { ok: true };
}

export async function setProductAvailabilityAction(id: string, isAvailable: boolean): Promise<ActionResult> {
  const ctx = await guard();
  if (isFailure(ctx)) return ctx;
  if (!idSchema.safeParse(id).success || typeof isAvailable !== "boolean") return { ok: false, error: "invalid" };
  const { error, count } = await ctx.supabase
    .from("products")
    .update({ is_available: isAvailable }, { count: "exact" })
    .eq("id", id);
  if (error) return { ok: false, error: "server_error" };
  if (!count) return { ok: false, error: "not_found" };
  updateTag(CATALOG_TAG);
  return { ok: true };
}

/** Deletes freshly uploaded images that were removed before the product was saved. */
export async function discardUploadsAction(paths: unknown): Promise<ActionResult> {
  const ctx = await guard();
  if (isFailure(ctx)) return ctx;
  const parsed = z.array(z.string().regex(IMAGE_PATH_PATTERN)).max(20).safeParse(paths);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (parsed.data.length === 0) return { ok: true };
  const { data, error } = await ctx.supabase.rpc("admin_unreferenced_paths", { p_paths: parsed.data });
  if (error) return { ok: false, error: "server_error" };
  await removeStorageObjects(ctx, data ?? []);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function saveCategoryAction(id: string | null, input: unknown): Promise<ActionResult> {
  const ctx = await guard();
  if (isFailure(ctx)) return ctx;
  if (id !== null && !idSchema.safeParse(id).success) return { ok: false, error: "invalid" };
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrorsFrom(parsed.error) };

  const { error } = id
    ? await ctx.supabase.from("categories").update(parsed.data).eq("id", id)
    : await ctx.supabase.from("categories").insert(parsed.data);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "conflict", fieldErrors: { slug: "slugTaken" } };
    console.error("[admin] save category failed", { code: error.code });
    return { ok: false, error: "server_error" };
  }
  updateTag(CATALOG_TAG);
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const ctx = await guard();
  if (isFailure(ctx)) return ctx;
  if (!idSchema.safeParse(id).success) return { ok: false, error: "invalid" };
  const { error } = await ctx.supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: "server_error" };
  updateTag(CATALOG_TAG);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function updateOrderAction(id: string, input: unknown): Promise<ActionResult> {
  const ctx = await guard();
  if (isFailure(ctx)) return ctx;
  if (!idSchema.safeParse(id).success) return { ok: false, error: "invalid" };
  const parsed = orderUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrorsFrom(parsed.error) };

  // Only workflow columns are sent; the database grants UPDATE on exactly these.
  const { error, count } = await ctx.supabase
    .from("orders")
    .update(
      { order_status: parsed.data.order_status, payment_status: parsed.data.payment_status, admin_note: parsed.data.admin_note },
      { count: "exact" },
    )
    .eq("id", id);
  if (error) {
    console.error("[admin] update order failed", { code: error.code });
    return { ok: false, error: "server_error" };
  }
  if (!count) return { ok: false, error: "not_found" };
  return { ok: true };
}

export async function resendTelegramAction(orderId: string): Promise<ActionResult<{ outcome: string }>> {
  const ctx = await guard();
  if (isFailure(ctx)) return ctx;
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "invalid" };
  const service = createServiceClient();
  if (!service) return { ok: false, error: "not_configured" };
  const outcome = await notifyNewOrder(service, orderId);
  return { ok: true, data: { outcome } };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  const ctx = await guard();
  if (isFailure(ctx)) return ctx;
  const parsed = settingsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrorsFrom(parsed.error) };
  const { error } = await ctx.supabase.from("shop_settings").update(parsed.data).eq("id", 1);
  if (error) {
    console.error("[admin] save settings failed", { code: error.code });
    return { ok: false, error: "server_error" };
  }
  updateTag(SETTINGS_TAG);
  return { ok: true };
}
