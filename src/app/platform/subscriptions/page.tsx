import Link from "next/link";
import { requireSuperAdmin } from "@/lib/platform/require-super-admin";
import { prisma } from "@/lib/db";

function pretty(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function date(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(value) : "—";
}

export default async function PlatformSubscriptionsPage() {
  await requireSuperAdmin();
  const subscriptions = await prisma.subscription.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, status: true, trialEndsAt: true, currentPeriodStart: true, currentPeriodEnd: true, cancelledAt: true,
      organization: { select: { name: true, slug: true, status: true } },
      product: { select: { name: true, code: true } },
      plan: { select: { name: true, code: true } },
    },
  });

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <Link href="/platform" className="text-sm text-slate-400 hover:text-white">← Super Admin</Link>
        <p className="mt-5 text-sm font-semibold tracking-[0.22em] text-slate-400">SYSTEM IN ONE</p>
        <h1 className="mt-2 text-3xl font-semibold">Subscriptions & licences</h1>
        <p className="mt-2 text-slate-400">Current hosted subscriptions. Dedicated/perpetual licensing is not represented as a subscription.</p>

        <div className="mt-7 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          {subscriptions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400"><tr>
              <th className="px-5 py-4">Organization</th><th className="px-5 py-4">Product</th><th className="px-5 py-4">Plan</th>
              <th className="px-5 py-4">Status</th><th className="px-5 py-4">Trial ends</th><th className="px-5 py-4">Period</th>
            </tr></thead>
            <tbody>{subscriptions.map((item) => <tr key={item.id} className="border-b border-slate-800/80 last:border-0">
              <td className="px-5 py-4"><strong className="block">{item.organization.name}</strong><span className="text-xs text-slate-500">{item.organization.slug ?? "Slug pending"} · {pretty(item.organization.status)}</span></td>
              <td className="px-5 py-4">{item.product.name}</td><td className="px-5 py-4">{item.plan?.name ?? "No plan assigned"}</td>
              <td className="px-5 py-4"><span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs">{pretty(item.status)}</span></td>
              <td className="px-5 py-4">{date(item.trialEndsAt)}</td><td className="px-5 py-4">{date(item.currentPeriodStart)} – {date(item.currentPeriodEnd)}</td>
            </tr>)}</tbody>
          </table></div> : <div className="p-8 text-center text-slate-400">No hosted subscriptions have been provisioned yet.</div>}
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-500">No subscription can be activated, suspended, cancelled or changed from this read-only screen yet.</p>
      </div>
    </main>
  );
}
