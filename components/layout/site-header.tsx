"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Menu, ShoppingBag, X } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { useI18n } from "@/components/i18n/i18n-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { itemCount } from "@/lib/cart/cart";
import { useCart, useHydrated } from "@/lib/cart/store";

export function SiteHeader() {
  const { locale, t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const links = [
    { href: `/${locale}`, label: t("nav.home"), exact: true },
    { href: `/${locale}/products`, label: t("nav.catalog") },
    { href: `/${locale}#story`, label: t("nav.about") },
    { href: `/${locale}#contact`, label: t("nav.contact") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-sand/80 bg-ivory/90 backdrop-blur-md">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory"
      >
        {t("nav.skipToContent")}
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-4 sm:h-20">
        <Link href={`/${locale}`} aria-label="GIPSE" className="shrink-0">
          <Wordmark />
        </Link>

        <nav aria-label={t("nav.mainNav")} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Suspense fallback={<NavLink link={link} active={false} className={desktopLink} />}>
                  <ActiveNavLink link={link} className={desktopLink} />
                </Suspense>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden sm:block">
            <Suspense fallback={<LanguageSwitcher pathname={null} />}>
              <LanguageSwitcherWithPath />
            </Suspense>
          </div>
          <CartLink />
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-cream md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div id="mobile-menu" className="border-t border-sand bg-ivory md:hidden">
          <nav aria-label={t("nav.mainNav")} className="container-page py-4">
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.href}>
                  <Suspense fallback={<NavLink link={link} active={false} className={mobileLink} onNavigate={() => setMenuOpen(false)} />}>
                    <ActiveNavLink link={link} className={mobileLink} onNavigate={() => setMenuOpen(false)} />
                  </Suspense>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-sand pt-4">
              <p className="mb-2 px-3 text-xs font-medium tracking-wide text-muted uppercase">{t("nav.language")}</p>
              <Suspense fallback={<LanguageSwitcher pathname={null} expanded />}>
                <LanguageSwitcherWithPath expanded />
              </Suspense>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

type NavItem = { href: string; label: string; exact?: boolean };

const desktopLink = "rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-ink aria-[current=page]:font-medium aria-[current=page]:text-ink";
const mobileLink = "block rounded-xl px-3 py-3.5 text-lg text-ink hover:bg-cream aria-[current=page]:bg-cream";

function NavLink({ link, active, className, onNavigate }: { link: NavItem; active: boolean; className: string; onNavigate?: () => void }) {
  return (
    <Link href={link.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={className}>
      {link.label}
    </Link>
  );
}

/** Reads the pathname, so it must sit inside <Suspense> (Cache Components). */
function ActiveNavLink(props: { link: NavItem; className: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { href, exact } = props.link;
  const active = !href.includes("#") && (exact ? pathname === href : pathname.startsWith(href));
  return <NavLink {...props} active={active} />;
}

function LanguageSwitcherWithPath({ expanded }: { expanded?: boolean }) {
  const pathname = usePathname();
  return <LanguageSwitcher pathname={pathname} expanded={expanded} />;
}

function CartLink() {
  const { locale, t } = useI18n();
  const cart = useCart();
  const hydrated = useHydrated();
  const count = hydrated ? itemCount(cart) : 0;

  return (
    <Link
      href={`/${locale}/cart`}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-cream"
      aria-label={count > 0 ? t("nav.cartWithCount", { count }) : t("nav.cart")}
    >
      <ShoppingBag className="h-5 w-5" aria-hidden />
      {count > 0 ? (
        <span className="absolute top-1 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
