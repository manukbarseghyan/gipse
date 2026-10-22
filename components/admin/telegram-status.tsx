"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Clock, Loader2, Send, XCircle } from "lucide-react";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { Notice } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { resendTelegramAction } from "@/lib/actions/admin";

export function TelegramStatus({
  orderId,
  sentAt,
  attempts,
  lastError,
}: {
  orderId: string;
  sentAt: string | null;
  attempts: number;
  lastError: string | null;
}) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

  if (sentAt) {
    return (
      <p className="flex items-center gap-2 text-sm text-sage">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> {t("orders.telegramSent", { date: sentAt })}
      </p>
    );
  }

  function resend() {
    setMessage(null);
    startTransition(async () => {
      const result = await resendTelegramAction(orderId);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error === "forbidden" ? t("common.forbidden") : t("common.error") });
        return;
      }
      const outcome = result.data.outcome;
      if (outcome === "sent") setMessage({ tone: "success", text: t("orders.telegramResent") });
      else if (outcome === "not_configured") setMessage({ tone: "info", text: t("orders.telegramNotConfigured") });
      else if (outcome === "already_sent_or_in_progress") setMessage({ tone: "info", text: t("orders.telegramBusy") });
      else setMessage({ tone: "error", text: t("orders.telegramError") });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 text-sm">
      {attempts > 0 && lastError ? (
        <p className="flex gap-2 text-rose">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="break-words">{t("orders.telegramFailed", { count: attempts, error: lastError })}</span>
        </p>
      ) : (
        <p className="flex items-center gap-2 text-muted">
          <Clock className="h-4 w-4" aria-hidden /> {t("orders.telegramPending")}
        </p>
      )}
      {message ? <Notice tone={message.tone} role="status">{message.text}</Notice> : null}
      <button type="button" onClick={resend} disabled={pending} className={buttonClasses("outline", "sm")}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        {t("orders.telegramResend")}
      </button>
    </div>
  );
}
