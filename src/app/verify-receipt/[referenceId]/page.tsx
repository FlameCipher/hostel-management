import { notFound } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/lib/db";

const money = (value: number) => `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

function protectedName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0]?.slice(0, 1) + "***";
  return `${parts[0]} ${parts.at(-1)?.slice(0, 1)}.`;
}

export default async function VerifyReceiptPage({ params }: { params: Promise<{ referenceId: string }> }) {
  const { referenceId } = await params;
  const payment = await db.payment.findUnique({
    where: { securityReference: decodeURIComponent(referenceId) },
    include: { organization: true, student: true },
  });
  if (!payment) notFound();

  const valid = !payment.reversedAt;
  return (
    <main style={{ minHeight: "100vh", background: "#f4f8fc", padding: "40px 18px" }}>
      <article style={{ maxWidth: 620, margin: "0 auto", background: "white", borderRadius: 24, padding: 28, boxShadow: "0 18px 50px rgba(25,55,85,.10)" }}>
        <p style={{ letterSpacing: 2, fontWeight: 800, fontSize: 12, color: "#54708d" }}>MMAMBUGUA HOSTEL · RECEIPT VERIFICATION</p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "18px 0" }}>
          {valid ? <CheckCircle2 size={34} color="#16845b" /> : <XCircle size={34} color="#b42318" />}
          <div><h1 style={{ margin: 0 }}>{valid ? "VALID RECEIPT" : "REVERSED RECEIPT"}</h1><p style={{ margin: "5px 0 0", color: "#64748b" }}>{valid ? "This receipt matches an official hostel payment record." : "This receipt exists, but the payment has been reversed."}</p></div>
        </div>
        <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "24px 0" }} />
        <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div><dt>Receipt number</dt><dd><strong>{payment.receiptNumber}</strong></dd></div>
          <div><dt>Security reference</dt><dd><strong style={{ overflowWrap: "anywhere" }}>{payment.securityReference}</strong></dd></div>
          <div><dt>Student</dt><dd><strong>{protectedName(payment.student.fullName)}</strong></dd></div>
          <div><dt>Amount</dt><dd><strong>{money(Number(payment.amount))}</strong></dd></div>
          <div><dt>Payment date</dt><dd><strong>{payment.paidAt.toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" })}</strong></dd></div>
          <div><dt>Method</dt><dd><strong>{payment.method.replaceAll("_", " ")}</strong></dd></div>
        </dl>
        <p style={{ marginTop: 26, fontSize: 12, color: "#64748b" }}>Verification intentionally hides private student account details. Contact hostel management if the printed receipt details do not match this record.</p>
      </article>
    </main>
  );
}
