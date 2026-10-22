"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { deleteProductAction, setProductAvailabilityAction } from "@/lib/actions/admin";

/** Two-step inline confirmation (no blocking browser dialogs). */
export function DeleteProductButton({ productId }: { productId: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" className="text-rose hover:bg-rose-soft" onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" aria-hidden /> {t("common.delete")}
      </Button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-rose/30 bg-rose-soft p-4 text-sm" role="alertdialog" aria-labelledby="delete-title">
      <p id="delete-title" className="font-medium text-rose">{t("productForm.deleteTitle")}</p>
      <p className="mt-1 text-ink">{t("productForm.deleteText")}</p>
      {error ? <Notice tone="error" className="mt-3">{t("common.error")}</Notice> : null}
      <div className="mt-3 flex gap-2">
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteProductAction(productId);
              if (result.ok) router.push("/admin/products?deleted=1");
              else setError(true);
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
          {pending ? t("common.deleting") : t("common.delete")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

export function AvailabilityToggle({ productId, isAvailable }: { productId: string; isAvailable: boolean }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setProductAvailabilityAction(productId, !isAvailable);
          router.refresh();
        })
      }
      className="text-xs font-medium text-clay-dark underline-offset-4 hover:underline disabled:opacity-50"
    >
      {pending ? t("common.saving") : isAvailable ? t("products.makeUnavailable") : t("products.makeAvailable")}
    </button>
  );
}
