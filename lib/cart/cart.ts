import { z } from "zod";
import { clampQuantity, MAX_QUANTITY_PER_LINE } from "@/lib/pricing";

// Pure cart state transitions. The persisted cart is a convenience for the
// shopper only; prices stored here are display snapshots and are always
// re-validated on the server before an order is created.

export const CART_VERSION = 1;
export const MAX_CART_LINES = 50;

const nameSchema = z.object({
  hy: z.string(),
  ru: z.string().nullable().optional(),
  en: z.string().nullable().optional(),
});

export const cartItemSchema = z.object({
  productId: z.uuid(),
  slug: z.string().min(1).max(120),
  name: nameSchema,
  priceAmd: z.number().int().positive(),
  image: z.string().nullable(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
  maxQuantity: z.number().int().min(0).max(MAX_QUANTITY_PER_LINE),
  /** Set by server validation when the product can no longer be ordered. */
  unavailable: z.boolean().optional(),
});

export type CartItem = z.infer<typeof cartItemSchema>;
export type CartState = { version: typeof CART_VERSION; items: CartItem[] };

export const emptyCart = (): CartState => ({ version: CART_VERSION, items: [] });

const storedCartSchema = z.object({
  version: z.literal(CART_VERSION),
  items: z.array(cartItemSchema).max(MAX_CART_LINES),
});

/** Parses persisted JSON, discarding anything malformed instead of crashing. */
export function parseStoredCart(raw: string | null): CartState {
  if (!raw) return emptyCart();
  try {
    const parsed = storedCartSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyCart();
  } catch {
    return emptyCart();
  }
}

export type NewCartItem = Omit<CartItem, "quantity" | "unavailable">;

export function addItem(state: CartState, item: NewCartItem, quantity = 1): CartState {
  if (item.maxQuantity < 1) return state;
  const existing = state.items.find((line) => line.productId === item.productId);
  if (existing) {
    const next = clampQuantity(existing.quantity + quantity, item.maxQuantity);
    return {
      ...state,
      items: state.items.map((line) =>
        line.productId === item.productId ? { ...line, ...item, quantity: next, unavailable: false } : line,
      ),
    };
  }
  if (state.items.length >= MAX_CART_LINES) return state;
  return {
    ...state,
    items: [...state.items, { ...item, quantity: clampQuantity(quantity, item.maxQuantity) }],
  };
}

export function setQuantity(state: CartState, productId: string, quantity: number): CartState {
  if (quantity < 1) return removeItem(state, productId);
  return {
    ...state,
    items: state.items.map((line) =>
      line.productId === productId ? { ...line, quantity: clampQuantity(quantity, line.maxQuantity) } : line,
    ),
  };
}

export function removeItem(state: CartState, productId: string): CartState {
  return { ...state, items: state.items.filter((line) => line.productId !== productId) };
}

export function removeUnavailable(state: CartState): CartState {
  return { ...state, items: state.items.filter((line) => !line.unavailable) };
}

export function itemCount(state: CartState): number {
  return state.items.reduce((sum, line) => sum + (line.unavailable ? 0 : line.quantity), 0);
}

/** Lines that will actually be ordered. */
export function orderableItems(state: CartState): CartItem[] {
  return state.items.filter((line) => !line.unavailable);
}

// ---------------------------------------------------------------------------
// Reconciliation with fresh server data
// ---------------------------------------------------------------------------

export type FreshProduct = {
  id: string;
  slug: string;
  name: { hy: string; ru: string | null; en: string | null };
  priceAmd: number;
  image: string | null;
  /** 0 when the product cannot be ordered. */
  maxQuantity: number;
};

export type CartChange =
  | { productId: string; kind: "price"; from: number; to: number }
  | { productId: string; kind: "unavailable" }
  | { productId: string; kind: "quantity"; to: number };

/**
 * Applies the server's current view of each product to the cart. Products
 * missing from `fresh` (deleted or unpublished) become unavailable.
 */
export function reconcile(state: CartState, fresh: readonly FreshProduct[]): { state: CartState; changes: CartChange[] } {
  const byId = new Map(fresh.map((product) => [product.id, product]));
  const changes: CartChange[] = [];

  const items = state.items.map((line): CartItem => {
    const product = byId.get(line.productId);
    if (!product || product.maxQuantity < 1) {
      if (!line.unavailable) changes.push({ productId: line.productId, kind: "unavailable" });
      return { ...line, unavailable: true, maxQuantity: 0 };
    }
    if (product.priceAmd !== line.priceAmd) {
      changes.push({ productId: line.productId, kind: "price", from: line.priceAmd, to: product.priceAmd });
    }
    let quantity = line.quantity;
    if (quantity > product.maxQuantity) {
      quantity = product.maxQuantity;
      changes.push({ productId: line.productId, kind: "quantity", to: quantity });
    }
    return {
      ...line,
      slug: product.slug,
      name: product.name,
      priceAmd: product.priceAmd,
      image: product.image,
      maxQuantity: product.maxQuantity,
      quantity,
      unavailable: false,
    };
  });

  return { state: { ...state, items }, changes };
}
