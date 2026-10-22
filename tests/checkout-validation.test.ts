import { describe, expect, it } from "vitest";
import { checkoutRequestSchema, customerSchema, normalizePhone } from "@/lib/validation/checkout";

const validCustomer = {
  customerName: "Anna Petrosyan",
  customerPhone: "077 12-34-56",
  deliveryAddress: "Yerevan, Abovyan 1, apt 5",
  paymentMethod: "cash_on_delivery" as const,
};

describe("normalizePhone", () => {
  it.each([
    ["077 12-34-56", "+37477123456"],
    ["+374 77 123456", "+37477123456"],
    ["(010) 123456", "+37410123456"],
    ["0037477123456", "+37477123456"],
    ["77123456", "+37477123456"],
    ["+7 912 345-67-89", "+79123456789"],
  ])("normalises %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "abc", "123", "+374 77 1234", "+3747712345678", "077-123-456<script>"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("customerSchema", () => {
  it("accepts a valid customer and trims optional fields", () => {
    const parsed = customerSchema.parse({ ...validCustomer, deliveryNotes: "  ", customerNote: " Gift wrap " });
    expect(parsed.deliveryNotes).toBeUndefined();
    expect(parsed.customerNote).toBe("Gift wrap");
  });

  it("returns translation-key error codes", () => {
    const result = customerSchema.safeParse({ customerName: "A", customerPhone: "12", deliveryAddress: "abc", paymentMethod: "bitcoin" });
    expect(result.success).toBe(false);
    const codes = Object.fromEntries(result.error!.issues.map((i) => [i.path[0], i.message]));
    expect(codes).toMatchObject({
      customerName: "nameTooShort",
      customerPhone: "phoneInvalid",
      deliveryAddress: "addressTooShort",
      paymentMethod: "required",
    });
  });

  it("flags missing required fields", () => {
    const result = customerSchema.safeParse({ customerName: "", customerPhone: "", deliveryAddress: "", paymentMethod: "card" });
    const codes = result.error!.issues.map((i) => i.message);
    expect(codes.filter((c) => c === "required")).toHaveLength(3);
  });

  it("limits lengths", () => {
    const result = customerSchema.safeParse({ ...validCustomer, customerNote: "x".repeat(1001) });
    expect(result.error!.issues[0]!.message).toBe("tooLong");
  });
});

describe("checkoutRequestSchema", () => {
  const base = {
    ...validCustomer,
    idempotencyKey: "6f1c2a3b-1d2e-4f5a-8b6c-7d8e9f0a1b2c",
    locale: "hy",
    items: [{ productId: "20000000-0000-4000-8000-000000000001", quantity: 2 }],
    expectedTotalAmd: 11000,
  };

  it("accepts a well-formed request", () => {
    expect(checkoutRequestSchema.safeParse(base).success).toBe(true);
  });

  it("rejects bad quantities, empty carts and unknown locales", () => {
    expect(checkoutRequestSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ ...base, items: [{ ...base.items[0], quantity: 0 }] }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ ...base, items: [{ ...base.items[0], quantity: 1.5 }] }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ ...base, items: [{ ...base.items[0], quantity: 100 }] }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ ...base, locale: "de" }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ ...base, items: [{ productId: "x", quantity: 1 }] }).success).toBe(false);
  });

  it("does not carry client-supplied prices", () => {
    const parsed = checkoutRequestSchema.parse({ ...base, items: [{ ...base.items[0], priceAmd: 1 }] });
    expect(parsed.items[0]).toEqual({ productId: base.items[0]!.productId, quantity: 2 });
  });
});
