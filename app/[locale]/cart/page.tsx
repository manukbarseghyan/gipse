import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartView } from "@/components/cart/cart-view";
import { isLocale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/messages";

export async function generateMetadata({ params }: PageProps<"/[locale]/cart">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getTranslator(locale)("meta.cartTitle"), robots: { index: false, follow: true } };
}

export default async function CartPage({ params }: PageProps<"/[locale]/cart">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getTranslator(locale);
  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="mb-8 text-4xl text-ink sm:text-5xl">{t("cart.title")}</h1>
      <CartView />
    </div>
  );
}
