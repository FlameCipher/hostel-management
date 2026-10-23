import Link from "next/link";
import { requireSuperAdmin } from "@/lib/platform/require-super-admin";

const areas = [
  ["Organizations", "Landlords, landladies and client organizations", "/platform/organizations"],
  ["Products", "SYSTEM IN ONE products, beginning with StudentsHostels", "/platform/products"],
  ["Plans & entitlements", "Subscription limits and enabled capabilities", "/platform/plans"],
  ["Subscriptions & licences", "Commercial access and lifecycle status", "/platform/subscriptions"],
  ["Provisioning", "Controlled client environment setup", "/platform/provisioning"],
  ["Domains & branding", "Product domains, custom domains and white-label settings", "/platform/domains"],
  ["Audit & security", "Platform-level security and administrative events", "/platform/audit"],
];

export default async function PlatformPage() {
  const admin = await requireSuperAdmin();

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.22em] text-slate-400">SYSTEM IN ONE</p>
            <h1 className="mt-2 text-3xl font-semibold">Super Admin</h1>
            <p className="mt-2 max-w-2xl text-slate-400">Mother-platform control plane. Client hostel operations remain inside their own organization boundary.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
            <span className="block text-slate-500">Signed in as</span>
            <strong>{admin.name}</strong>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {areas.map(([title, description, href]) => (
            <Link key={href} href={href} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-600">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
              <span className="mt-5 inline-block text-sm font-medium text-slate-200">Open →</span>
            </Link>
          ))}
        </section>

        <aside className="mt-8 rounded-2xl border border-amber-900/50 bg-amber-950/20 p-5">
          <h2 className="font-semibold">Safety boundary</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">This console is not a landlord account. Organization OWNER access never grants SYSTEM IN ONE Super Admin access. Support access to client data must be explicit and audited.</p>
        </aside>
      </div>
    </main>
  );
}
