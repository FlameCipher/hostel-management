import { redirect } from "next/navigation";
import { ChargeForm, PaymentForm } from "@/components/payment-forms";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ mode?: string; chargeId?: string }> }) {
  const session = await requireSession();
  if (session.role === "CARETAKER") redirect("/payments");
  const params = await searchParams;
  const [students, semesters, charges] = await Promise.all([
    db.student.findMany({ where: { organizationId: session.organizationId, status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    db.semester.findMany({ where: { organizationId: session.organizationId }, orderBy: { startDate: "desc" } }),
    db.charge.findMany({ where: { organizationId: session.organizationId, status: { notIn: ["FULLY_PAID", "WAIVED"] } }, include: { student: true, payments: { where: { reversedAt: null } } }, orderBy: { dueDate: "asc" } }),
  ]);
  const chargeOptions = charges.map((charge) => ({ id: charge.id, label: `${charge.student.fullName} · ${charge.description}`, balance: Math.max(0, Number(charge.amount) - charge.payments.reduce((sum, item) => sum + Number(item.amount), 0)) })).filter((item) => item.balance > 0);
  const options = students.map((student) => ({ id: student.id, label: student.fullName }));
  const semesterOptions = semesters.map((semester) => ({ id: semester.id, label: semester.name }));
  return <div className="form-page"><div className="page-heading-row"><div><p className="eyebrow">Payments</p><h1>{params.mode === "charge" ? "Create charge" : "Record payment"}</h1><p>{params.mode === "charge" ? "Add semester rent or another amount owed by a student." : "Apply a payment to an outstanding student charge."}</p></div></div>{params.mode === "charge" ? <ChargeForm students={options} semesters={semesterOptions} /> : <PaymentForm charges={chargeOptions} selectedChargeId={params.chargeId} />}</div>;
}
