"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import { localeTags, type Locale } from "@/lib/i18n/config";
import type { Messages, StoreTranslator } from "@/lib/i18n/messages";
import { createTranslator } from "@/lib/i18n/translator";

type I18nValue = { locale: Locale; t: StoreTranslator };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createTranslator(messages, localeTags[locale]) }), [locale, messages]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const value = use(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

export function useLocalePath(): (path?: string) => string {
  const { locale } = useI18n();
  return (path = "/") => (path === "/" ? `/${locale}` : `/${locale}${path}`);
}
