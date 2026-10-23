import Link from "next/link";
import { requireSuperAdmin } from "@/lib/platform/require-super-admin";
import { prisma } from "@/lib/db";

export default async function PlatformProductsPage() {
  await requireSuperAdmin();
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, code: true, name: true, domain: true, active: true,
      _count: { select: { plans: true, subscriptions: true } },
    },
  });

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <Link href="/platform" className="text-sm text-slate-400 hover:text-white">← Super Admin</Link>
        <p className="mt-5 text-sm font-semibold tracking-[0.22em] text-slate-400">SYSTEM IN ONE</p>
        <h1 className="mt-2 text-3xl font-semibold">Products</h1>
        <p className="mt-2 text-slate-400">Systems offered through the mother platform. Read-only until audited product management is enabled.</p>

        <section className="mt-7 grid gap-4 md:grid-cols-2">
          {products.length ? products.map((product) => (
            <article key={product.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="text-lg font-semibold">{product.name}</h2><p className="mt-1 text-xs text-slate-500">{product.code}</p></div>
                <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs">{product.active ? "Active" : "Inactive"}</span>
              </div>
              <p className="mt-5 text-sm text-slate-400">{product.domain ?? "Domain not assigned"}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-950 p-3"><span className="block text-xs text-slate-500">Plans</span><strong className="mt-1 block text-xl">{product._count.plans}</strong></div>
                <div className="rounded-xl bg-slate-950 p-3"><span className="block text-xs text-slate-500">Subscriptions</span><strong className="mt-1 block text-xl">{product._count.subscriptions}</strong></div>
              </div>
            </article>
          )) : <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-slate-400">No products have been provisioned yet. StudentsHostels will appear after its safe product seed is deployed.</div>}
        </section>
      </div>
    </main>
  );
}
