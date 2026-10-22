"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reconcile, type CartChange } from "@/lib/cart/cart";
import { getCartSnapshot, updateCart, useCart, useHydrated } from "@/lib/cart/store";
import { validateCartAction } from "@/lib/actions/storefront";
import type { DeliverySettings } from "@/lib/pricing";

type ValidationState = {
  status: "idle" | "checking" | "ok" | "error";
  delivery: DeliverySettings | null;
  cardPaymentsEnabled: boolean;
  changes: CartChange[];
};

/**
 * Re-validates the cart against the server on mount (and on demand), applying
 * current prices and availability. The cart snapshot in localStorage is never
 * trusted for the final total — the server recomputes it at checkout anyway.
 */
export function useCartValidation() {
  const cart = useCart();
  const hydrated = useHydrated();
  const [state, setState] = useState<ValidationState>({
    status: "idle",
    delivery: null,
    cardPaymentsEnabled: false,
    changes: [],
  });
  const ran = useRef(false);

  const revalidate = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, status: "checking" }));
    const current = getCartSnapshot();
    const result = await validateCartAction(current.items.map((line) => ({ productId: line.productId, quantity: line.quantity })));
    if (!result.ok) {
      setState((s) => ({ ...s, status: "error" }));
      return false;
    }
    let changes: CartChange[] = [];
    updateCart((latest) => {
      const reconciled = reconcile(latest, result.products);
      changes = reconciled.changes;
      return reconciled.changes.length > 0 || hasDifferences(latest, reconciled.state) ? reconciled.state : latest;
    });
    setState({ status: "ok", delivery: result.delivery, cardPaymentsEnabled: result.cardPaymentsEnabled, changes });
    return true;
  }, []);

  useEffect(() => {
    if (!hydrated || ran.current) return;
    ran.current = true;
    // Synchronise with an external system (the server) once on mount.
    void revalidate();
  }, [hydrated, revalidate]);

  return { ...state, revalidate, cart, hydrated };
}

function hasDifferences(a: { items: unknown[] }, b: { items: unknown[] }): boolean {
  return JSON.stringify(a.items) !== JSON.stringify(b.items);
}
