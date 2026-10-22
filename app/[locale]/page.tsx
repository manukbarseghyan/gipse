import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Gift, Hand, Mail, MapPin, Phone, Truck } from "lucide-react";
import { InstagramIcon as Instagram } from "@/components/brand/social-icons";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/misc";
import { ProductCard, ProductGrid } from "@/components/product/product-card";
import { ProductImage } from "@/components/product/product-image";
import { LogoMark } from "@/components/brand/wordmark";
import { getCategories, getFeaturedProducts, getNewestProducts, getShopSettings } from "@/lib/data/catalog";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getTranslator, type StoreTranslator } from "@/lib/i18n/messages";
import { localized } from "@/lib/i18n/localized";
import { formatAmd } from "@/lib/format";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getTranslator(locale);

  const [featured, newest, categories, settings] = await Promise.all([
    getFeaturedProducts(8),
    getNewestProducts(8),
    getCategories(),
    getShopSettings(),
  ]);

  const featuredIds = new Set(featured.map((product) => product.id));
  const newArrivals = newest.filter((product) => !featuredIds.has(product.id)).slice(0, 4);
  const showcase = featured.length > 0 ? featured : newest.slice(0, 4);
  const heroImages = [...featured, ...newest].filter((product) => product.images[0]).slice(0, 3);
  const pickup = localized(settings, "pickup_location", locale);

  return (
    <>
      <Hero locale={locale} t={t} images={heroImages.map((p) => ({ path: p.images[0]!, name: localized(p, "name", locale) }))} />

      <section className="container-page py-16 sm:py-24" aria-labelledby="featured-heading">
        <SectionHeading
          id="featured-heading"
          title={featured.length > 0 ? t("home.featuredTitle") : t("home.newArrivalsTitle")}
          subtitle={featured.length > 0 ? t("home.featuredSubtitle") : t("home.newArrivalsSubtitle")}
          action={
            <Link href={`/${locale}/products`} className="inline-flex items-center gap-1.5 text-sm font-medium text-clay-dark hover:text-ink">
              {t("home.viewAll")} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        />
        {showcase.length > 0 ? (
          <ProductGrid>
            {showcase.map((product, index) => (
              <ProductCard key={product.id} product={product} locale={locale} t={t} priority={index < 2} />
            ))}
          </ProductGrid>
        ) : (
          <p className="rounded-[var(--radius-card)] border border-dashed border-stone bg-white/60 px-6 py-12 text-center text-muted">
            {t("home.emptyCatalog")}
          </p>
        )}
      </section>

      {categories.length > 0 ? (
        <section className="bg-cream/70 py-16 sm:py-20" aria-labelledby="collections-heading">
          <div className="container-page">
            <SectionHeading id="collections-heading" title={t("home.categoriesTitle")} subtitle={t("home.categoriesSubtitle")} />
            <ul className="flex flex-wrap gap-3">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/${locale}/products?category=${encodeURIComponent(category.slug)}`}
                    className="inline-flex items-center gap-2 rounded-full border border-stone bg-white px-5 py-3 text-sm text-ink shadow-[var(--shadow-soft)] transition-colors hover:border-clay hover:text-clay-dark"
                  >
                    {localized(category, "name", locale)}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {featured.length > 0 && newArrivals.length > 0 ? (
        <section className="container-page py-16 sm:py-24" aria-label={t("home.newArrivalsTitle")}>
          <SectionHeading title={t("home.newArrivalsTitle")} subtitle={t("home.newArrivalsSubtitle")} />
          <ProductGrid>
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} t={t} />
            ))}
          </ProductGrid>
        </section>
      ) : null}

      <Story t={t} />

      <section className="container-page py-16 sm:py-24">
        <div className="grid gap-6 lg:grid-cols-5">
          {settings.instagram_url ? (
            <div className="flex flex-col justify-between rounded-[var(--radius-card)] bg-ink p-8 text-ivory sm:p-10 lg:col-span-2">
              <div>
                <Instagram className="h-7 w-7 text-clay-soft" aria-hidden />
                <h2 className="mt-5 text-3xl">{t("home.instagramTitle")}</h2>
                <p className="mt-3 text-sm leading-relaxed text-ivory/75">{t("home.instagramText")}</p>
              </div>
              <a
                href={settings.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-ivory px-6 text-sm font-medium text-ink transition-colors hover:bg-clay-soft"
              >
                {t("home.instagramCta")} <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          ) : null}

          <div id="contact" className="scroll-mt-24 rounded-[var(--radius-card)] bg-white p-8 shadow-[var(--shadow-soft)] sm:p-10 lg:col-span-3">
            <h2 className="text-3xl text-ink">{t("home.infoTitle")}</h2>
            <dl className="mt-6 grid gap-6 sm:grid-cols-2">
              <InfoItem icon={<Truck className="h-5 w-5" aria-hidden />} title={t("home.deliveryTitle")}>
                {t("home.deliveryText")}
                {settings.free_delivery_threshold_amd ? (
                  <span className="mt-1 block">{t("cart.freeDeliveryFrom", { amount: formatAmd(settings.free_delivery_threshold_amd) })}</span>
                ) : null}
              </InfoItem>
              {pickup ? (
                <InfoItem icon={<MapPin className="h-5 w-5" aria-hidden />} title={t("home.pickupTitle")}>
                  {pickup}
                </InfoItem>
              ) : null}
              <InfoItem icon={<Phone className="h-5 w-5" aria-hidden />} title={t("home.contactTitle")}>
                <span className="block">{t("home.contactText")}</span>
                {settings.contact_phone ? (
                  <a className="mt-1 block font-medium text-ink hover:text-clay-dark" href={`tel:${settings.contact_phone.replace(/[^\d+]/g, "")}`}>
                    {settings.contact_phone}
                  </a>
                ) : null}
                {settings.contact_email ? (
                  <a className="mt-1 flex items-center gap-1.5 break-all text-ink hover:text-clay-dark" href={`mailto:${settings.contact_email}`}>
                    <Mail className="h-4 w-4 shrink-0" aria-hidden /> {settings.contact_email}
                  </a>
                ) : null}
                {settings.instagram_url ? (
                  <a className="mt-1 flex items-center gap-1.5 text-ink hover:text-clay-dark" href={settings.instagram_url} target="_blank" rel="noopener noreferrer">
                    <Instagram className="h-4 w-4" aria-hidden /> @gipse___
                  </a>
                ) : null}
              </InfoItem>
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}

function Hero({ locale, t, images }: { locale: Locale; t: StoreTranslator; images: { path: string; name: string }[] }) {
  return (
    <section className="plaster relative overflow-hidden border-b border-sand">
      <div className="container-page grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <div className="animate-fade-up">
          <p className="eyebrow">{t("home.heroEyebrow")}</p>
          <h1 className="mt-4 text-4xl leading-[1.08] text-ink sm:text-5xl lg:text-6xl">{t("home.heroTitle")}</h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{t("home.heroSubtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={`/${locale}/products`} size="lg">
              {t("home.heroCta")} <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href={`/${locale}#story`} size="lg" variant="outline">
              {t("home.heroSecondary")}
            </ButtonLink>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden={images.length === 0}>
          {images.length > 0 ? (
            <div className="grid grid-cols-5 grid-rows-6 gap-3 sm:gap-4" style={{ aspectRatio: "5 / 5.4" }}>
              <div className="relative col-span-3 row-span-6 overflow-hidden rounded-[var(--radius-card)] bg-sand shadow-[var(--shadow-lift)]">
                <ProductImage path={images[0]!.path} alt={images[0]!.name} sizes="(min-width: 1024px) 30vw, 60vw" priority />
              </div>
              {images.slice(1, 3).map((image) => (
                <div key={image.path} className="relative col-span-2 row-span-3 overflow-hidden rounded-[var(--radius-card)] bg-sand shadow-[var(--shadow-soft)]">
                  <ProductImage path={image.path} alt={image.name} sizes="(min-width: 1024px) 20vw, 40vw" />
                </div>
              ))}
              {images.length < 3
                ? Array.from({ length: 3 - images.length }, (_, i) => (
                    <div key={i} className="col-span-2 row-span-3 flex items-center justify-center rounded-[var(--radius-card)] bg-white/70">
                      <LogoMark className="h-12 w-12 opacity-70" />
                    </div>
                  ))
                : null}
            </div>
          ) : (
            <div className="flex aspect-[5/5.4] items-center justify-center rounded-[2rem] border border-white/80 bg-white/50 shadow-[var(--shadow-soft)]">
              <div className="text-center">
                <LogoMark className="mx-auto h-24 w-24" />
                <p className="mt-6 font-display text-4xl tracking-[0.3em] text-ink">GIPSE</p>
                <p className="mt-2 text-sm text-muted">{t("home.heroEyebrow")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Story({ t }: { t: StoreTranslator }) {
  const points = [
    { icon: Hand, title: t("home.pointHandmadeTitle"), text: t("home.pointHandmadeText") },
    { icon: Gift, title: t("home.pointGiftTitle"), text: t("home.pointGiftText") },
    { icon: Truck, title: t("home.pointDeliveryTitle"), text: t("home.pointDeliveryText") },
  ];
  return (
    <section id="story" className="scroll-mt-20 border-y border-sand bg-white py-16 sm:py-24" aria-labelledby="story-heading">
      <div className="container-page grid gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="eyebrow">{t("home.storyEyebrow")}</p>
          <h2 id="story-heading" className="mt-4 text-3xl text-ink sm:text-4xl">
            {t("home.storyTitle")}
          </h2>
          <p className="mt-6 leading-relaxed text-muted">{t("home.storyP1")}</p>
          <p className="mt-4 leading-relaxed text-muted">{t("home.storyP2")}</p>
        </div>
        <ul className="grid content-center gap-4">
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4 rounded-2xl bg-cream/70 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-clay">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block font-medium text-ink">{title}</span>
                <span className="mt-0.5 block text-sm text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function InfoItem({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clay-soft text-clay-dark">{icon}</span>
      <div className="min-w-0">
        <dt className="font-medium text-ink">{title}</dt>
        <dd className="mt-1 text-sm leading-relaxed text-muted">{children}</dd>
      </div>
    </div>
  );
}
