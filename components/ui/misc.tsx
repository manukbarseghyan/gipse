import type { ComponentProps, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "danger" | "accent" | "warning";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-cream text-muted",
  success: "bg-sage-soft text-sage",
  danger: "bg-rose-soft text-rose",
  accent: "bg-clay-soft text-clay-dark",
  warning: "bg-amber-50 text-amber-800",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", badgeTones[tone], className)}
      {...props}
    />
  );
}

const noticeStyles: Record<"info" | "success" | "error", { box: string; Icon: typeof Info }> = {
  info: { box: "border-stone bg-cream text-ink", Icon: Info },
  success: { box: "border-sage/30 bg-sage-soft text-sage", Icon: CheckCircle2 },
  error: { box: "border-rose/30 bg-rose-soft text-rose", Icon: AlertCircle },
};

export function Notice({
  tone = "info",
  children,
  className,
  role,
}: {
  tone?: "info" | "success" | "error";
  children: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const { box, Icon } = noticeStyles[tone];
  return (
    <div role={role} className={cn("flex gap-3 rounded-2xl border px-4 py-3 text-sm", box, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-sand/70", className)} />;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  as: Tag = "h2",
  id,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  as?: "h1" | "h2";
  id?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
        <Tag id={id} className="text-3xl text-ink sm:text-4xl">{title}</Tag>
        {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
