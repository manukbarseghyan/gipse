"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/i18n-provider";
import { localeNames, locales, localeShortNames, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

function swapLocale(pathname: string, target: Locale): string {
  const segments = pathname.split("/");
  segments[1] = target;
  return segments.join("/") || `/${target}`;
}

/**
 * Keeps the current page (and query string) when switching language.
 * `pathname` is null in the prerendered fallback, where links point to each
 * locale's home page until the real path streams in.
 */
export function LanguageSwitcher({ pathname, expanded = false }: { pathname: string | null; expanded?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();

  return (
    <div role="group" aria-label={t("nav.language")} className={cn("flex items-center", expanded ? "gap-2 px-3" : "gap-0.5")}>
      {locales.map((target) => {
        const active = target === locale;
        return (
          <Link
            key={target}
            href={pathname ? swapLocale(pathname, target) : `/${target}`}
            hrefLang={target}
            lang={target}
            aria-current={active ? "true" : undefined}
            aria-label={localeNames[target]}
            onClick={(event) => {
              // Preserve filters such as ?q=…&page=2 without reading search params during render.
              const search = window.location.search;
              if (search || !pathname) {
                event.preventDefault();
                router.push(`${swapLocale(window.location.pathname, target)}${search}`);
              }
            }}
            className={cn(
              "rounded-full text-xs font-semibold tracking-wide transition-colors",
              expanded ? "border px-4 py-2.5" : "px-2.5 py-2",
              active
                ? expanded
                  ? "border-ink bg-ink text-ivory"
                  : "text-ink"
                : expanded
                  ? "border-stone text-muted hover:border-ink hover:text-ink"
                  : "text-taupe hover:text-ink",
            )}
          >
            {expanded ? localeNames[target] : localeShortNames[target]}
          </Link>
        );
      })}
    </div>
  );
}
