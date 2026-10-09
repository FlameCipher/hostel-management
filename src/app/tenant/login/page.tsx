import Link from "next/link";
import { requestPropertyContext } from "@/lib/property-host";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/tenant-session";
import { TenantLoginForm } from "./form";
export default async function TenantLoginPage({searchParams}: {searchParams: Promise<{passwordReset?: string}>}) {
  const params = await searchParams;
  const context=await requestPropertyContext();
  const hostelName=context.property?.name ?? "StudentsHostels";
  if (await getTenantSession()) redirect("/tenant/account");
  return <main className="login-page"><section className="login-brand-panel"><p className="eyebrow">Student portal</p><h1>{hostelName}</h1><p>Secure access to your room, hostel account, statements and receipts.</p></section><section className="login-form-panel"><div className="w-full max-w-md"><h2 className="text-3xl font-semibold">Student sign in</h2><p className="mt-2 text-sm">Sign in with your registered phone or email and your password.</p>{params.passwordReset === "1" && <p role="status" className="mt-5">Your password has been reset. Previous hostel sessions are signed out. Sign in with your new password.</p>}<TenantLoginForm/><p className="mt-6"><Link className="secondary-button" href="/tenant/register">Existing resident? Create my tenant account</Link></p><p className="mt-4"><Link href="/help">Help using the system</Link> · <Link href="/install">Install hostel app</Link></p><p className="mt-8 text-center text-xs"><Link href="/login">Landlord or staff? Open management</Link></p><p className="mt-4 text-center text-xs"><Link href="/">Back to hostel website</Link></p></div></section></main>;
}
