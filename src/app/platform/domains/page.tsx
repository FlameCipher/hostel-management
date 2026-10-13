import Link from "next/link";
import { requireSuperAdmin } from "@/lib/platform/require-super-admin";
import { prisma } from "@/lib/db";

export default async function PlatformDomainsPage() {
  await requireSuperAdmin();
  const [products, properties] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true, domain: true, active: true } }),
    prisma.property.findMany({ where: { customDomain: { not: null } }, orderBy: { name: "asc" }, select: { id: true, name: true, customDomain: true, organization: { select: { name: true } } } }),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <Link href="/platform" className="text-sm text-slate-400 hover:text-white">← Super Admin</Link>
        <p className="mt-5 text-sm font-semibold tracking-[0.22em] text-slate-400">SYSTEM IN ONE</p>
        <h1 className="mt-2 text-3xl font-semibold">Domains & branding</h1>
        <p className="mt-2 text-slate-400">Read-only domain inventory. DNS ownership and entitlement enforcement are separate controls.</p>

        <h2 className="mt-8 text-lg font-semibold">Product domains</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {products.map((p) => <article key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex justify-between gap-4"><strong>{p.name}</strong><span className="text-xs text-slate-500">{p.active ? "Active" : "Inactive"}</span></div>
            <p className="mt-2 text-sm text-slate-400">{p.domain ?? "No domain assigned"}</p><p className="mt-1 text-xs text-slate-600">{p.code}</p>
          </article>)}
          {!products.length && <p className="text-sm text-slate-500">No product records have been provisioned.</p>}
        </div>

        <h2 className="mt-8 text-lg font-semibold">Client custom domains</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          {properties.length ? properties.map((p) => <div key={p.id} className="flex flex-col gap-1 border-b border-slate-800 p-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
            <div><strong>{p.name}</strong><p className="text-sm text-slate-500">{p.organization.name}</p></div><span className="text-sm text-slate-300">{p.customDomain}</span>
          </div>) : <div className="p-6 text-sm text-slate-500">No client custom domains are currently recorded.</div>}
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-500">This screen never treats a database value as proof that DNS is verified. Domain verification must use the hosting/DNS provider before activation.</p>
      </div>
    </main>
  );
}
