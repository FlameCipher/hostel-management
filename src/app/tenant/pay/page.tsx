import styles from "@/components/rent-payment.module.css";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenantSession } from "@/lib/auth/tenant-session";
import { activeRentGateway } from "@/lib/rent-payments";
import { RentRequestForm } from "@/components/rent-request-form";
import { tenantRentRequestAction } from "@/app/(app)/payments/requests/actions";
import { roundCurrency } from "@/lib/currency";
export const metadata = { title: "Pay rent", robots: { index: false, follow: false } };
export default async function TenantPayPage() {
  const session = await requireTenantSession();
  const gateway = await activeRentGateway(db, session.organizationId);
  const student = await db.student.findFirstOrThrow({ where: { id: session.studentId, organizationId: session.organizationId }, include: { charges: { where: { currency: "KES", status: { notIn: ["FULLY_PAID", "WAIVED"] } }, include: { payments: { where: { reversedAt: null }, select: { amount: true } } } } } });
  const options = student.charges.map(c => ({ id: c.id, label: c.description, balance: roundCurrency(Number(c.amount) - c.payments.reduce((s, p) => s + Number(p.amount), 0), "KES"), student: { name: student.fullName, email: student.email || "", phone: student.phone } })).filter(c => c.balance > 0);
  return <main className={styles.page}><Link href="/tenant/account">← My account</Link><h1>Pay my rent</h1><p>Your payment is linked to your student account automatically. You or someone paying for you can complete secure Pesapal checkout.</p>{gateway ? <section className={styles.card}><RentRequestForm action={tenantRentRequestAction} charges={options} requestId={"R-" + randomUUID()} tenant/></section> : <p>Automatic online payments are not connected yet. <Link href="/pay-rent">View current payment instructions</Link>.</p>}</main>;
}
