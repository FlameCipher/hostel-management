import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <AppShell userName={session.name}>{children}</AppShell>;
}
