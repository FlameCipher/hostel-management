import { requireSession } from "@/lib/auth/session";
import { residentStaff } from "@/lib/resident-access";
import { db } from "@/lib/db";
import { answerStudentLinks } from "@/lib/assistant-navigation";
import { visibleStaffNavigation } from "@/lib/staff-navigation-policy";
import { AssistantStudentLinks } from "@/components/assistant-student-links";
import { ServicePageLink } from "@/components/service-page-link";
export const dynamic = "force-dynamic";
export default async function ServicesPage() {
  const session = await requireSession(), actor = await residentStaff(db, session);
  if (!actor) return <p>Sign in again to view your services.</p>;
  const answer = await answerStudentLinks(db, session.organizationId, "all");
  const pages = visibleStaffNavigation(actor.role);
  const extra = actor.role === "CARETAKER" ? [] : [{ label: "Create an individual M-Pesa / Pesapal payment request", href: "/payments/requests" }, { label: "Rent demands and agreed dates", href: "/reports/arrears" }, { label: "Share unpaid balances PDF with staff", href: "/reports/unpaid" }];
  return <div className="entity-form"><h1>Service links</h1><p>Open a service or copy its link. Student links below can be shared with students and guardians.</p><h2>Student and payer links</h2>{"shareLinks" in answer ? answer.shareLinks?.map(link=><AssistantStudentLinks key={link.url} link={link}/>) : <p>{answer.text}</p>}<p>For a parent or another payer, create an individual payment request. Copy its payment link from the request; it identifies the correct student and rent charge.</p><h2>Management and staff services</h2><p>These links require staff sign-in. Sharing a link does not grant access.</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>{[...extra,...pages].map(page=><ServicePageLink key={page.href} path={page.href} title={page.label}/>)}</div></div>;
}
