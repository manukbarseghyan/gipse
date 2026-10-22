import type { Metadata, Viewport } from "next";
import "../globals.css";
import { fontVariables } from "@/lib/fonts";
import { localeTags } from "@/lib/i18n/config";
import { getAdminMessages } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-server";
import { AdminI18nProvider } from "@/components/admin/admin-i18n";

// The admin area is private and always rendered per request (it reads the
// session cookie), so it opts out of instant-navigation validation.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "GIPSE Admin", template: "%s — GIPSE Admin" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#fbf8f3", width: "device-width", initialScale: 1 };

export default async function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  const locale = await getAdminLocale();
  return (
    <html lang={localeTags[locale]} className={fontVariables}>
      <body className="min-h-dvh bg-cream/50">
        <AdminI18nProvider locale={locale} messages={getAdminMessages(locale)}>
          {children}
        </AdminI18nProvider>
      </body>
    </html>
  );
}
