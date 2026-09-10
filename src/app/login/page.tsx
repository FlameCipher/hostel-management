import { Building2, CheckCircle2 } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/auth/session";

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand-mark brand-mark-large"><Building2 aria-hidden="true" size={28} /></div>
        <p className="eyebrow mt-8">Hostel operations</p>
        <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">Know every room, payment and balance.</h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-blue-100">A clear operating view for Mama Mbugua Hostel, from student admission to final checkout.</p>
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
            <div><p className="font-semibold text-slate-950">Mama Mbugua</p><p className="text-xs text-slate-500">Hostel Management</p></div>
          </div>
          <h2 className="mt-12 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to manage rooms, students and semester payments.</p>
          <LoginForm />
          <p className="mt-8 text-center text-xs text-slate-400">Authorized users only. Contact the owner for account access.</p>
        </div>
      </section>
    </main>
  );
}
