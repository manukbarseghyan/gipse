import type { Locale } from "./config";

/**
 * Translation fallback for database content (product names, descriptions,
 * category names). Armenian is required on every record; Russian and English
 * are optional. When the requested language is empty we fall back in this
 * order, so the storefront never shows a blank field:
 *
 *   hy → (ru, en)     ru → (hy, en)     en → (hy, ru)
 *
 * Armenian is preferred as the fallback because it is always present and is
 * the shop's primary language.
 */
const fallbackOrder: Record<Locale, readonly Locale[]> = {
  hy: ["hy", "ru", "en"],
  ru: ["ru", "hy", "en"],
  en: ["en", "hy", "ru"],
};

type LocalizedRecord<F extends string> = {
  [K in `${F}_${Locale}`]?: string | null;
};

export function localized<F extends string>(record: LocalizedRecord<F>, field: F, locale: Locale): string {
  for (const candidate of fallbackOrder[locale]) {
    const value = record[`${field}_${candidate}` as `${F}_${Locale}`];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return "";
}

/** Same rules for snapshot maps such as order_items.product_name_i18n. */
export function localizedFromMap(map: Partial<Record<Locale, string>> | null | undefined, locale: Locale): string {
  if (!map) return "";
  for (const candidate of fallbackOrder[locale]) {
    const value = map[candidate];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return "";
}
