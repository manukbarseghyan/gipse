import { cn } from "@/lib/utils";

/**
 * GIPSE wordmark: wide-tracked serif capitals with a small plaster "drop"
 * mark. Pure SVG + text, so it stays crisp and needs no image asset.
 */
export function Wordmark({ className, withMark = true }: { className?: string; withMark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-ink", className)}>
      {withMark ? <LogoMark className="h-7 w-7" /> : null}
      <span className="font-display text-[1.6rem] leading-none font-medium tracking-[0.28em]">GIPSE</span>
    </span>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <circle cx="16" cy="16" r="15" fill="var(--color-accent-soft)" />
      <path
        d="M16 6.5c3.6 4.2 6.5 8 6.5 11.6a6.5 6.5 0 0 1-13 0c0-3.6 2.9-7.4 6.5-11.6Z"
        fill="var(--color-ivory)"
        stroke="var(--color-accent)"
        strokeWidth="1.4"
      />
      <path d="M13.2 19.2a3 3 0 0 0 2.8 2.3" fill="none" stroke="var(--color-accent)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
