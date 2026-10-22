"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { addItem, type NewCartItem } from "@/lib/cart/cart";
import { updateCart, useCart } from "@/lib/cart/store";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  item: NewCartItem;
  /** Show a quantity selector next to the button (product page). */
  withQuantity?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function AddToCart({ item, withQuantity = false, size = "md", className }: Props) {
  const { t } = useI18n();
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const inCart = cart.items.find((line) => line.productId === item.productId)?.quantity ?? 0;
  const remaining = Math.max(0, item.maxQuantity - inCart);
  const disabled = item.maxQuantity < 1 || remaining < 1;
  const effectiveQuantity = Math.min(quantity, Math.max(1, remaining));

  function handleAdd() {
    if (disabled) return;
    updateCart((state) => addItem(state, item, effectiveQuantity));
    setAdded(true);
    setQuantity(1);
    window.setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {withQuantity && item.maxQuantity > 0 ? (
        <QuantityStepper
          value={effectiveQuantity}
          min={1}
          max={Math.max(1, remaining)}
          onChange={setQuantity}
          disabled={disabled}
        />
      ) : null}
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className={buttonClasses("primary", size, withQuantity ? "flex-1 min-w-48" : "h-auto min-h-9 w-full py-2 leading-tight text-center")}
      >
        {added ? <Check className="h-4 w-4" aria-hidden /> : <ShoppingBag className="h-4 w-4" aria-hidden />}
        {item.maxQuantity < 1 ? t("product.unavailable") : remaining < 1 ? t("product.maxReached") : added ? t("product.addedToCart") : t("product.addToCart")}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {added ? t("product.addedToCart") : ""}
      </span>
    </div>
  );
}

export function QuantityStepper({
  value,
  min,
  max,
  onChange,
  disabled,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="inline-flex h-11 items-center rounded-full border border-stone bg-white" role="group" aria-label={label ?? t("product.quantity")}>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-cream disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={t("product.decrease")}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label ?? t("product.quantity")}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
        className="w-10 [appearance:textfield] bg-transparent text-center text-sm font-medium tabular-nums focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-cream disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={t("product.increase")}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
