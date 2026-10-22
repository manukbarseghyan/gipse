import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import type { AdminTranslator } from "@/lib/i18n/admin";
import type { OrderStatus, PaymentStatus } from "@/types/database";

const orderTone: Record<OrderStatus, "accent" | "neutral" | "success" | "danger" | "warning"> = {
  new: "accent",
  confirmed: "warning",
  preparing: "warning",
  out_for_delivery: "warning",
  completed: "success",
  cancelled: "danger",
};

const paymentTone: Record<PaymentStatus, "neutral" | "success" | "danger"> = {
  pending: "neutral",
  paid: "success",
  failed: "danger",
  refunded: "neutral",
};

export function OrderStatusBadge({ status, t }: { status: OrderStatus; t: AdminTranslator }) {
  return <Badge tone={orderTone[status]}>{t.dynamic(`orderStatus.${status}`)}</Badge>;
}

export function PaymentStatusBadge({ status, t }: { status: PaymentStatus; t: AdminTranslator }) {
  return <Badge tone={paymentTone[status]}>{t.dynamic(`paymentStatus.${status}`)}</Badge>;
}

export function AdminPageHeader({ title, actions, back }: { title: string; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {back ? (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            <ChevronLeft className="h-4 w-4" aria-hidden /> {back.label}
          </Link>
        ) : null}
        <h1 className="text-3xl text-ink">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6 ${className}`}>{children}</div>;
}

export function AdminPagination({
  page,
  pageCount,
  hrefFor,
  t,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  t: AdminTranslator;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonClasses("outline", "sm")}>
          <ChevronLeft className="h-4 w-4" aria-hidden /> {t("common.previous")}
        </Link>
      ) : null}
      <span className="text-sm text-muted">{t("common.pageOf", { page, total: pageCount })}</span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={buttonClasses("outline", "sm")}>
          {t("common.next")} <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}

export function buildQuery(base: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && !(key === "page" && value === 1)) query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}
