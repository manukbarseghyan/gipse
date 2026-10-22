import "server-only";
import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, defaultLocale, isLocale, type Locale } from "./config";
import { getAdminTranslator, type AdminTranslator } from "./admin";

export async function getAdminLocale(): Promise<Locale> {
  const value = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getAdminT(): Promise<{ locale: Locale; t: AdminTranslator }> {
  const locale = await getAdminLocale();
  return { locale, t: getAdminTranslator(locale) };
}
