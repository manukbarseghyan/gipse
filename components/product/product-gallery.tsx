"use client";

import { useState } from "react";
import { ProductImage } from "@/components/product/product-image";
import { useI18n } from "@/components/i18n/i18n-provider";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, name, dimmed }: { images: string[]; name: string; dimmed?: boolean }) {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const current = images[active] ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] bg-cream shadow-[var(--shadow-soft)] sm:aspect-[4/5]">
        <ProductImage
          path={current}
          alt={current ? t("product.photo", { name, index: active + 1 }) : name}
          sizes="(min-width: 1024px) 50vw, 100vw"
          priority
          className={cn(dimmed && "opacity-70 grayscale-[30%]")}
          placeholderLabel={t("product.noPhoto")}
        />
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {images.map((path, index) => (
            <li key={path} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={t("product.showPhoto", { index: index + 1 })}
                aria-pressed={index === active}
                className={cn(
                  "relative block h-20 w-20 overflow-hidden rounded-xl border-2 bg-cream transition-colors",
                  index === active ? "border-ink" : "border-transparent hover:border-stone",
                )}
              >
                <ProductImage path={path} alt="" sizes="80px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
