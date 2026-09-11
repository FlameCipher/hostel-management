import { db } from "@/lib/db";
import { generateReceiptPdf } from "@/lib/receipt-pdf";

export type ReceiptDeliveryResult = "email" | "whatsapp" | "failed" | "deferred";

const money = (value: number) => `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export async function deliverPaymentReceipt(
  paymentId: string,
  organizationId: string,
): Promise<ReceiptDeliveryResult> {
  try {
    const payment = await db.payment.findFirst({
      where: { id: paymentId, organizationId, reversedAt: null },
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

    if (!payment?.charge.occupancy) return "deferred";

    if (!payment.student.email) {
      await db.payment.update({
        where: { id: payment.id },
        data: {
          receiptDeliveryChannel: "WHATSAPP",
          receiptDeliveryStatus: "ACTION_REQUIRED",
          receiptDeliveryError: null,
        },
      });
      return "whatsapp";
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RECEIPT_EMAIL_FROM;
    if (!apiKey || !from) {
      await db.payment.update({
        where: { id: payment.id },
        data: {
          receiptDeliveryChannel: "EMAIL",
          receiptDeliveryStatus: "FAILED",
          receiptDeliveryError: "RESEND_API_KEY or RECEIPT_EMAIL_FROM is not configured.",
        },
      });
      return "failed";
    }

    const paid = payment.charge.payments.reduce((sum, item) => sum + Number(item.amount), 0);
    const balance = Math.max(0, Number(payment.charge.amount) - paid);
    const roomNumber = payment.charge.occupancy.room.number;
    const pdf = await generateReceiptPdf({
      organizationName: payment.organization.name,
      ownerName: payment.organization.ownerName,
      organizationPhone: payment.organization.phone,
      receiptNumber: payment.receiptNumber,
      studentName: payment.student.fullName,
      studentPhone: payment.student.phone,
      studentEmail: payment.student.email,
      roomNumber: `Room ${roomNumber}`,
      semesterName: payment.charge.occupancy.semester.name,
      paymentDate: payment.paidAt.toLocaleDateString("en-KE", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }),
      description: payment.charge.description,
      amountReceived: Number(payment.amount),
      paymentMethod: payment.method.replaceAll("_", " "),
      reference: payment.reference ?? "Not applicable",
      totalCharge: Number(payment.charge.amount),
      balanceRemaining: balance,
      nextBalanceDue: balance > 0 ? payment.charge.dueDate.toLocaleDateString("en-KE", { timeZone: "UTC" }) : null,
      receivedBy: payment.recordedBy?.name ?? "Hostel management",
      reversed: false,
    });
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payment.student.email],
        subject: `${payment.organization.name} receipt ${payment.receiptNumber}`,
        attachments: [{
          content: Buffer.from(pdf).toString("base64"),
          filename: `receipt-${payment.receiptNumber}.pdf`,
        }],
        html: `
          <div style="margin:0 auto;max-width:620px;font-family:Arial,sans-serif;color:#203a57">
            <h1 style="font-size:22px">${escapeHtml(payment.organization.name)}</h1>
            <p>Your official payment receipt <strong>${escapeHtml(payment.receiptNumber)}</strong> is attached as a PDF.</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:9px;border-bottom:1px solid #e4edf6">Student</td><td style="padding:9px;border-bottom:1px solid #e4edf6"><strong>${escapeHtml(payment.student.fullName)}</strong></td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #e4edf6">Room</td><td style="padding:9px;border-bottom:1px solid #e4edf6"><strong>Room ${escapeHtml(roomNumber)}</strong></td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #e4edf6">Semester</td><td style="padding:9px;border-bottom:1px solid #e4edf6">${escapeHtml(payment.charge.occupancy.semester.name)}</td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #e4edf6">Payment</td><td style="padding:9px;border-bottom:1px solid #e4edf6"><strong>${money(Number(payment.amount))}</strong></td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #e4edf6">Method</td><td style="padding:9px;border-bottom:1px solid #e4edf6">${escapeHtml(payment.method.replaceAll("_", " "))}</td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #e4edf6">Reference</td><td style="padding:9px;border-bottom:1px solid #e4edf6">${escapeHtml(payment.reference ?? "Not applicable")}</td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #e4edf6">Balance</td><td style="padding:9px;border-bottom:1px solid #e4edf6"><strong>${money(balance)}</strong></td></tr>
            </table>
            <p style="margin-top:24px;font-size:12px;color:#60748a">${escapeHtml(payment.organization.ownerName)} · ${escapeHtml(payment.organization.phone)}</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      await db.payment.update({
        where: { id: payment.id },
        data: {
          receiptDeliveryChannel: "EMAIL",
          receiptDeliveryStatus: "FAILED",
          receiptDeliveryError: `Email provider rejected the receipt: ${details}`,
        },
      });
      return "failed";
    }

    await db.$transaction([
      db.payment.update({
        where: { id: payment.id },
        data: {
          receiptDeliveryChannel: "EMAIL",
          receiptDeliveryStatus: "SENT",
          receiptDeliveredAt: new Date(),
          receiptDeliveryError: null,
        },
      }),
      db.auditLog.create({
        data: {
          organizationId,
          action: "PAYMENT_RECEIPT_EMAILED",
          entityType: "Payment",
          entityId: payment.id,
          metadata: { receiptNumber: payment.receiptNumber, recipient: payment.student.email },
        },
      }),
    ]);
    return "email";
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Receipt delivery failed.";
    await db.payment.updateMany({
      where: { id: paymentId, organizationId },
      data: { receiptDeliveryStatus: "FAILED", receiptDeliveryError: message },
    }).catch(() => undefined);
    return "failed";
  }
}
