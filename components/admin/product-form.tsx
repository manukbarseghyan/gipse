"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { ImageUploader } from "@/components/admin/image-uploader";
import { Card } from "@/components/admin/admin-ui";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { discardUploadsAction, saveProductAction } from "@/lib/actions/admin";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";

export type ProductFormValues = {
  slug: string;
  name_hy: string;
  name_ru: string;
  name_en: string;
  description_hy: string;
  description_ru: string;
  description_en: string;
  price_amd: string;
  category_id: string;
  stock_quantity: string;
  is_available: boolean;
  is_featured: boolean;
  is_published: boolean;
  images: string[];
};

export const emptyProductForm: ProductFormValues = {
  slug: "",
  name_hy: "",
  name_ru: "",
  name_en: "",
  description_hy: "",
  description_ru: "",
  description_en: "",
  price_amd: "",
  category_id: "",
  stock_quantity: "",
  is_available: true,
  is_featured: false,
  is_published: true,
  images: [],
};

/** Converts form strings to the typed payload the server validates. */
export function toProductPayload(values: ProductFormValues) {
  const toInt = (value: string) => (value.trim() === "" ? null : Number(value.trim()));
  return {
    slug: values.slug.trim(),
    name_hy: values.name_hy,
    name_ru: values.name_ru,
    name_en: values.name_en,
    description_hy: values.description_hy,
    description_ru: values.description_ru,
    description_en: values.description_en,
    price_amd: toInt(values.price_amd) ?? Number.NaN,
    category_id: values.category_id || null,
    stock_quantity: toInt(values.stock_quantity),
    is_available: values.is_available,
    is_featured: values.is_featured,
    is_published: values.is_published,
    images: values.images,
  };
}

type Category = { id: string; name: string };
type Lang = "hy" | "ru" | "en";

