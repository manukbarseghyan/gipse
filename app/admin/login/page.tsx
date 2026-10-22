import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { LoginForm } from "@/components/admin/login-form";
import { getAdminContext } from "@/lib/auth/admin";
import { getAdminT } from "@/lib/i18n/admin-server";

export const metadata = { title: "Sign in" };

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const ctx = await getAdminContext();
  if (!("error" in ctx)) redirect("/admin");

  const { t } = await getAdminT();
  const { error } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Wordmark className="justify-center" />
          <h1 className="mt-6 text-2xl text-ink">{t("login.title")}</h1>
        </div>
        <div className="rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
          <LoginForm initialError={error === "forbidden" ? "forbidden" : null} />
        </div>
      </div>
    </div>
  );
}
