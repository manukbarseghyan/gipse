import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks for Next.js runtime APIs and the Supabase session client ---------

const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag: (tag: string) => updateTag(tag), cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn(), getAll: () => [] }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => null }));

type FakeSession = {
  user: { id: string; email: string } | null;
  isAdmin: boolean;
  rpcResult?: { data: unknown; error: { code: string } | null };
};

const session: FakeSession = { user: null, isAdmin: false };
const rpc = vi.fn();
const storageRemove = vi.fn(async () => ({ error: null }));
const updateEq = vi.fn(async () => ({ error: null, count: 1 }));
const update = vi.fn(() => ({ eq: updateEq }));

vi.mock("@/lib/supabase/server", () => ({
  SupabaseNotConfiguredError: class extends Error {},
  createSessionClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: session.user }, error: session.user ? null : { message: "no session" } }),
    },
    rpc: async (name: string, args?: unknown) => {
      rpc(name, args);
      if (name === "is_admin") return { data: session.isAdmin, error: null };
      return session.rpcResult ?? { data: null, error: null };
    },
    from: () => ({ update }),
    storage: { from: () => ({ remove: storageRemove }) },
  }),
}));

const { requireAdmin, requireAdminPage, UnauthorizedError } = await import("@/lib/auth/admin");
const actions = await import("@/lib/actions/admin");

const validProduct = {
  slug: "angel",
  name_hy: "Հրեշտակ",
  name_ru: "",
  name_en: "Angel",
  description_hy: "Ձեռագործ",
  description_ru: "",
  description_en: "",
  price_amd: 5000,
  category_id: null,
  stock_quantity: null,
  is_available: true,
  is_featured: false,
  is_published: true,
  images: ["products/abc.webp"],
};

beforeEach(() => {
  session.user = null;
  session.isAdmin = false;
  session.rpcResult = undefined;
  rpc.mockClear();
  updateTag.mockClear();
  storageRemove.mockClear();
  update.mockClear();
});

describe("admin authorization", () => {
  it("rejects anonymous visitors", async () => {
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("rejects signed-in users who are not admins", async () => {
    session.user = { id: "u2", email: "stranger@example.test" };
    await expect(requireAdmin()).rejects.toMatchObject({ reason: "forbidden" });
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT:/admin/login?error=forbidden");
  });

  it("accepts admins", async () => {
    session.user = { id: "u1", email: "owner@example.test" };
    session.isAdmin = true;
    await expect(requireAdmin()).resolves.toMatchObject({ user: { id: "u1" } });
  });

  it("every mutation refuses non-admins before touching data", async () => {
    session.user = { id: "u2", email: "stranger@example.test" };
    const results = await Promise.all([
      actions.saveProductAction(null, validProduct),
      actions.deleteProductAction("20000000-0000-4000-8000-000000000001"),
      actions.setProductAvailabilityAction("20000000-0000-4000-8000-000000000001", false),
      actions.saveCategoryAction(null, { slug: "x", name_hy: "x", sort_order: 0 }),
      actions.deleteCategoryAction("20000000-0000-4000-8000-000000000001"),
      actions.updateOrderAction("20000000-0000-4000-8000-000000000001", { order_status: "completed", payment_status: "paid" }),
      actions.resendTelegramAction("20000000-0000-4000-8000-000000000001"),
      actions.saveSettingsAction({ delivery_fee_amd: 0 }),
      actions.discardUploadsAction(["products/a.webp"]),
    ]);
    for (const result of results) expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(rpc.mock.calls.map(([name]) => name).filter((name) => name !== "is_admin")).toEqual([]);
    expect(update).not.toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
  });
});

describe("product management", () => {
  beforeEach(() => {
    session.user = { id: "u1", email: "owner@example.test" };
    session.isAdmin = true;
  });

  it("creates a product with only whitelisted fields and refreshes the storefront cache", async () => {
    session.rpcResult = { data: { id: "new-id", orphaned_paths: [] }, error: null };
    const result = await actions.saveProductAction(null, validProduct);
    expect(result).toEqual({ ok: true, data: { id: "new-id" } });
    const [, args] = rpc.mock.calls.find(([name]) => name === "admin_save_product")!;
    expect(args).toMatchObject({ p_id: null, p_images: ["products/abc.webp"] });
    expect((args as { p_data: Record<string, unknown> }).p_data).toMatchObject({ slug: "angel", name_ru: null, price_amd: 5000 });
    expect(updateTag).toHaveBeenCalledWith("catalog");
  });

  it("rejects mass-assignment of unknown fields", async () => {
    const result = await actions.saveProductAction(null, { ...validProduct, id: "hijack", created_at: "1999-01-01" });
    expect(result).toMatchObject({ ok: false, error: "invalid" });
    expect(rpc.mock.calls.some(([name]) => name === "admin_save_product")).toBe(false);
  });

  it("validates slugs, prices and image paths", async () => {
    expect(await actions.saveProductAction(null, { ...validProduct, slug: "Bad Slug" })).toMatchObject({ fieldErrors: { slug: "invalidSlug" } });
    expect(await actions.saveProductAction(null, { ...validProduct, price_amd: 10.5 })).toMatchObject({ fieldErrors: { price_amd: "invalidPrice" } });
    expect(await actions.saveProductAction(null, { ...validProduct, price_amd: 0 })).toMatchObject({ fieldErrors: { price_amd: "invalidPrice" } });
    expect(await actions.saveProductAction(null, { ...validProduct, images: ["../../etc/passwd"] })).toMatchObject({ ok: false, error: "invalid" });
    expect(await actions.saveProductAction(null, { ...validProduct, name_hy: "  " })).toMatchObject({ fieldErrors: { name_hy: "required" } });
  });

  it("updates a product and deletes images that are no longer referenced", async () => {
    session.rpcResult = { data: { id: "20000000-0000-4000-8000-000000000001", orphaned_paths: ["products/old.webp"] }, error: null };
    const result = await actions.saveProductAction("20000000-0000-4000-8000-000000000001", validProduct);
    expect(result.ok).toBe(true);
    expect(storageRemove).toHaveBeenCalledWith(["products/old.webp"]);
  });

  it("reports duplicate slugs as a field error", async () => {
    session.rpcResult = { data: null, error: { code: "23505" } };
    expect(await actions.saveProductAction(null, validProduct)).toEqual({ ok: false, error: "conflict", fieldErrors: { slug: "slugTaken" } });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("order updates send only workflow columns", async () => {
    const result = await actions.updateOrderAction("20000000-0000-4000-8000-000000000001", {
      order_status: "confirmed",
      payment_status: "pending",
      admin_note: "Called",
    });
    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ order_status: "confirmed", payment_status: "pending", admin_note: "Called" }, { count: "exact" });
    expect(await actions.updateOrderAction("20000000-0000-4000-8000-000000000001", { order_status: "confirmed", payment_status: "pending", total_amd: 1 })).toMatchObject({ ok: false, error: "invalid" });
  });
});
