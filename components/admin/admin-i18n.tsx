"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import { localeTags, type Locale } from "@/lib/i18n/config";
import type { AdminMessages, AdminTranslator } from "@/lib/i18n/admin";
import { createTranslator } from "@/lib/i18n/translator";

const AdminI18nContext = createContext<{ locale: Locale; t: AdminTranslator } | null>(null);

export function AdminI18nProvider({ locale, messages, children }: { locale: Locale; messages: AdminMessages; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createTranslator(messages, localeTags[locale]) }), [locale, messages]);
  return <AdminI18nContext value={value}>{children}</AdminI18nContext>;
}

export function useAdminI18n() {
  const value = use(AdminI18nContext);
  if (!value) throw new Error("useAdminI18n must be used inside AdminI18nProvider");
  return value;
}
