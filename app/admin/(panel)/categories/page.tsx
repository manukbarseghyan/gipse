import { AdminPageHeader } from "@/components/admin/admin-ui";
import { CategoryManager } from "@/components/admin/category-manager";
import { requireAdminPage } from "@/lib/auth/admin";
import { listCategories } from "@/lib/admin/queries";
import { getAdminT } from "@/lib/i18n/admin-server";

export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const { supabase } = await requireAdminPage();
  const [{ t }, categories] = await Promise.all([getAdminT(), listCategories(supabase)]);
  return (
    <>
      <AdminPageHeader title={t("categories.title")} />
      <p className="-mt-3 mb-6 text-sm text-muted">{t("categories.intro")}</p>
      <CategoryManager categories={categories} />
    </>
  );
}
