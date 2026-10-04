import Link from "next/link";
import { BedDouble, CreditCard, FileText, MessageSquare, ReceiptText, ShieldCheck, Wrench } from "lucide-react";

const services = [
  { icon: BedDouble, title: "My room", text: "View your current room and accommodation details." },
  { icon: CreditCard, title: "Balance & payments", text: "See rent charges, payments and your current balance." },
  { icon: FileText, title: "Statement", text: "Review your hostel account history semester by semester." },
  { icon: ReceiptText, title: "Receipts", text: "Access official MMAMBUGUA HOSTEL payment receipts." },
  { icon: MessageSquare, title: "Messages", text: "Receive hostel notices and communicate with management." },
  { icon: Wrench, title: "Maintenance", text: "Report a room maintenance issue and follow its progress." },
];

export default function TenantPortalPage() {
  return (
    <main className="marketing-site">
      <nav className="marketing-nav">
        <Link className="marketing-brand" href="/"><strong>MMAMBUGUA HOSTEL</strong><span>STUDENT PORTAL</span></Link>
        <div className="marketing-links"><Link href="/">Public website</Link><Link className="marketing-login" href="/login">Management Login</Link></div>
      </nav>
      <section className="marketing-section">
        <div className="marketing-section-head">
          <span>STUDENT SELF-SERVICE</span>
          <h1>Everything about your stay, in one secure place.</h1>
          <p>The tenant portal is being activated for registered MMAMBUGUA HOSTEL students. Financial records and receipts will only be available after secure student authentication.</p>
        </div>
        <div className="marketing-room-grid">
          {services.map(({ icon: Icon, title, text }) => (
            <article className="marketing-room-card" key={title}>
              <Icon size={28} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <section className="panel mt-5">
          <div className="form-section-heading">
            <div><p className="panel-kicker">Privacy first</p><h2>Secure student access</h2></div>
            <ShieldCheck size={28} />
          </div>
          <p>We will not expose a student's balance, statement, room details or receipts through a public phone-number or admission-number lookup. Tenant authentication will be enabled before private account data is connected to this page.</p>
        </section>
      </section>
    </main>
  );
}
