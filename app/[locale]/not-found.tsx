"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { ButtonLink } from "@/components/ui/button";

export default function LocaleNotFound() {
  const { locale, t } = useI18n();
  return (
    <div className="container-page flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-4xl text-ink">{t("errors.notFoundTitle")}</h1>
      <p className="mt-3 max-w-md text-muted">{t("errors.notFoundText")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href={`/${locale}/products`}>{t("product.backToCatalog")}</ButtonLink>
        <ButtonLink href={`/${locale}`} variant="outline">
          {t("errors.backHome")}
        </ButtonLink>
      </div>
    </div>
  );
}
