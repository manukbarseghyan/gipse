import { requireAdminPage } from "@/lib/auth/admin";
import { AdminNav } from "@/components/admin/admin-nav";

export const instant = false;

/**
 * Server-side gate for every admin page: unauthenticated users and non-admin
 * accounts are redirected before any admin data is fetched.
 */
export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requireAdminPage();
  return (
    <div className="lg:flex">
      <AdminNav email={user.email} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
