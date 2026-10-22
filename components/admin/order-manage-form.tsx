"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { updateOrderAction } from "@/lib/actions/admin";
import { orderStatusValues, paymentStatusValues, type OrderUpdateInput } from "@/lib/validation/admin";

export function OrderManageForm({ orderId, initial }: { orderId: string; initial: Required<Pick<OrderUpdateInput, "order_status" | "payment_status">> & { admin_note: string } }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    values.order_status !== initial.order_status || values.payment_status !== initial.payment_status || values.admin_note !== initial.admin_note;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateOrderAction(orderId, values);
      if (result.ok) {
        setMessage({ tone: "success", text: t("orders.updated") });
        router.refresh();
      } else {
        setMessage({ tone: "error", text: result.error === "forbidden" ? t("common.forbidden") : t("common.error") });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="order_status" label={t("orders.orderStatus")}>
        <Select
          id="order_status"
          value={values.order_status}
          onChange={(e) => setValues((v) => ({ ...v, order_status: e.target.value as typeof v.order_status }))}
        >
          {orderStatusValues.map((status) => (
            <option key={status} value={status}>
              {t.dynamic(`orderStatus.${status}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="payment_status" label={t("orders.paymentStatus")}>
        <Select
          id="payment_status"
          value={values.payment_status}
          onChange={(e) => setValues((v) => ({ ...v, payment_status: e.target.value as typeof v.payment_status }))}
        >
          {paymentStatusValues.map((status) => (
            <option key={status} value={status}>
              {t.dynamic(`paymentStatus.${status}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="admin_note" label={t("orders.adminNote")} hint={t("orders.adminNoteHint")}>
        <Textarea
          id="admin_note"
          rows={4}
          maxLength={4000}
          value={values.admin_note}
          onChange={(e) => setValues((v) => ({ ...v, admin_note: e.target.value }))}
        />
      </Field>
      {message ? (
        <Notice tone={message.tone} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </Notice>
      ) : null}
      <button type="submit" disabled={pending || !dirty} className={buttonClasses("primary", "md", "w-full")}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}
