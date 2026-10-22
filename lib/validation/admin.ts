import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/slug";

// Admin input schemas. These are the mass-assignment guard on the application
// side: only fields listed here ever reach the database (strictObject rejects
// unknown keys), and the DB grants enforce the same on its side.
// Messages are keys under `productForm.errors.*` / `settings.*`.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: "tooLong" })
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

export const MAX_PRODUCT_IMAGES = 10;
export const IMAGE_PATH_PATTERN = /^products\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|avif)$/;

export const productInputSchema = z.strictObject({
  slug: z.string().trim().min(1, { message: "required" }).max(120, { message: "tooLong" }).regex(SLUG_PATTERN, { message: "invalidSlug" }),
  name_hy: z.string().trim().min(1, { message: "required" }).max(160, { message: "tooLong" }),
  name_ru: optionalText(160),
  name_en: optionalText(160),
  description_hy: optionalText(5000),
  description_ru: optionalText(5000),
  description_en: optionalText(5000),
  price_amd: z.number({ message: "invalidPrice" }).int({ message: "invalidPrice" }).min(1, { message: "invalidPrice" }).max(100_000_000, { message: "invalidPrice" }),
  category_id: z.uuid().nullable(),
  stock_quantity: z.number({ message: "invalidStock" }).int({ message: "invalidStock" }).min(0, { message: "invalidStock" }).max(100000, { message: "invalidStock" }).nullable(),
  is_available: z.boolean(),
  is_featured: z.boolean(),
  is_published: z.boolean(),
  images: z.array(z.string().regex(IMAGE_PATH_PATTERN)).max(MAX_PRODUCT_IMAGES),
});

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductData = z.output<typeof productInputSchema>;

export const categoryInputSchema = z.strictObject({
  slug: z.string().trim().min(1, { message: "required" }).max(80, { message: "tooLong" }).regex(SLUG_PATTERN, { message: "invalidSlug" }),
  name_hy: z.string().trim().min(1, { message: "required" }).max(120, { message: "tooLong" }),
  name_ru: optionalText(120),
  name_en: optionalText(120),
  sort_order: z.number().int().min(-1000).max(1000),
});

export type CategoryInput = z.input<typeof categoryInputSchema>;

const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine((value) => value === null || /^https:\/\/[^\s]+$/.test(value), { message: "invalidUrl" });

export const settingsInputSchema = z.strictObject({
  delivery_fee_amd: z.number({ message: "invalidAmount" }).int({ message: "invalidAmount" }).min(0, { message: "invalidAmount" }).max(1_000_000, { message: "invalidAmount" }),
  free_delivery_threshold_amd: z.number({ message: "invalidAmount" }).int({ message: "invalidAmount" }).min(1, { message: "invalidAmount" }).max(100_000_000, { message: "invalidAmount" }).nullable(),
  contact_phone: optionalText(40),
  contact_email: z
    .string()
    .trim()
    .max(120)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .refine((value) => value === null || z.email().safeParse(value).success, { message: "invalidEmail" }),
  instagram_url: httpsUrl,
  facebook_url: httpsUrl,
  pickup_location_hy: optionalText(300),
  pickup_location_ru: optionalText(300),
  pickup_location_en: optionalText(300),
});

export type SettingsInput = z.input<typeof settingsInputSchema>;

export const orderStatusValues = ["new", "confirmed", "preparing", "out_for_delivery", "completed", "cancelled"] as const;
export const paymentStatusValues = ["pending", "paid", "failed", "refunded"] as const;

export const orderUpdateSchema = z.strictObject({
  order_status: z.enum(orderStatusValues),
  payment_status: z.enum(paymentStatusValues),
  admin_note: optionalText(4000),
});

export type OrderUpdateInput = z.input<typeof orderUpdateSchema>;

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
