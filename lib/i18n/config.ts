export const locales = ["hy", "ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "hy";

export const localeNames: Record<Locale, string> = {
  hy: "Հայերեն",
  ru: "Русский",
  en: "English",
};

/** Short labels for the header switcher. */
export const localeShortNames: Record<Locale, string> = {
  hy: "ՀԱՅ",
  ru: "РУС",
  en: "ENG",
};

/** BCP 47 tags for <html lang>, Open Graph and hreflang. */
export const localeTags: Record<Locale, string> = {
  hy: "hy-AM",
  ru: "ru-RU",
  en: "en-US",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export const LOCALE_COOKIE = "gipse_locale";
export const ADMIN_LOCALE_COOKIE = "gipse_admin_locale";
