import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const organization = await db.organization.findUnique({ where: { id: session.organizationId }, select: { name: true } });
  return <AppShell organizationName={organization?.name ?? "Hostel Management"} userName={session.name} userRole={session.role}>{children}</AppShell>;
}
