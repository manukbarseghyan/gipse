import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-xl border border-stone bg-white px-4 text-base text-ink placeholder:text-taupe transition-colors focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20 aria-invalid:border-rose aria-invalid:ring-rose/15 disabled:bg-cream";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 py-3", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldBase, "h-12 appearance-none pr-10", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-ink", className)} {...props} />;
}

type FieldProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optionalLabel?: string;
  children: ReactNode;
  className?: string;
};

/** Label + control + hint/error, wired with ids for aria-describedby. */
export function Field({ id, label, hint, error, optionalLabel, children, className }: FieldProps) {
  return (
    <div className={className}>
      <Label htmlFor={id}>
        {label}
        {optionalLabel ? <span className="ml-1.5 font-normal text-muted">({optionalLabel})</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-rose">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, error?: string, hint?: unknown): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
