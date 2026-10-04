import Link from "next/link";

const products = [
  {
    name: "StudentsHostels",
    description: "A complete hostel management, student accommodation and booking platform for landlords and landladies.",
    href: "https://studentshostels.com",
    status: "Product 01",
  },
];

const services = [
  ["Subscription systems", "Run your business on a professionally managed system with predictable recurring access."],
  ["Dedicated licensing", "Deploy a dedicated licensed environment for organizations that need greater control and separation."],
  ["White-label systems", "Use selected products with your own business identity, domain and customer-facing branding."],
  ["Custom development", "Extend an existing product or commission a purpose-built business system around your workflow."],
];

export const metadata = {
  title: "SYSTEM IN ONE | Many Systems. One Platform.",
  description: "Business software, subscription systems, dedicated licensing and custom digital platforms.",
};

export default function SystemInOneHome() {
  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-semibold tracking-[0.18em]">SYSTEM IN ONE</Link>
          <a href="#products" className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Explore systems</a>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <p className="text-sm font-semibold tracking-[0.28em] text-slate-400">BUSINESS SOFTWARE PLATFORM</p>
        <h1 className="mt-6 max-w-5xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
          Many systems.<br />One platform.
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
          SYSTEM IN ONE brings practical business software into one growing platform. Subscribe to a system, license a dedicated environment, choose white-label options, or build around your organization.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <a href="#products" className="rounded-full bg-white px-6 py-3 font-medium text-slate-950">View our systems</a>
          <a href="#solutions" className="rounded-full border border-white/20 px-6 py-3 font-medium">How it works</a>
        </div>
      </section>

      <section id="products" className="border-y border-white/10 bg-white/[0.03]">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="text-sm font-semibold tracking-[0.22em] text-slate-400">OUR SYSTEMS</p>
          <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Software built for real operations.</h2>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {products.map((product) => (
              <article key={product.name} className="rounded-3xl border border-white/10 bg-[#0b1728] p-7">
                <span className="text-xs font-semibold tracking-[0.18em] text-slate-500">{product.status}</span>
                <h3 className="mt-5 text-2xl font-semibold">{product.name}</h3>
                <p className="mt-3 max-w-xl leading-7 text-slate-300">{product.description}</p>
                <a href={product.href} className="mt-7 inline-block font-medium">Visit StudentsHostels →</a>
              </article>
            ))}
            <article className="rounded-3xl border border-dashed border-white/15 p-7">
              <span className="text-xs font-semibold tracking-[0.18em] text-slate-500">EXPANDING PLATFORM</span>
              <h3 className="mt-5 text-2xl font-semibold">More systems are coming.</h3>
              <p className="mt-3 leading-7 text-slate-400">The mother platform is designed to support additional industries without mixing one customer’s data or operations with another.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="solutions" className="mx-auto max-w-7xl px-6 py-20">
        <p className="text-sm font-semibold tracking-[0.22em] text-slate-400">FLEXIBLE DELIVERY</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-4xl">Choose how your organization uses the system.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {services.map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-white/10 p-6">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="max-w-3xl text-3xl font-semibold">One foundation. Separate businesses. Room to grow.</h2>
          <p className="mt-4 max-w-2xl leading-7 text-slate-400">Each product and customer environment is designed around clear access boundaries, while SYSTEM IN ONE provides the commercial and technology foundation behind the platform.</p>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:justify-between">
          <span>© 2026 SYSTEM IN ONE</span><span>Many Systems. One Platform.</span>
        </div>
      </footer>
    </main>
  );
}
