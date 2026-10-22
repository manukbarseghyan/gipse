"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { signInAction, type LoginResult } from "@/lib/actions/admin";

const errorKeys = {
  invalid: "login.invalid",
  forbidden: "login.forbidden",
  rate_limited: "login.rateLimited",
  not_configured: "login.notConfigured",
  server_error: "login.error",
} as const;

export function LoginForm({ initialError }: { initialError: "forbidden" | null }) {
  const { t } = useAdminI18n();
  const [state, action, pending] = useActionState<LoginResult | null, FormData>(signInAction, null);
  const error = state?.error ?? initialError;

  return (
    <form action={action} className="space-y-5">
      {error ? (
        <Notice tone="error" role="alert">
          {t(errorKeys[error])}
        </Notice>
      ) : null}
      <Field id="email" label={t("login.email")}>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field id="password" label={t("login.password")}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <button type="submit" disabled={pending} className={buttonClasses("primary", "md", "w-full")}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? t("login.submitting") : t("login.submit")}
      </button>
    </form>
  );
}
