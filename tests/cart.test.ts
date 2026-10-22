import { describe, expect, it } from "vitest";
import {
  addItem,
  emptyCart,
  itemCount,
  MAX_CART_LINES,
  orderableItems,
  parseStoredCart,
  reconcile,
  removeItem,
  removeUnavailable,
  setQuantity,
  type NewCartItem,
} from "@/lib/cart/cart";

const angel: NewCartItem = {
  productId: "20000000-0000-4000-8000-000000000001",
  slug: "angel",
  name: { hy: "Հրեշտակ", ru: "Ангел", en: "Angel" },
  priceAmd: 5000,
  image: "products/a.webp",
  maxQuantity: 99,
};
const cat: NewCartItem = { ...angel, productId: "20000000-0000-4000-8000-000000000002", slug: "cat", priceAmd: 3500, maxQuantity: 2 };

describe("cart state", () => {
  it("adds items and merges repeated adds", () => {
    let cart = addItem(emptyCart(), angel);
    cart = addItem(cart, angel, 2);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]!.quantity).toBe(3);
    expect(itemCount(cart)).toBe(3);
  });

  it("never exceeds the available quantity", () => {
    let cart = addItem(emptyCart(), cat, 5);
    expect(cart.items[0]!.quantity).toBe(2);
    cart = setQuantity(cart, cat.productId, 10);
    expect(cart.items[0]!.quantity).toBe(2);
  });

  it("refuses to add an unavailable product", () => {
    const cart = addItem(emptyCart(), { ...angel, maxQuantity: 0 });
    expect(cart.items).toHaveLength(0);
  });

  it("increases, decreases and removes", () => {
    let cart = addItem(emptyCart(), angel, 2);
    cart = setQuantity(cart, angel.productId, 5);
    expect(cart.items[0]!.quantity).toBe(5);
    cart = setQuantity(cart, angel.productId, 4);
    expect(cart.items[0]!.quantity).toBe(4);
    cart = setQuantity(cart, angel.productId, 0);
    expect(cart.items).toHaveLength(0);
    cart = removeItem(addItem(cart, angel), angel.productId);
    expect(cart.items).toHaveLength(0);
  });

  it("caps the number of distinct lines", () => {
    let cart = emptyCart();
    for (let i = 0; i < MAX_CART_LINES + 5; i++) {
      cart = addItem(cart, { ...angel, productId: `20000000-0000-4000-8000-${String(i).padStart(12, "0")}` });
    }
    expect(cart.items).toHaveLength(MAX_CART_LINES);
  });

  it("survives corrupted or tampered storage", () => {
    expect(parseStoredCart(null).items).toEqual([]);
    expect(parseStoredCart("not json").items).toEqual([]);
    expect(parseStoredCart(JSON.stringify({ version: 1, items: [{ productId: "x", quantity: -3 }] })).items).toEqual([]);
    const valid = addItem(emptyCart(), angel);
    expect(parseStoredCart(JSON.stringify(valid))).toEqual(valid);
  });
});

describe("cart reconciliation with server data", () => {
  it("updates changed prices and reports them", () => {
    const cart = addItem(emptyCart(), angel);
    const { state, changes } = reconcile(cart, [
      { id: angel.productId, slug: "angel", name: angel.name as never, priceAmd: 5500, image: null, maxQuantity: 99 },
    ]);
    expect(state.items[0]!.priceAmd).toBe(5500);
    expect(changes).toEqual([{ productId: angel.productId, kind: "price", from: 5000, to: 5500 }]);
  });

  it("marks deleted or unavailable products as unavailable", () => {
    let cart = addItem(emptyCart(), angel);
    cart = addItem(cart, cat);
    const { state, changes } = reconcile(cart, [
      { id: cat.productId, slug: "cat", name: cat.name as never, priceAmd: 3500, image: null, maxQuantity: 0 },
    ]);
    expect(state.items.every((line) => line.unavailable)).toBe(true);
    expect(changes.map((c) => c.kind)).toEqual(["unavailable", "unavailable"]);
    expect(orderableItems(state)).toHaveLength(0);
    expect(itemCount(state)).toBe(0);
    expect(removeUnavailable(state).items).toHaveLength(0);
  });

  it("reduces quantities that exceed the remaining stock", () => {
    const cart = addItem(emptyCart(), angel, 5);
    const { state, changes } = reconcile(cart, [
      { id: angel.productId, slug: "angel", name: angel.name as never, priceAmd: 5000, image: null, maxQuantity: 2 },
    ]);
    expect(state.items[0]!.quantity).toBe(2);
    expect(changes).toEqual([{ productId: angel.productId, kind: "quantity", to: 2 }]);
  });
});
