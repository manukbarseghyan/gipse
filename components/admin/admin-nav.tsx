"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ExternalLink, FolderTree, LayoutDashboard, LogOut, Menu, Package, Receipt, Settings, X } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { setAdminLocaleAction, signOutAction } from "@/lib/actions/admin";
import { locales, localeShortNames } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function AdminNav({ email }: { email: string | undefined }) {
  const { locale, t } = useAdminI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/admin", label: t("nav.dashboard"), icon: LayoutDashboard, exact: true },
    { href: "/admin/orders", label: t("nav.orders"), icon: Receipt },
    { href: "/admin/products", label: t("nav.products"), icon: Package },
    { href: "/admin/categories", label: t("nav.categories"), icon: FolderTree },
    { href: "/admin/settings", label: t("nav.settings"), icon: Settings },
  ];

  const nav = (
    <nav aria-label={t("nav.menu")} className="flex flex-1 flex-col">
      <ul className="space-y-1">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-ink text-ivory" : "text-muted hover:bg-cream hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto space-y-4 pt-8">
        <a href={`/${locale}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 text-sm text-muted hover:text-ink">
          <ExternalLink className="h-4 w-4" aria-hidden /> {t("nav.viewShop")}
        </a>
        <form action={setAdminLocaleAction} className="flex gap-1 px-2" aria-label={t("nav.language")}>
          {locales.map((code) => (
            <button
              key={code}
              type="submit"
              name="locale"
              value={code}
              aria-pressed={code === locale}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                code === locale ? "bg-accent-soft text-accent-dark" : "text-taupe hover:text-ink",
              )}
            >
              {localeShortNames[code]}
            </button>
          ))}
        </form>
        <div className="border-t border-sand px-3 pt-4">
          {email ? <p className="mb-2 truncate text-xs text-muted">{email}</p> : null}
          <form action={signOutAction}>
            <button type="submit" className="flex items-center gap-2 text-sm text-muted hover:text-rose">
              <LogOut className="h-4 w-4" aria-hidden /> {t("nav.logout")}
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-sand bg-ivory px-4 lg:hidden">
        <Link href="/admin">
          <Wordmark className="h-10" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="admin-mobile-nav"
          aria-label={t("nav.menu")}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-cream"
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>
      {open ? (
        <div id="admin-mobile-nav" className="fixed inset-x-0 top-14 bottom-0 z-30 flex flex-col overflow-y-auto bg-ivory p-4 lg:hidden">
          {nav}
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sand bg-ivory p-5 lg:flex">
        <Link href="/admin" className="mb-8 px-2">
          <Wordmark className="h-16" />
        </Link>
        {nav}
      </aside>
    </>
  );
}
