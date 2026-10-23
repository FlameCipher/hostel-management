export default function PlatformLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-7">
        <p className="text-sm font-semibold tracking-[0.22em] text-slate-400">SYSTEM IN ONE</p>
        <h1 className="mt-2 text-2xl font-semibold">Platform administration</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Super Admin sign-in is intentionally unavailable until a persistent platform administrator identity and audited provisioning flow are deployed. Hostel staff credentials cannot be used here.</p>
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
          No default or hard-coded administrator password is installed.
        </div>
      </section>
    </main>
  );
}
