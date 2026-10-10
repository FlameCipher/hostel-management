import Link from "next/link";
import { requireSuperAdmin } from "@/lib/platform/require-super-admin";
import { prisma } from "@/lib/db";

function label(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");
}

export default async function PlatformOrganizationsPage() {
  await requireSuperAdmin();

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerName: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      _count: { select: { users: true, rooms: true, properties: true, subscriptions: true } },
    },
  });

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/platform" className="text-sm text-slate-400 hover:text-white">← Super Admin</Link>
            <p className="mt-5 text-sm font-semibold tracking-[0.22em] text-slate-400">SYSTEM IN ONE</p>
            <h1 className="mt-2 text-3xl font-semibold">Organizations</h1>
            <p className="mt-2 text-slate-400">Master view of client organizations. This page is read-only in the first phase.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
            <span className="text-sm text-slate-400">Total organizations</span>
            <strong className="ml-3 text-xl">{organizations.length}</strong>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          {organizations.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No organizations have been provisioned.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                  <tr>
                    <th className="px-5 py-4 font-medium">Organization</th>
                    <th className="px-5 py-4 font-medium">Owner</th>
                    <th className="px-5 py-4 font-medium">Status</th>
                    <th className="px-5 py-4 font-medium">Properties</th>
                    <th className="px-5 py-4 font-medium">Rooms</th>
                    
                    <th className="px-5 py-4 font-medium">Users</th>
                    <th className="px-5 py-4 font-medium">Subscriptions</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org) => (
                    <tr key={org.id} className="border-b border-slate-800/80 last:border-0">
                      <td className="px-5 py-4">
                        <strong className="block">{org.name}</strong>
                        <span className="mt-1 block text-xs text-slate-500">{org.slug ?? "Slug pending"}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="block">{org.ownerName}</span>
                        <span className="mt-1 block text-xs text-slate-500">{org.email ?? org.phone}</span>
                      </td>
                      <td className="px-5 py-4"><span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs">{label(org.status)}</span></td>
                      <td className="px-5 py-4">{org._count.properties}</td>
                      <td className="px-5 py-4">{org._count.rooms}</td>
                      
                      <td className="px-5 py-4">{org._count.users}</td>
                      <td className="px-5 py-4">{org._count.subscriptions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-5 text-xs leading-5 text-slate-500">No organization can be edited, suspended, impersonated or deleted from this screen. Those actions require separate audited workflows.</p>
      </div>
    </main>
  );
}
