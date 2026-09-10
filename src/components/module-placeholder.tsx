import { ArrowRight, Construction } from "lucide-react";

export function ModulePlaceholder({ title, description, next }: { title: string; description: string; next: string }) {
  return (
    <div>
      <div className="page-heading-row"><div><p className="eyebrow">Hostel management</p><h1>{title}</h1><p>{description}</p></div></div>
      <section className="panel empty-state">
        <span className="metric-icon metric-blue"><Construction size={24} /></span>
        <h2>{title} workspace</h2>
        <p>This route is connected to the application shell. The next implementation checkpoint will add {next}.</p>
        <div className="secondary-button mt-5">Next module <ArrowRight size={17} /></div>
      </section>
    </div>
  );
}
