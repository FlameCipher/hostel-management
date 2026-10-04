import Link from "next/link";
import { requireSuperAdmin } from "@/lib/platform/require-super-admin";
import { prisma } from "@/lib/db";

export default async function PlatformProvisioningPage() {
  await requireSuperAdmin();

  const [organizations, products, plans, subscriptions] = await Promise.all([
    prisma.organization.count(),
    prisma.product.count({ where: { active: true } }),
    prisma.plan.count({ where: { active: true } }),
    prisma.subscription.count(),
  ]);

  const gates = [
    ["Organization identity", organizations > 0, "Client organization exists and remains the tenant boundary."],
    ["Active product", products > 0, "At least one SYSTEM IN ONE product is available."],
    ["Approved plan", plans > 0, "Commercial limits must be explicitly configured; pricing is not invented."],
    ["Subscription record", subscriptions > 0, "Hosted access is linked to organization + product."],
    ["Property migration", false, "Blocked until PR #21 is safely repaired and verified."],
    ["Isolation tests", false, "A dummy second organization must pass cross-tenant read/write isolation tests."],
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <Link href="/platform" className="text-sm text-slate-400 hover:text-white">← Super Admin</Link>
        <p className="mt-5 text-sm font-semibold tracking-[0.22em] text-slate-400">SYSTEM IN ONE</p>
        <h1 className="mt-2 text-3xl font-semibold">Provisioning</h1>
        <p className="mt-2 text-slate-400">Launch-gate view for safely onboarding landlords and landladies. Automated provisioning remains disabled.</p>

        <section className="mt-7 space-y-3">
          {gates.map(([name, ready, description]) => (
            <article key={name} className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <span aria-label={ready ? "Ready" : "Blocked"} className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${ready ? "border-emerald-700 text-emerald-300" : "border-amber-800 text-amber-300"}`}>{ready ? "✓" : "!"}</span>
              <div><h2 className="font-semibold">{name}</h2><p className="mt-1 text-sm leading-6 text-slate-400">{description}</p></div>
            </article>
          ))}
        </section>

        <div className="mt-7 rounded-2xl border border-amber-900/60 bg-amber-950/20 p-5">
          <strong>Real Client #2 onboarding is locked.</strong>
          <p className="mt-2 text-sm leading-6 text-slate-300">Do not enable self-service provisioning until the Property migration and cross-organization isolation tests are complete.</p>
        </div>
      </div>
    </main>
  );
}
