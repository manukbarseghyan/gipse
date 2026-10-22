import { describe, expect, it } from "vitest";
import { calculateTotals, clampQuantity, deliveryFee, lineTotal, maxOrderableQuantity, MAX_QUANTITY_PER_LINE, subtotal } from "@/lib/pricing";
import { formatAmd } from "@/lib/format";

const settings = { deliveryFeeAmd: 1000, freeDeliveryThresholdAmd: 20000 };

describe("pricing", () => {
  it("computes line totals and subtotals in whole AMD", () => {
    expect(lineTotal({ unitPriceAmd: 5000, quantity: 3 })).toBe(15000);
    expect(subtotal([{ unitPriceAmd: 5000, quantity: 2 }, { unitPriceAmd: 3500, quantity: 1 }])).toBe(13500);
    expect(subtotal([])).toBe(0);
  });

  it("rejects fractional or negative money values", () => {
    expect(() => lineTotal({ unitPriceAmd: 10.5, quantity: 1 })).toThrow(RangeError);
    expect(() => lineTotal({ unitPriceAmd: -1, quantity: 1 })).toThrow(RangeError);
    expect(() => lineTotal({ unitPriceAmd: 100, quantity: 1.5 })).toThrow(RangeError);
  });

  it("applies the delivery fee below the free-delivery threshold only", () => {
    expect(deliveryFee(19999, settings)).toBe(1000);
    expect(deliveryFee(20000, settings)).toBe(0);
    expect(deliveryFee(0, settings)).toBe(0);
    expect(deliveryFee(50000, { deliveryFeeAmd: 1500, freeDeliveryThresholdAmd: null })).toBe(1500);
  });

  it("calculates final totals (matches create_order in the database)", () => {
    expect(calculateTotals([{ unitPriceAmd: 5000, quantity: 2 }, { unitPriceAmd: 3500, quantity: 1 }], settings)).toEqual({
      subtotalAmd: 13500,
      deliveryFeeAmd: 1000,
      totalAmd: 14500,
    });
    expect(calculateTotals([{ unitPriceAmd: 5000, quantity: 4 }], settings).totalAmd).toBe(20000);
  });

  it("limits orderable quantity by stock and the per-line cap", () => {
    expect(maxOrderableQuantity(null)).toBe(MAX_QUANTITY_PER_LINE);
    expect(maxOrderableQuantity(3)).toBe(3);
    expect(maxOrderableQuantity(0)).toBe(0);
    expect(maxOrderableQuantity(1000)).toBe(MAX_QUANTITY_PER_LINE);
    expect(clampQuantity(0, 5)).toBe(1);
    expect(clampQuantity(7, 5)).toBe(5);
    expect(clampQuantity(2.7, 5)).toBe(2);
    expect(clampQuantity(Number.NaN, 5)).toBe(1);
  });

  it("formats AMD consistently", () => {
    expect(formatAmd(5000)).toBe("5,000 ֏");
    expect(formatAmd(1250000)).toBe("1,250,000 ֏");
    expect(formatAmd(0)).toBe("0 ֏");
  });
});
