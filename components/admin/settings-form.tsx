"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { Card } from "@/components/admin/admin-ui";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { saveSettingsAction } from "@/lib/actions/admin";

export type SettingsFormValues = {
  delivery_fee_amd: string;
  free_delivery_threshold_amd: string;
  contact_phone: string;
  contact_email: string;
  instagram_url: string;
  facebook_url: string;
  pickup_location_hy: string;
  pickup_location_ru: string;
  pickup_location_en: string;
};

export function SettingsForm({ initial }: { initial: SettingsFormValues }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof SettingsFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const err = (key: string) => (errors[key] ? t.dynamic(`settings.${errors[key]}`, t("productForm.errors.invalid")) : undefined);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setErrors({});
    const toInt = (value: string) => (value.trim() === "" ? null : Number(value));
    startTransition(async () => {
      const result = await saveSettingsAction({
        ...values,
        delivery_fee_amd: toInt(values.delivery_fee_amd) ?? 0,
        free_delivery_threshold_amd: toInt(values.free_delivery_threshold_amd),
      });
      if (result.ok) {
        setMessage({ tone: "success", text: t("settings.saved") });
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage({ tone: "error", text: result.error === "forbidden" ? t("common.forbidden") : t("common.error") });
      }
    });
  }

  const numeric = (key: "delivery_fee_amd" | "free_delivery_threshold_amd") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value.replace(/[^\d]/g, "") }));

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-6">
      {message ? <Notice tone={message.tone} role={message.tone === "error" ? "alert" : "status"}>{message.text}</Notice> : null}
      <Card>
        <h2 className="mb-4 text-xl text-ink">{t("settings.delivery")}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="delivery_fee_amd" label={t("settings.deliveryFee")} hint={t("settings.deliveryFeeHint")} error={err("delivery_fee_amd")}>
            <Input id="delivery_fee_amd" inputMode="numeric" value={values.delivery_fee_amd} onChange={numeric("delivery_fee_amd")} />
          </Field>
          <Field id="free_delivery_threshold_amd" label={t("settings.freeThreshold")} optionalLabel={t("common.optional")} hint={t("settings.freeThresholdHint")} error={err("free_delivery_threshold_amd")}>
            <Input id="free_delivery_threshold_amd" inputMode="numeric" value={values.free_delivery_threshold_amd} onChange={numeric("free_delivery_threshold_amd")} />
          </Field>
        </div>
      </Card>
      <Card>
        <h2 className="mb-4 text-xl text-ink">{t("settings.contact")}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="contact_phone" label={t("settings.phone")} optionalLabel={t("common.optional")} error={err("contact_phone")}>
            <Input id="contact_phone" type="tel" value={values.contact_phone} onChange={set("contact_phone")} />
          </Field>
          <Field id="contact_email" label={t("settings.email")} optionalLabel={t("common.optional")} error={err("contact_email")}>
            <Input id="contact_email" type="email" value={values.contact_email} onChange={set("contact_email")} />
          </Field>
          <Field id="instagram_url" label={t("settings.instagram")} optionalLabel={t("common.optional")} error={err("instagram_url")}>
            <Input id="instagram_url" type="url" value={values.instagram_url} onChange={set("instagram_url")} />
          </Field>
          <Field id="facebook_url" label={t("settings.facebook")} optionalLabel={t("common.optional")} error={err("facebook_url")}>
            <Input id="facebook_url" type="url" value={values.facebook_url} onChange={set("facebook_url")} />
          </Field>
          <Field id="pickup_location_hy" label={t("settings.pickupHy")} optionalLabel={t("common.optional")}>
            <Input id="pickup_location_hy" value={values.pickup_location_hy} onChange={set("pickup_location_hy")} />
          </Field>
          <Field id="pickup_location_ru" label={t("settings.pickupRu")} optionalLabel={t("common.optional")}>
            <Input id="pickup_location_ru" value={values.pickup_location_ru} onChange={set("pickup_location_ru")} />
          </Field>
          <Field id="pickup_location_en" label={t("settings.pickupEn")} optionalLabel={t("common.optional")}>
            <Input id="pickup_location_en" value={values.pickup_location_en} onChange={set("pickup_location_en")} />
          </Field>
        </div>
      </Card>
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}
