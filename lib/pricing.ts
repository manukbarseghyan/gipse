// Pure money calculations in whole AMD (integers only, no floating point).
// The database function create_order is the source of truth at checkout; this
// module mirrors its rules so the UI can show the same totals in advance.

export const MAX_QUANTITY_PER_LINE = 99;

export type PricedLine = { unitPriceAmd: number; quantity: number };

export type DeliverySettings = {
  deliveryFeeAmd: number;
  freeDeliveryThresholdAmd: number | null;
};

export type Totals = { subtotalAmd: number; deliveryFeeAmd: number; totalAmd: number };

function assertWholeAmd(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative whole number of AMD`);
  }
}

export function lineTotal(line: PricedLine): number {
  assertWholeAmd(line.unitPriceAmd, "unitPriceAmd");
  assertWholeAmd(line.quantity, "quantity");
  return line.unitPriceAmd * line.quantity;
}

export function subtotal(lines: readonly PricedLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

export function deliveryFee(subtotalAmd: number, settings: DeliverySettings): number {
  if (subtotalAmd <= 0) return 0;
  if (settings.freeDeliveryThresholdAmd !== null && subtotalAmd >= settings.freeDeliveryThresholdAmd) {
    return 0;
  }
  return settings.deliveryFeeAmd;
}

export function calculateTotals(lines: readonly PricedLine[], settings: DeliverySettings): Totals {
  const subtotalAmd = subtotal(lines);
  const deliveryFeeAmd = deliveryFee(subtotalAmd, settings);
  return { subtotalAmd, deliveryFeeAmd, totalAmd: subtotalAmd + deliveryFeeAmd };
}

/** Largest quantity a customer may put in the cart for one product. */
export function maxOrderableQuantity(stockQuantity: number | null): number {
  if (stockQuantity === null) return MAX_QUANTITY_PER_LINE;
  return Math.max(0, Math.min(stockQuantity, MAX_QUANTITY_PER_LINE));
}

export function clampQuantity(quantity: number, max: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(Math.max(1, Math.trunc(quantity)), Math.max(1, max));
}
