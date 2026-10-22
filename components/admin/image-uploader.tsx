"use client";

import { useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { ProductImage } from "@/components/product/product-image";
import { getBrowserClient } from "@/lib/supabase/browser";
import { PRODUCT_IMAGE_BUCKET } from "@/lib/env";
import { MAX_PRODUCT_IMAGES } from "@/lib/validation/admin";
import { cn } from "@/lib/utils";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Client-side checks mirror the bucket's server-enforced limits (5 MB, image MIME types). */
export function validateImageFile(file: { type: string; size: number }): "ok" | "type" | "size" {
  if (!(file.type in EXTENSIONS)) return "type";
  if (file.size > MAX_IMAGE_BYTES) return "size";
  return "ok";
}

type Props = {
  value: string[];
  onChange: (paths: string[]) => void;
  /** Paths uploaded during this session (so they can be cleaned up if discarded). */
  onUploaded: (paths: string[]) => void;
};

/**
 * Uploads directly from the browser to Supabase Storage with the admin's own
 * session; Storage policies only allow admins to write to products/. Unique
 * random filenames prevent collisions and overwrites.
 */
export function ImageUploader({ value, onChange, onUploaded }: Props) {
  const { t } = useAdminI18n();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const supabase = getBrowserClient();
    const nextErrors: string[] = [];
    const room = MAX_PRODUCT_IMAGES - value.length;
    const selected = Array.from(files);
    if (selected.length > room) nextErrors.push(t("productForm.tooManyImages", { max: MAX_PRODUCT_IMAGES }));

    const accepted = selected.slice(0, Math.max(0, room)).filter((file) => {
      const check = validateImageFile(file);
      if (check === "type") nextErrors.push(t("productForm.fileWrongType", { name: file.name }));
      if (check === "size") nextErrors.push(t("productForm.fileTooLarge", { name: file.name }));
      return check === "ok";
    });

    if (!supabase) {
      setErrors([...nextErrors, t("common.error")]);
      return;
    }

    setUploading((n) => n + accepted.length);
    const uploaded: string[] = [];
    await Promise.all(
      accepted.map(async (file) => {
        const path = `products/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
        const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, file, {
          contentType: file.type,
          cacheControl: "31536000",
          upsert: false,
        });
        if (error) nextErrors.push(t("productForm.uploadFailed", { name: file.name }));
        else uploaded.push(path);
        setUploading((n) => n - 1);
      }),
    );

    if (uploaded.length) {
      onUploaded(uploaded);
      onChange([...value, ...uploaded]);
    }
    setErrors(nextErrors);
    if (inputRef.current) inputRef.current.value = "";
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...value];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((path, index) => (
          <li key={path} className="group relative aspect-square overflow-hidden rounded-xl border border-sand bg-cream">
            <ProductImage path={path} alt="" sizes="200px" />
            {index === 0 ? (
              <span className="absolute top-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-medium text-ivory">
                {t("productForm.mainImage")}
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-ink/60 to-transparent p-2">
              <div className="flex gap-1">
                <IconButton label={t("productForm.moveLeft")} onClick={() => move(index, -1)} disabled={index === 0}>
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                </IconButton>
                <IconButton label={t("productForm.moveRight")} onClick={() => move(index, 1)} disabled={index === value.length - 1}>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </IconButton>
              </div>
              <IconButton label={t("productForm.removeImage")} onClick={() => onChange(value.filter((p) => p !== path))} danger>
                <X className="h-3.5 w-3.5" aria-hidden />
              </IconButton>
            </div>
          </li>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <li key={`uploading-${i}`} className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-stone bg-white">
            <Loader2 className="h-5 w-5 animate-spin text-taupe" aria-label={t("productForm.uploading")} />
          </li>
        ))}
        {value.length + uploading < MAX_PRODUCT_IMAGES ? (
          <li>
            <label
              htmlFor={inputId}
              className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone bg-white text-sm text-muted transition-colors hover:border-clay hover:text-clay-dark has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-clay/30"
            >
              <ImagePlus className="h-6 w-6" aria-hidden />
              {t("productForm.upload")}
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                className="sr-only"
                onChange={(event) => void handleFiles(event.target.files)}
              />
            </label>
          </li>
        ) : null}
      </ul>
      {errors.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-rose" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm disabled:opacity-40",
        danger ? "hover:bg-rose hover:text-white" : "hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}
