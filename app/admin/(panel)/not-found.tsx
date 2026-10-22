"use client";

import Link from "next/link";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { buttonClasses } from "@/components/ui/button";

export default function AdminNotFound() {
  const { t } = useAdminI18n();
  return (
    <div className="rounded-2xl bg-white p-8 text-center shadow-[var(--shadow-soft)]">
      <p className="text-ink">{t("common.notFound")}</p>
      <Link href="/admin" className={buttonClasses("outline", "md", "mt-6")}>
        {t("nav.dashboard")}
      </Link>
    </div>
  );
}
