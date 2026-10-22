import Image from "next/image";
import { LogoMark } from "@/components/brand/wordmark";
import { productImageUrl } from "@/lib/env";
import { cn } from "@/lib/utils";

type Props = {
  path: string | null | undefined;
  alt: string;
  sizes: string;
  /** Preload as the likely Largest Contentful Paint image. */
  priority?: boolean;
  className?: string;
  placeholderLabel?: string;
};

/** Product photo from Supabase Storage, or a branded placeholder when there is none. */
export function ProductImage({ path, alt, sizes, priority, className, placeholderLabel }: Props) {
  const src = path ? productImageUrl(path) : null;

  if (!src) {
    return (
      <div className={cn("plaster flex h-full w-full flex-col items-center justify-center gap-2 text-taupe", className)}>
        <LogoMark className="h-12 w-12 opacity-80" />
        {placeholderLabel ? <span className="text-xs tracking-wide">{placeholderLabel}</span> : <span className="sr-only">{alt}</span>}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      preload={priority}
      className={cn("object-cover", className)}
    />
  );
}
