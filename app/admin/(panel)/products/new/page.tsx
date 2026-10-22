import { AdminPageHeader } from "@/components/admin/admin-ui";
import { emptyProductForm, ProductForm } from "@/components/admin/product-form";
import { requireAdminPage } from "@/lib/auth/admin";
import { listCategories } from "@/lib/admin/queries";
import { getAdminT } from "@/lib/i18n/admin-server";
import { localized } from "@/lib/i18n/localized";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const { supabase } = await requireAdminPage();
  const [{ locale, t }, categories] = await Promise.all([getAdminT(), listCategories(supabase)]);
  return (
    <>
      <AdminPageHeader title={t("products.new")} back={{ href: "/admin/products", label: t("products.title") }} />
      <ProductForm
        productId={null}
        initial={emptyProductForm}
        categories={categories.map((c) => ({ id: c.id, name: localized(c, "name", locale) }))}
      />
    </>
  );
}
