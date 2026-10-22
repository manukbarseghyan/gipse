"use client";

import { useEffect } from "react";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useAdminI18n();
  useEffect(() => {
    console.error("[admin] render error", error.digest);
  }, [error]);
  return (
    <div className="rounded-2xl bg-white p-8 text-center shadow-[var(--shadow-soft)]">
      <p className="text-ink">{t("common.error")}</p>
      <Button className="mt-6" onClick={() => retry()}>
        {t("common.back")}
      </Button>
    </div>
  );
}
