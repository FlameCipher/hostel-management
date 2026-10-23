import Link from "next/link";
import { requireSuperAdmin } from "@/lib/platform/require-super-admin";
import { prisma } from "@/lib/db";

function money(value: { toString(): string } | null) {
  return value ? `KES ${Number(value.toString()).toLocaleString()}` : "—";
}

export default async function PlatformPlansPage() {
  await requireSuperAdmin();
  const plans = await prisma.plan.findMany({
    orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true, code: true, name: true, monthlyPrice: true, annualPrice: true,
      maxProperties: true, maxRooms: true, maxUsers: true, whiteLabel: true,
      customDomain: true, active: true, features: true,
      product: { select: { name: true, code: true } },
      _count: { select: { subscriptions: true } },
    },
  });

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <Link href="/platform" className="text-sm text-slate-400 hover:text-white">← Super Admin</Link>
        <p className="mt-5 text-sm font-semibold tracking-[0.22em] text-slate-400">SYSTEM IN ONE</p>
        <h1 className="mt-2 text-3xl font-semibold">Plans & entitlements</h1>
        <p className="mt-2 text-slate-400">Commercial limits are visible here but are not yet enforced by this screen.</p>

        <div className="mt-7 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          {plans.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400"><tr>
              <th className="px-5 py-4">Plan</th><th className="px-5 py-4">Monthly</th><th className="px-5 py-4">Annual</th>
              <th className="px-5 py-4">Properties</th><th className="px-5 py-4">Rooms</th><th className="px-5 py-4">Users</th>
              <th className="px-5 py-4">Custom domain</th><th className="px-5 py-4">White label</th><th className="px-5 py-4">Subscribers</th>
            </tr></thead>
            <tbody>{plans.map((plan) => <tr key={plan.id} className="border-b border-slate-800/80 last:border-0">
              <td className="px-5 py-4"><strong className="block">{plan.name}</strong><span className="text-xs text-slate-500">{plan.product.name} · {plan.code}{plan.active ? "" : " · Inactive"}</span></td>
              <td className="px-5 py-4">{money(plan.monthlyPrice)}</td><td className="px-5 py-4">{money(plan.annualPrice)}</td>
              <td className="px-5 py-4">{plan.maxProperties ?? "Unlimited"}</td><td className="px-5 py-4">{plan.maxRooms ?? "Unlimited"}</td><td className="px-5 py-4">{plan.maxUsers ?? "Unlimited"}</td>
              <td className="px-5 py-4">{plan.customDomain ? "Yes" : "No"}</td><td className="px-5 py-4">{plan.whiteLabel ? "Yes" : "No"}</td><td className="px-5 py-4">{plan._count.subscriptions}</td>
            </tr>)}</tbody>
          </table></div> : <div className="p-8 text-center text-slate-400">No plans have been configured. Pricing will not be invented or seeded until approved.</div>}
        </div>
      </div>
    </main>
  );
}
