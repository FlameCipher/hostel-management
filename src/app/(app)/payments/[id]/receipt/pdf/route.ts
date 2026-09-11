import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { generateReceiptPdf } from "@/lib/receipt-pdf";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const payment = await db.payment.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      organization: true,
      student: true,
      recordedBy: true,
      charge: {
        include: {
          occupancy: { include: { room: true, semester: true } },
          payments: { where: { reversedAt: null }, select: { amount: true } },
        },
      },
    },
  });

  if (!payment) return new Response("Receipt not found", { status: 404 });

  const paid = payment.charge.payments.reduce((sum, item) => sum + Number(item.amount), 0);
  const balance = Math.max(0, Number(payment.charge.amount) - paid);
  const pdf = await generateReceiptPdf({
    organizationName: payment.organization.name,
    ownerName: payment.organization.ownerName,
    organizationPhone: payment.organization.phone,
    receiptNumber: payment.receiptNumber,
    studentName: payment.student.fullName,
    studentPhone: payment.student.phone,
    studentEmail: payment.student.email,
    roomNumber: payment.charge.occupancy ? `Room ${payment.charge.occupancy.room.number}` : "Pending allocation",
    semesterName: payment.charge.occupancy?.semester.name ?? payment.charge.description,
    paymentDate: payment.paidAt.toLocaleDateString("en-KE", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }),
    description: payment.charge.description,
    amountReceived: Number(payment.amount),
    paymentMethod: payment.method.replaceAll("_", " "),
    reference: payment.reference ?? "Not applicable",
    totalCharge: Number(payment.charge.amount),
    balanceRemaining: balance,
    nextBalanceDue: balance > 0 ? payment.charge.dueDate.toLocaleDateString("en-KE", { timeZone: "UTC" }) : null,
    receivedBy: payment.recordedBy?.name ?? "Hostel management",
    reversed: Boolean(payment.reversedAt),
    reversalReason: payment.reversalReason,
  });

  const body = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(body).set(pdf);

  return new Response(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="receipt-${payment.receiptNumber}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}
