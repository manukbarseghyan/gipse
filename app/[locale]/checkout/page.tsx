import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { isLocale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/messages";

export async function generateMetadata({ params }: PageProps<"/[locale]/checkout">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getTranslator(locale)("meta.checkoutTitle"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params }: PageProps<"/[locale]/checkout">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getTranslator(locale);
  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="mb-8 text-4xl text-ink sm:text-5xl">{t("checkout.title")}</h1>
      <CheckoutForm />
    </div>
  );
}
