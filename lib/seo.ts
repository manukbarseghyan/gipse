import { defaultLocale, locales, localeTags } from "@/lib/i18n/config";

/** hreflang alternates for a path that exists in every locale ("" = home). */
export function alternateLanguages(path: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const locale of locales) entries[localeTags[locale]] = `/${locale}${path}`;
  entries["x-default"] = `/${defaultLocale}${path}`;
  return entries;
}
