import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { ProductForm, type ProductFormValues } from "@/components/admin/product-form";
import { DeleteProductButton } from "@/components/admin/product-actions";
import { Notice } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/auth/admin";
import { getProductForEdit, listCategories } from "@/lib/admin/queries";
import { getAdminT } from "@/lib/i18n/admin-server";
import { localized } from "@/lib/i18n/localized";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const { supabase } = await requireAdminPage();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [{ locale, t }, product, categories] = await Promise.all([getAdminT(), getProductForEdit(supabase, id), listCategories(supabase)]);
  if (!product) notFound();

  const initial: ProductFormValues = {
    slug: product.slug,
    name_hy: product.name_hy,
    name_ru: product.name_ru ?? "",
    name_en: product.name_en ?? "",
    description_hy: product.description_hy ?? "",
    description_ru: product.description_ru ?? "",
    description_en: product.description_en ?? "",
    price_amd: String(product.price_amd),
    category_id: product.category_id ?? "",
    stock_quantity: product.stock_quantity === null ? "" : String(product.stock_quantity),
    is_available: product.is_available,
    is_featured: product.is_featured,
    is_published: product.is_published,
    images: product.images,
  };

  return (
    <>
      <AdminPageHeader
        title={localized(product, "name", locale)}
        back={{ href: "/admin/products", label: t("products.title") }}
        actions={
          <>
            {product.is_published ? (
              <a href={`/${locale}/products/${product.slug}`} target="_blank" rel="noopener noreferrer" className={buttonClasses("outline", "sm")}>
                <ExternalLink className="h-4 w-4" aria-hidden /> {t("products.viewInShop")}
              </a>
            ) : null}
            <DeleteProductButton productId={product.id} />
          </>
        }
      />
      {query.created ? <Notice tone="success" className="mb-4" role="status">{t("productForm.created")}</Notice> : null}
      <ProductForm
        productId={product.id}
        initial={initial}
        categories={categories.map((c) => ({ id: c.id, name: localized(c, "name", locale) }))}
      />
    </>
  );
}
