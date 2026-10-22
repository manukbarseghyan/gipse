"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { deleteCategoryAction, saveCategoryAction } from "@/lib/actions/admin";
import { slugify } from "@/lib/slug";

type Category = { id: string; slug: string; name_hy: string; name_ru: string | null; name_en: string | null; sort_order: number; productCount: number };
type Draft = { slug: string; name_hy: string; name_ru: string; name_en: string; sort_order: string };

const toDraft = (c?: Category): Draft => ({
  slug: c?.slug ?? "",
  name_hy: c?.name_hy ?? "",
  name_ru: c?.name_ru ?? "",
  name_en: c?.name_en ?? "",
  sort_order: String(c?.sort_order ?? 0),
});

export function CategoryManager({ categories }: { categories: Category[] }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open(target: Category | "new") {
    setEditing(target === "new" ? "new" : target.id);
    setDraft(toDraft(target === "new" ? undefined : target));
    setErrors({});
    setMessage(null);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const id = editing === "new" ? null : editing;
    startTransition(async () => {
      const result = await saveCategoryAction(id, { ...draft, sort_order: Number.parseInt(draft.sort_order || "0", 10) || 0 });
      if (result.ok) {
        setMessage({ tone: "success", text: id ? t("categories.saved") : t("categories.created") });
        setEditing(null);
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage({ tone: "error", text: result.error === "conflict" ? t("categories.slugTaken") : result.error === "forbidden" ? t("common.forbidden") : t("common.error") });
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteCategoryAction(id);
      setConfirmDelete(null);
      setMessage(result.ok ? { tone: "success", text: t("categories.deleted") } : { tone: "error", text: t("common.error") });
      router.refresh();
    });
  }

  const err = (key: string) => (errors[key] ? (errors[key] === "slugTaken" ? t("categories.slugTaken") : t.dynamic(`productForm.errors.${errors[key]}`, t("productForm.errors.invalid"))) : undefined);

  const form = (
    <form onSubmit={save} className="grid gap-4 rounded-2xl bg-cream/60 p-4 sm:grid-cols-2">
      <Field id="cat-name-hy" label={t("categories.nameHy")} error={err("name_hy")}>
        <Input
          id="cat-name-hy"
          value={draft.name_hy}
          onChange={(e) => setDraft((d) => ({ ...d, name_hy: e.target.value, slug: editing === "new" && !d.name_en ? slugify(e.target.value) : d.slug }))}
        />
      </Field>
      <Field id="cat-slug" label={t("categories.slug")} error={err("slug")}>
        <Input id="cat-slug" value={draft.slug} onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value.toLowerCase() }))} />
      </Field>
      <Field id="cat-name-ru" label={t("categories.nameRu")} optionalLabel={t("common.optional")} error={err("name_ru")}>
        <Input id="cat-name-ru" value={draft.name_ru} onChange={(e) => setDraft((d) => ({ ...d, name_ru: e.target.value }))} />
      </Field>
      <Field id="cat-name-en" label={t("categories.nameEn")} optionalLabel={t("common.optional")} error={err("name_en")}>
        <Input
          id="cat-name-en"
          value={draft.name_en}
          onChange={(e) => setDraft((d) => ({ ...d, name_en: e.target.value, slug: editing === "new" && e.target.value ? slugify(e.target.value) : d.slug }))}
        />
      </Field>
      <Field id="cat-order" label={t("categories.sortOrder")}>
        <Input id="cat-order" inputMode="numeric" value={draft.sort_order} onChange={(e) => setDraft((d) => ({ ...d, sort_order: e.target.value.replace(/[^\d-]/g, "") }))} />
      </Field>
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("common.save")}
        </Button>
        <Button variant="ghost" onClick={() => setEditing(null)}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      {message ? <Notice tone={message.tone} role={message.tone === "error" ? "alert" : "status"}>{message.text}</Notice> : null}

      {editing === "new" ? form : (
        <Button onClick={() => open("new")}>
          <Plus className="h-4 w-4" aria-hidden /> {t("categories.new")}
        </Button>
      )}

      {categories.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-muted shadow-[var(--shadow-soft)]">{t("categories.empty")}</p>
      ) : (
        <ul className="divide-y divide-sand overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-soft)]">
          {categories.map((category) => (
            <li key={category.id} className="p-4">
              {editing === category.id ? (
                form
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{category.name_hy}</p>
                    <p className="text-xs text-muted">
                      {[category.name_ru, category.name_en].filter(Boolean).join(" · ") || "—"} · /{category.slug} · {t("categories.products")}: {category.productCount}
                    </p>
                  </div>
                  {confirmDelete === category.id ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm" role="alertdialog" aria-label={t("common.delete")}>
                      <span className="text-rose">{t("categories.deleteConfirm")}</span>
                      <Button size="sm" variant="danger" disabled={pending} onClick={() => remove(category.id)}>{t("common.delete")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>{t("common.cancel")}</Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => open(category)}>
                        <Pencil className="h-4 w-4" aria-hidden /> {t("common.edit")}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-rose hover:bg-rose-soft" onClick={() => setConfirmDelete(category.id)}>
                        <Trash2 className="h-4 w-4" aria-hidden /> {t("common.delete")}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
