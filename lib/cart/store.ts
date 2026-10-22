"use client";

import { useSyncExternalStore } from "react";
import { emptyCart, parseStoredCart, type CartState } from "./cart";

// A tiny external store persisted to localStorage, synced across tabs.

const STORAGE_KEY = "gipse_cart_v1";
const SERVER_SNAPSHOT: CartState = emptyCart();

let state: CartState | null = null;
const listeners = new Set<() => void>();

function read(): CartState {
  if (state) return state;
  try {
    state = parseStoredCart(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    state = emptyCart();
  }
  return state;
}

function emit() {
  for (const listener of listeners) listener();
}

/** Current cart outside React render (e.g. inside async handlers). */
export function getCartSnapshot(): CartState {
  return read();
}

export function updateCart(updater: (current: CartState) => CartState): void {
  const next = updater(read());
  if (next === state) return;
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or disabled (private mode): keep the in-memory cart.
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      state = parseStoredCart(event.newValue);
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): CartState {
  return useSyncExternalStore(subscribe, read, () => SERVER_SNAPSHOT);
}

/** True after hydration; lets UI avoid flashing an "empty cart" state. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function noopSubscribe() {
  return () => {};
}
