import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { PaymentReversalForm } from "@/components/payment-reversal-form";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const money = (value: number) => `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

export default async function ReversePaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!(["OWNER", "ADMIN"] as string[]).includes(session.role)) redirect("/payments");
  const { id } = await params;
  const payment = await db.payment.findFirst({ where: { id, organizationId: session.organizationId }, include: { student: true, charge: true } });
  if (!payment) notFound();
  if (payment.reversedAt) redirect(`/payments/${payment.id}/receipt`);
  return <div className="narrow-page"><div className="page-heading-row"><div><p className="eyebrow">Payment reversal</p><h1>{payment.receiptNumber}</h1><p>{payment.student.fullName} · {money(Number(payment.amount))}</p></div><Link className="secondary-button no-underline" href={`/payments/${payment.id}/receipt`}><ArrowLeft size={17} /> Receipt</Link></div><div className="warning-callout"><ShieldAlert size={21} /><div><strong>This action changes financial balances.</strong><p>Confirm that the payment is incorrect or that M-Pesa has completed the reversal. It cannot be edited back into an active payment.</p></div></div><PaymentReversalForm isMpesa={payment.method === "MPESA"} paymentId={payment.id} /></div>;
}
