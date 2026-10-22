import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { isLocale, type Locale } from "./config";
import { getTranslator, type StoreTranslator } from "./messages";

/** Current storefront locale from the `[locale]` root segment (Server Components only). */
export async function getLocale(): Promise<Locale> {
  const value = await rootLocale();
  if (!isLocale(value)) notFound();
  return value;
}

export async function getT(): Promise<{ locale: Locale; t: StoreTranslator }> {
  const locale = await getLocale();
  return { locale, t: getTranslator(locale) };
}

/** Prefixes an internal path with the locale: href("hy", "/products") → "/hy/products". */
export function localeHref(locale: Locale, path = "/"): string {
  return path === "/" ? `/${locale}` : `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}
