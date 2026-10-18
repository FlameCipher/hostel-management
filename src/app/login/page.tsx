import Link from "next/link";
import { Building2, CheckCircle2 } from "lucide-react";
import { requestPropertyContext } from "@/lib/property-host";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/auth/session";
import { staffHome } from "@/lib/staff-navigation-policy";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ accountUpdated?: string; sharedLogin?: string; passwordReset?: string; access?: string }> }) {
  const params = await searchParams;
  const updated = params.accountUpdated === "1";
  const context=await requestPropertyContext();
  const hostelName=context.property?.name ?? "StudentsHostels";
  const staff = params.access === "staff";
  const session = await getSession();
  if (session) redirect(staffHome(session.role));

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand-mark brand-mark-large"><Building2 aria-hidden="true" size={28} /></div>
        <p className="eyebrow mt-8">Hostel operations</p>
        <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">Know every room, payment and balance.</h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-blue-100">A clear operating view for your hostel, from student admission to final checkout.</p>
        <div className="mt-10 grid gap-4 text-sm text-blue-50 sm:grid-cols-2">
          {["Room occupancy at a glance", "Automatic semester balances", "Student and guardian records", "Printable payment receipts"].map((item) => (
            <div className="flex items-center gap-3" key={item}><CheckCircle2 size={18} /><span>{item}</span></div>
          ))}
        </div>
      </section>
      <section className="login-form-panel">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3">
            <div className="brand-mark"><Building2 aria-hidden="true" size={21} /></div>
            <div><p className="font-semibold text-slate-950">{hostelName}</p><p className="text-xs text-slate-500">Hostel Management</p></div>
          </div>
          <h2 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">{staff ? "Staff sign in" : "Owner / administrator sign in"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{staff ? "For staff already onboarded by their hostel owner or authorised administrator." : "Manage your hostel, onboard students and staff, and control their access."}</p>
          <nav className="mt-5 flex flex-wrap gap-3 text-sm" aria-label="Choose account sign-in">
            <Link className="secondary-button" href="/login" aria-current={!staff ? "page" : undefined}>Owner / admin</Link>
            <Link className="secondary-button" href="/login?access=staff" aria-current={staff ? "page" : undefined}>Staff</Link>
            <Link className="secondary-button" href="/tenant/login">Student</Link>
          </nav>
          {context.shared && <section className="mt-5 text-sm" aria-label="Choose your hostel website">
            <p>StudentsHostels serves many hostels. Use the website provided by your hostel owner, especially if your email belongs to more than one hostel. Phone sign-in is available on your hostel website.</p>
            <Link className="secondary-button mt-3" href="/#rooms">Find your hostel website</Link>
          </section>}
          {updated && <p role="status" className="mt-5">Your hostel account was updated. Previous hostel sessions are signed out. Sign in with your updated hostel credentials or use SYSTEM IN ONE.</p>}
          <p className="mt-4 text-sm"><Link href="/install">Install hostel app</Link></p>
          {params.passwordReset === "1" && <p role="status" className="mt-5">Your password has been reset. Previous hostel sessions are signed out. Sign in with your new password.</p>}
          <LoginForm staff={staff} phoneLogin={staff && Boolean(context.property)} />
          {params.sharedLogin === "expired" ? <p role="alert" className="mt-5">Your shared sign-in could not be confirmed. Use the SYSTEM IN ONE button below to start again.</p> : null}
          <p className="mt-5"><a className="secondary-button" href="/api/platform/sso/start">Sign in with SYSTEM IN ONE</a></p>
          <p className="mt-8 text-center text-xs text-slate-500">Staff and students need owner/admin onboarding before they can sign in. Access is limited to your assigned role.</p>
        </div>
      </section>
    </main>
  );
}
