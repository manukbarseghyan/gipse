import Image from "next/image";
import { cn } from "@/lib/utils";

// The logo artwork (figurines + «Գիպսե» lettering) lives in public/logo.svg.
// Its viewBox is 992×568, so size it by height and let the width follow.
const LOGO_WIDTH = 992;
const LOGO_HEIGHT = 568;

/**
 * Full GIPSE logo; doubles as the brand name for screen readers.
 * `compact` uses public/logo-header.webp (448px wide, ~59 KB instead of the
 * 588 KB SVG) for small, always-visible spots like the header. Its intrinsic
 * size matches the largest header height (64px) so next/image only builds
 * 1x/2x variants of that size.
 */
export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return compact ? (
    <Image
      src="/logo-header.webp"
      alt="GIPSE"
      width={112}
      height={64}
      loading="eager"
      className={cn("h-12 w-auto", className)}
    />
  ) : (
    <Image
      src="/logo.svg"
      alt="GIPSE"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      className={cn("h-12 w-auto", className)}
    />
  );
}

/** Decorative logo used in placeholders; hidden from assistive tech. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.svg"
      alt=""
      aria-hidden
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      className={cn("h-12 w-auto", className)}
    />
  );
}
