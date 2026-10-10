import Link from "next/link";
import { requireSuperAdmin } from "@/lib/platform/require-super-admin";

const controls = [
  ["Separate platform identity", "Enabled in code", "Platform sessions are distinct from hostel organization sessions."],
  ["Dedicated platform secret", "Required", "PLATFORM_SESSION_SECRET is separate from SESSION_SECRET."],
  ["Organization privilege isolation", "Enabled in code", "OWNER/ADMIN/MANAGER/CARETAKER do not grant Super Admin."],
  ["Platform audit event store", "Pending", "A dedicated platform-level audit model is not yet deployed."],
  ["Support impersonation", "Disabled", "No silent landlord impersonation is implemented."],
  ["Client #2 onboarding", "Locked", "Requires Property migration repair and tenant-isolation tests."],
];

export default async function PlatformAuditPage() {
  await requireSuperAdmin();
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <Link href="/platform" className="text-sm text-slate-400 hover:text-white">← Super Admin</Link>
        <p className="mt-5 text-sm font-semibold tracking-[0.22em] text-slate-400">SYSTEM IN ONE</p>
        <h1 className="mt-2 text-3xl font-semibold">Audit & security</h1>
        <p className="mt-2 text-slate-400">Security posture for the mother-platform control plane. This does not expose client financial audit records.</p>
        <section className="mt-7 space-y-3">{controls.map(([name,status,description]) => <article key={name} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:flex sm:items-start sm:justify-between sm:gap-6">
          <div><h2 className="font-semibold">{name}</h2><p className="mt-1 text-sm leading-6 text-slate-400">{description}</p></div><span className="mt-3 inline-block shrink-0 rounded-full border border-slate-700 px-2.5 py-1 text-xs sm:mt-0">{status}</span>
        </article>)}</section>
        <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-900 p-5"><strong>Audit rule</strong><p className="mt-2 text-sm leading-6 text-slate-400">Future Super Admin mutations must record who acted, what changed, when it changed and the affected platform/client identifier. Sensitive secrets must never be written to audit payloads.</p></div>
      </div>
    </main>
  );
}
