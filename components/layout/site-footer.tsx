import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { FacebookIcon as Facebook, InstagramIcon as Instagram } from "@/components/brand/social-icons";
import { Wordmark } from "@/components/brand/wordmark";
import { getShopSettings } from "@/lib/data/catalog";
import { localized } from "@/lib/i18n/localized";
import type { Locale } from "@/lib/i18n/config";
import type { StoreTranslator } from "@/lib/i18n/messages";

export async function SiteFooter({ locale, t, year }: { locale: Locale; t: StoreTranslator; year: number }) {
  const settings = await getShopSettings();
  const pickup = localized(settings, "pickup_location", locale);

  return (
    <footer className="mt-24 border-t border-sand bg-cream/60">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Wordmark className="h-20" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">{t("footer.tagline")}</p>
          <p className="mt-3 text-sm text-muted">{t("footer.deliveryNote")}</p>
        </div>

        <div>
          <h2 className="font-sans text-sm font-semibold tracking-wide text-ink uppercase">{t("footer.shop")}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link href={`/${locale}/products`} className="text-muted hover:text-ink">
                {t("nav.catalog")}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/cart`} className="text-muted hover:text-ink">
                {t("nav.cart")}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}#story`} className="text-muted hover:text-ink">
                {t("nav.about")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-sans text-sm font-semibold tracking-wide text-ink uppercase">{t("footer.follow")}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {settings.instagram_url ? (
              <li>
                <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-muted hover:text-ink">
                  <Instagram className="h-4 w-4" aria-hidden /> Instagram
                </a>
              </li>
            ) : null}
            {settings.facebook_url ? (
              <li>
                <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-muted hover:text-ink">
                  <Facebook className="h-4 w-4" aria-hidden /> Facebook
                </a>
              </li>
            ) : null}
            {settings.contact_phone ? (
              <li>
                <a href={`tel:${settings.contact_phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 text-muted hover:text-ink">
                  <Phone className="h-4 w-4" aria-hidden /> {settings.contact_phone}
                </a>
              </li>
            ) : null}
            {settings.contact_email ? (
              <li>
                <a href={`mailto:${settings.contact_email}`} className="inline-flex items-center gap-2 break-all text-muted hover:text-ink">
                  <Mail className="h-4 w-4 shrink-0" aria-hidden /> {settings.contact_email}
                </a>
              </li>
            ) : null}
            {pickup ? (
              <li className="inline-flex items-center gap-2 text-muted">
                <MapPin className="h-4 w-4" aria-hidden /> {pickup}
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-sand">
        <p className="container-page py-6 text-xs text-muted">{t("footer.rights", { year })}</p>
      </div>
    </footer>
  );
}
