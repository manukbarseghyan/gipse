import { localeTags, type Locale } from "@/lib/i18n/config";

const groupFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * Formats whole AMD amounts consistently across languages: `5,000 ֏`.
 * A fixed grouping style is used on purpose so prices look identical in
 * every language, matching how prices are written in Armenian shops.
 */
export function formatAmd(amount: number): string {
  return `${groupFormatter.format(Math.round(amount))} ֏`;
}

export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Yerevan",
  }).format(new Date(iso));
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
    dateStyle: "medium",
    timeZone: "Asia/Yerevan",
  }).format(new Date(iso));
}
