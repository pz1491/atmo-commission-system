import { requireOrgContext } from "@/lib/session";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const { organizationId, organization } = await requireOrgContext();
  const session = await auth();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        organizationName={organization.name}
        userName={session?.user?.name ?? session?.user?.email ?? "User"}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar organizationId={organizationId} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