export function ProductForm({ productId, initial, categories }: { productId: string | null; initial: ProductFormValues; categories: Category[] }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [lang, setLang] = useState<Lang>("hy");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const sessionUploads = useRef(new Set<string>());
  const slugTouched = useRef(Boolean(initial.slug));

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const errorText = (key: string) => {
    const code = errors[key];
    if (!code) return undefined;
    if (code === "slugTaken") return t("productForm.slugTaken");
    return t.dynamic(`productForm.errors.${code}`, t("productForm.errors.invalid"));
  };

  function onNameHyChange(value: string) {
    set("name_hy", value);
    if (!slugTouched.current && !productId) set("slug", slugify(values.name_en || value));
  }

  function onImagesChange(next: string[]) {
    // Images uploaded in this session and removed again are deleted right away.
    const dropped = values.images.filter((path) => !next.includes(path) && sessionUploads.current.has(path));
    if (dropped.length) {
      dropped.forEach((path) => sessionUploads.current.delete(path));
      void discardUploadsAction(dropped);
    }
    set("images", next);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setErrors({});
    startTransition(async () => {
      const result = await saveProductAction(productId, toProductPayload(values));
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        const descriptionError = Object.keys(result.fieldErrors ?? {}).find((k) => k.startsWith("description_") || k.startsWith("name_"));
        if (descriptionError) setLang(descriptionError.slice(-2) as Lang);
        setMessage({
          tone: "error",
          text: result.error === "forbidden" ? t("common.forbidden") : result.error === "conflict" ? t("productForm.slugTaken") : t("common.error"),
        });
        return;
      }
      sessionUploads.current.clear();
      if (!productId) {
        router.push(`/admin/products/${result.data.id}?created=1`);
      } else {
        setMessage({ tone: "success", text: t("productForm.saved") });
        router.refresh();
      }
    });
  }

  const langTabs: { code: Lang; label: string }[] = [
    { code: "hy", label: "Հայերեն" },
    { code: "ru", label: "Русский" },
    { code: "en", label: "English" },
  ];

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {message ? (
          <Notice tone={message.tone} role={message.tone === "error" ? "alert" : "status"}>
            {message.text}
          </Notice>
        ) : null}

        <Card>
          <h2 className="mb-4 text-xl text-ink">{t("productForm.basics")}</h2>
          <div role="tablist" aria-label="Language" className="mb-5 inline-flex rounded-full bg-cream p-1">
            {langTabs.map((tab) => {
              const hasError = Boolean(errors[`name_${tab.code}`] || errors[`description_${tab.code}`]);
              return (
                <button
                  key={tab.code}
                  type="button"
                  role="tab"
                  aria-selected={lang === tab.code}
                  aria-controls={`panel-${tab.code}`}
                  onClick={() => setLang(tab.code)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm transition-colors",
                    lang === tab.code ? "bg-white font-medium text-ink shadow-sm" : "text-muted hover:text-ink",
                    hasError && "text-rose",
                  )}
                >
                  {tab.label}
                  {tab.code === "hy" ? " *" : ""}
                </button>
              );
            })}
          </div>

          {langTabs.map((tab) => (
            <div key={tab.code} id={`panel-${tab.code}`} role="tabpanel" hidden={lang !== tab.code} className="space-y-5">
              <Field
                id={`name_${tab.code}`}
                label={t(`productForm.name${tab.code === "hy" ? "Hy" : tab.code === "ru" ? "Ru" : "En"}`)}
                optionalLabel={tab.code === "hy" ? undefined : t("common.optional")}
                error={errorText(`name_${tab.code}`)}
              >
                <Input
                  id={`name_${tab.code}`}
                  value={values[`name_${tab.code}`]}
                  maxLength={160}
                  aria-invalid={Boolean(errors[`name_${tab.code}`])}
                  onChange={(e) => (tab.code === "hy" ? onNameHyChange(e.target.value) : set(`name_${tab.code}`, e.target.value))}
                />
              </Field>
              <Field
                id={`description_${tab.code}`}
                label={t(`productForm.description${tab.code === "hy" ? "Hy" : tab.code === "ru" ? "Ru" : "En"}`)}
                optionalLabel={t("common.optional")}
                error={errorText(`description_${tab.code}`)}
              >
                <Textarea
                  id={`description_${tab.code}`}
                  rows={6}
                  maxLength={5000}
                  value={values[`description_${tab.code}`]}
                  onChange={(e) => set(`description_${tab.code}`, e.target.value)}
                />
              </Field>
            </div>
          ))}
          <p className="mt-3 text-xs text-muted">{t("productForm.translationHint")}</p>
        </Card>

        <Card>
          <h2 className="mb-1 text-xl text-ink">{t("productForm.images")}</h2>
          <p className="mb-4 text-sm text-muted">{t("productForm.imagesHint")}</p>
          <ImageUploader
            value={values.images}
            onChange={onImagesChange}
            onUploaded={(paths) => paths.forEach((path) => sessionUploads.current.add(path))}
          />
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <div className="space-y-5">
            <Field id="price_amd" label={t("productForm.price")} hint={t("productForm.priceHint")} error={errorText("price_amd")}>
              <Input
                id="price_amd"
                inputMode="numeric"
                pattern="[0-9]*"
                value={values.price_amd}
                aria-invalid={Boolean(errors.price_amd)}
                onChange={(e) => set("price_amd", e.target.value.replace(/[^\d]/g, ""))}
              />
            </Field>
            <Field id="category_id" label={t("productForm.category")}>
              <Select id="category_id" value={values.category_id} onChange={(e) => set("category_id", e.target.value)}>
                <option value="">{t("productForm.noCategory")}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="stock_quantity" label={t("productForm.stock")} optionalLabel={t("common.optional")} hint={t("productForm.stockHint")} error={errorText("stock_quantity")}>
              <Input
                id="stock_quantity"
                inputMode="numeric"
                pattern="[0-9]*"
                value={values.stock_quantity}
                aria-invalid={Boolean(errors.stock_quantity)}
                onChange={(e) => set("stock_quantity", e.target.value.replace(/[^\d]/g, ""))}
              />
            </Field>
            <Field id="slug" label={t("productForm.slug")} hint={t("productForm.slugHint").replace("{slug}", values.slug || "…")} error={errorText("slug")}>
              <div className="flex gap-2">
                <Input
                  id="slug"
                  value={values.slug}
                  maxLength={120}
                  aria-invalid={Boolean(errors.slug)}
                  onChange={(e) => {
                    slugTouched.current = true;
                    set("slug", e.target.value.toLowerCase());
                  }}
                />
                <button
                  type="button"
                  className={buttonClasses("outline", "icon", "shrink-0 rounded-xl")}
                  aria-label={t("productForm.generateSlug")}
                  title={t("productForm.generateSlug")}
                  onClick={() => set("slug", slugify(values.name_en || values.name_hy || values.name_ru))}
                >
                  <Wand2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl text-ink">{t("productForm.visibility")}</h2>
          <div className="space-y-4">
            <Toggle id="is_published" checked={values.is_published} onChange={(v) => set("is_published", v)} label={t("productForm.isPublished")} hint={t("productForm.isPublishedHint")} />
            <Toggle id="is_available" checked={values.is_available} onChange={(v) => set("is_available", v)} label={t("productForm.isAvailable")} hint={t("productForm.isAvailableHint")} />
            <Toggle id="is_featured" checked={values.is_featured} onChange={(v) => set("is_featured", v)} label={t("productForm.isFeatured")} />
          </div>
        </Card>

        <button type="submit" disabled={pending} className={buttonClasses("primary", "lg", "w-full")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {pending ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </form>
  );
}

function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-stone transition-colors peer-checked:bg-sage peer-focus-visible:ring-2 peer-focus-visible:ring-clay/40" />
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
