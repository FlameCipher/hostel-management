import { RECEIPT_EMAIL_PROCESSING } from "@/lib/receipt-delivery-guard";

export type ReceiptDeliveryStatus = "PENDING" | "SENT" | "FAILED" | "ACTION_REQUIRED";
export type ReceiptDeliveryChannel = "EMAIL" | "WHATSAPP" | null;

export type ReceiptDeliveryRow = {
  receiptDeliveryStatus: ReceiptDeliveryStatus;
  receiptDeliveryChannel: ReceiptDeliveryChannel;
  receiptDeliveryError?: string | null;
  updatedAt?: Date;
  reversedAt: Date | null;
  hasEmail: boolean;
  hasPhone: boolean;
};

/** Presentation-only; WhatsApp handoff is never counted as successfully sent.
 * A fresh email-processing lease suppresses duplicate manual clicks.
 */
export function receiptDeliveryQueueState(payment: ReceiptDeliveryRow, now = new Date()) {
  const queued = !payment.reversedAt && payment.receiptDeliveryStatus !== "SENT";
  const processing = queued && payment.receiptDeliveryStatus === "ACTION_REQUIRED" &&
    payment.receiptDeliveryChannel === "EMAIL" &&
    payment.receiptDeliveryError === RECEIPT_EMAIL_PROCESSING &&
    !!payment.updatedAt && now.getTime() - payment.updatedAt.getTime() < 120_000;
  const emailAvailable = queued && !processing && payment.hasEmail;
  const whatsappAvailable = queued && !processing && payment.hasPhone;
  const label = !queued ? "Completed or reversed"
    : processing ? "Sending email…"
    : payment.receiptDeliveryStatus === "FAILED" ? "Email delivery failed"
    : payment.receiptDeliveryStatus === "PENDING" ? "Not yet delivered"
    : payment.receiptDeliveryChannel === "WHATSAPP" ? "WhatsApp sharing required"
    : "Action required";
  return {queued, processing, label, emailAvailable, whatsappAvailable};
}
