import { OperatingCurrencyForm } from "@/components/operating-currency-form";
import Link from "next/link";
import { PropertyProfileForm } from "@/components/property-profile-form";
import { LockKeyhole } from "lucide-react";
import { AccommodationRatesForm, OrganizationSettingsForm } from "@/components/settings-forms";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  const session = await requireSession();
  const canManage = session.role === "OWNER" || session.role === "ADMIN";
  const [settings, rates, properties] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: session.organizationId }, select: { currency:true,currencyLockedAt:true,name: true, ownerName: true, phone: true, email: true, physicalAddress: true, receiptPrefix: true, defaultSemesterMonths: true, defaultBreakMonths: true, reminderDaysBefore: true, mpesaShortcode: true, mpesaAccountName: true, whatsappEnabled: true, smsEnabled: true } }),
    db.roomType.findMany({ where: { organizationId: session.organizationId, active: true }, orderBy: { name: "asc" } }),
    db.property.findMany({where:{organizationId:session.organizationId,active:true},select:{id:true,name:true,physicalAddress:true,countryCode:true,city:true,region:true,postalCode:true,latitude:true,longitude:true,timeZone:true,rentPaymentMethods:true,phone:true,email:true,publicDescription:true,customDomain:true,publicListing:true},orderBy:{name:"asc"}}),
  ]);
  return <div><div className="page-heading-row"><div><p className="eyebrow">Configuration</p><h1>Settings</h1><p>Manage hostel identity, operational defaults, payment details and accommodation pricing.</p><p><Link className="secondary-button" href="/account">Change my login email or password</Link></p><p><Link className="secondary-button" href="/website">Manage my website and pictures</Link></p></div></div>{canManage ? <div className="settings-stack"><OperatingCurrencyForm currency={settings.currency} locked={Boolean(settings.currencyLockedAt)} owner={session.role==="OWNER"}/><OrganizationSettingsForm settings={settings} />{properties.map(property=><PropertyProfileForm key={property.id} property={property}/>)}<AccommodationRatesForm rates={rates.map((rate) => ({ ...rate, monthlyRate: Number(rate.monthlyRate), semesterRate: Number(rate.semesterRate) }))} /></div> : <div className="inline-empty"><LockKeyhole size={28} /><strong>View-only access</strong><p>Only the Owner or an Admin can change hostel settings.</p></div>}</div>;
}
