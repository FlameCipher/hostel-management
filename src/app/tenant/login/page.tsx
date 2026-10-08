import Link from "next/link";
import { requestPropertyContext } from "@/lib/property-host";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/tenant-session";
import { TenantLoginForm } from "./form";
export default async function TenantLoginPage() {
  const context=await requestPropertyContext();
  const hostelName=context.property?.name ?? "StudentsHostels";
  if (await getTenantSession()) redirect("/tenant/account");
  return <main className="login-page"><section className="login-brand-panel"><p className="eyebrow">Student portal</p><h1>{hostelName}</h1><p>Secure access to your room, hostel account, statements and receipts.</p></section><section className="login-form-panel"><div className="w-full max-w-md"><h2 className="text-3xl font-semibold">Student sign in</h2><p className="mt-2 text-sm">Use the portal credentials issued to your registered student account.</p><TenantLoginForm/><p className="mt-8 text-center text-xs"><Link href="/tenant">Back to Student Portal</Link></p></div></section></main>;
}
