import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { newReceiptLink, receiptWhatsAppNumber } from "@/lib/short-receipt-link";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin) return new Response("Invalid request.", { status: 403 });
  const session = await requireSession();
  const { id } = await params;
  const payment = await db.payment.findFirst({ where: { id, organizationId: session.organizationId }, select: { id: true, student: { select: { phone: true } } } });
  if (!payment) return new Response("Receipt not found.", { status: 404 });
  const number = receiptWhatsAppNumber(payment.student.phone);
  if (!number) return new Response("Update the student’s phone number before sharing.", { status: 400 });
  const { code, codeHash, expiresAt } = newReceiptLink();
  await db.paymentReceiptLink.create({ data: { codeHash, paymentId: payment.id, expiresAt } });
  const receiptUrl = new URL(`/r/${code}`, origin).toString();
  // The WhatsApp composer contains only the short PDF URL.
  return new Response(null, { status: 303, headers: { Location: `https://wa.me/${number}?text=${encodeURIComponent(receiptUrl)}`, "Cache-Control": "no-store" } });
}
