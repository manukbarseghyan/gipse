import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { cacheLife } from "next/cache";
import "../globals.css";
import { fontVariables } from "@/lib/fonts";
import { isLocale, locales, localeTags, type Locale } from "@/lib/i18n/config";
import { getMessages, getTranslator } from "@/lib/i18n/messages";
import { getSiteUrl } from "@/lib/env";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { alternateLanguages } from "@/lib/seo";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#fafafa",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);
  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: t("meta.defaultTitle"), template: `%s — GIPSE` },
    description: t("meta.defaultDescription"),
    applicationName: "GIPSE",
    alternates: { canonical: `/${locale}`, languages: alternateLanguages("") },
    openGraph: {
      type: "website",
      siteName: "GIPSE",
      locale: localeTags[locale].replace("-", "_"),
      title: t("meta.defaultTitle"),
      description: t("meta.defaultDescription"),
      url: `/${locale}`,
    },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false },
  };
}

async function getCopyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const typedLocale: Locale = locale;
  const t = getTranslator(typedLocale);
  const year = await getCopyrightYear();

  return (
    <html lang={localeTags[typedLocale]} className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <I18nProvider locale={typedLocale} messages={getMessages(typedLocale)}>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter locale={typedLocale} t={t} year={year} />
        </I18nProvider>
      </body>
    </html>
  );
}
