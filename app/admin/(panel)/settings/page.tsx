import { AdminPageHeader } from "@/components/admin/admin-ui";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdminPage } from "@/lib/auth/admin";
import { getSettings } from "@/lib/admin/queries";
import { getAdminT } from "@/lib/i18n/admin-server";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const { supabase } = await requireAdminPage();
  const [{ t }, settings] = await Promise.all([getAdminT(), getSettings(supabase)]);
  return (
    <>
      <AdminPageHeader title={t("settings.title")} />
      <SettingsForm
        initial={{
          delivery_fee_amd: String(settings.delivery_fee_amd),
          free_delivery_threshold_amd: settings.free_delivery_threshold_amd === null ? "" : String(settings.free_delivery_threshold_amd),
          contact_phone: settings.contact_phone ?? "",
          contact_email: settings.contact_email ?? "",
          instagram_url: settings.instagram_url ?? "",
          facebook_url: settings.facebook_url ?? "",
          pickup_location_hy: settings.pickup_location_hy ?? "",
          pickup_location_ru: settings.pickup_location_ru ?? "",
          pickup_location_en: settings.pickup_location_en ?? "",
        }}
      />
    </>
  );
}
