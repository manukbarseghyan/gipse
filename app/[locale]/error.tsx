"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button, ButtonLink } from "@/components/ui/button";

export default function LocaleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { locale, t } = useI18n();

  useEffect(() => {
    // Only the digest is logged; the message may contain internal details.
    console.error("[storefront] render error", error.digest);
  }, [error]);

  return (
    <div className="container-page flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="text-4xl text-ink">{t("errors.title")}</h1>
      <p className="mt-3 max-w-md text-muted">{t("errors.text")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>{t("errors.retry")}</Button>
        <ButtonLink href={`/${locale}`} variant="outline">
          {t("errors.backHome")}
        </ButtonLink>
      </div>
    </div>
  );
}
