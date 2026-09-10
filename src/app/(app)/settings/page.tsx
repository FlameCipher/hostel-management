import { LockKeyhole } from "lucide-react";
import { AccommodationRatesForm, OrganizationSettingsForm } from "@/components/settings-forms";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  const session = await requireSession();
  const canManage = session.role === "OWNER" || session.role === "ADMIN";
  const [settings, rates] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: session.organizationId }, select: { name: true, ownerName: true, phone: true, email: true, physicalAddress: true, receiptPrefix: true, defaultSemesterMonths: true, defaultBreakMonths: true, reminderDaysBefore: true, mpesaShortcode: true, mpesaAccountName: true, whatsappEnabled: true, smsEnabled: true } }),
    db.roomType.findMany({ where: { organizationId: session.organizationId, active: true }, orderBy: { name: "asc" } }),
  ]);
  return <div><div className="page-heading-row"><div><p className="eyebrow">Configuration</p><h1>Settings</h1><p>Manage hostel identity, operational defaults, payment details and accommodation pricing.</p></div></div>{canManage ? <div className="settings-stack"><OrganizationSettingsForm settings={settings} /><AccommodationRatesForm rates={rates.map((rate) => ({ ...rate, monthlyRate: Number(rate.monthlyRate), semesterRate: Number(rate.semesterRate) }))} /></div> : <div className="inline-empty"><LockKeyhole size={28} /><strong>View-only access</strong><p>Only the Owner or an Admin can change hostel settings.</p></div>}</div>;
}
