import { CurrencyProvider } from "@/components/currency-context";
import { cache } from "react";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth/session";
import { requestPropertyContext } from "@/lib/property-host";
import { db } from "@/lib/db";
const managementBrand = cache(async () => {
  const session = await requireSession();
  const [organization, context] = await Promise.all([db.organization.findUnique({ where: { id: session.organizationId }, select: { name: true, currency: true } }), requestPropertyContext()]);
  const organizationName = context.property?.organizationId === session.organizationId ? context.property.name : organization?.name === "Mama Mbugua Hostel" ? "MMAMBUGUA HOSTEL" : organization?.name ?? "Hostel Management";
  return { session, organizationName, currency: organization?.currency ?? "KES" };
});
export async function generateMetadata() {
  const { organizationName } = await managementBrand();
  return { title: { absolute: organizationName, template: `%s | ${organizationName}` } };
}
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, organizationName, currency } = await managementBrand();
  return <CurrencyProvider currency={currency}><AppShell organizationName={organizationName} userName={session.name} userRole={session.role}>{children}</AppShell></CurrencyProvider>;
}
