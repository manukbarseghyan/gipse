import { z } from "zod";
import { MAX_QUANTITY_PER_LINE } from "@/lib/pricing";
import { locales } from "@/lib/i18n/config";

// Error messages are translation keys under `validation.*` so the same schema
// yields localized messages on the client and safe codes on the server.

/**
 * Normalises Armenian and international phone numbers to `+<digits>`.
 * Accepts e.g. "077 12-34-56", "+374 77 123456", "(010) 123456", "0037477123456".
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!/^[+\d\s()\-.]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  const hadPlus = trimmed.startsWith("+");

  if (!hadPlus && digits.startsWith("00")) digits = digits.slice(2);
  else if (!hadPlus && digits.length === 9 && digits.startsWith("0")) digits = `374${digits.slice(1)}`;
  else if (!hadPlus && digits.length === 8) digits = `374${digits}`;

  if (digits.length < 8 || digits.length > 15) return null;
  // Armenian numbers must have exactly 8 digits after the country code.
  if (digits.startsWith("374") && digits.length !== 11) return null;
  return `+${digits}`;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: "tooLong" })
    .optional()
    .transform((value) => (value ? value : undefined));

export const customerSchema = z.object({
  customerName: z
    .string({ message: "required" })
    .trim()
    .min(1, { message: "required" })
    .min(2, { message: "nameTooShort" })
    .max(120, { message: "tooLong" }),
  customerPhone: z
    .string({ message: "required" })
    .trim()
    .min(1, { message: "required" })
    .refine((value) => normalizePhone(value) !== null, { message: "phoneInvalid" }),
  deliveryAddress: z
    .string({ message: "required" })
    .trim()
    .min(1, { message: "required" })
    .min(5, { message: "addressTooShort" })
    .max(500, { message: "tooLong" }),
  deliveryNotes: optionalText(500),
  customerNote: optionalText(1000),
  paymentMethod: z.enum(["cash_on_delivery", "card"], { message: "required" }),
});

export type CustomerFormValues = z.input<typeof customerSchema>;

export const cartLineSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
});

export const checkoutRequestSchema = customerSchema.extend({
  idempotencyKey: z.uuid(),
  locale: z.enum(locales),
  items: z.array(cartLineSchema).min(1).max(50),
  expectedTotalAmd: z.number().int().nonnegative().max(2_000_000_000),
});

export type CheckoutRequest = z.input<typeof checkoutRequestSchema>;

export const cartValidationRequestSchema = z.array(cartLineSchema).max(50);
