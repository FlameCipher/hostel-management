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
  const sendingUnavailable = queued && payment.receiptDeliveryStatus === "FAILED" &&
    /(?:RESEND_API_KEY|RECEIPT_EMAIL_FROM).*not configured/i.test(payment.receiptDeliveryError ?? "");
  const label = payment.reversedAt ? "Receipt reversed"
    : !queued ? (payment.receiptDeliveryChannel === "EMAIL" ? "Email sent — delivery unconfirmed" : "Receipt sent")
    : processing ? "Sending email…"
    : sendingUnavailable ? "Receipt email setup needed"
    : !payment.hasEmail && !payment.hasPhone ? "Student contact needed"
    : payment.receiptDeliveryStatus === "FAILED" ? (payment.receiptDeliveryChannel === "EMAIL" ? "Email not sent" : payment.receiptDeliveryChannel === "WHATSAPP" ? "WhatsApp send failed" : "Receipt send failed")
    : payment.receiptDeliveryChannel === "WHATSAPP" ? "WhatsApp send not confirmed"
    : "Receipt not sent yet";
  const hint = payment.reversedAt ? "This reversed receipt cannot be sent."
    : !queued ? "The sending service accepted this receipt. Delivery to the student and reading are not confirmed here."
    : processing ? "Please wait while the current email attempt finishes."
    : sendingUnavailable ? "Management needs to complete the receipt email setup. If a student phone is available, prepare the receipt in WhatsApp instead."
    : !payment.hasEmail && !payment.hasPhone ? "Ask the student to complete their details, then have management verify them."
    : payment.receiptDeliveryChannel === "WHATSAPP" ? "Check whether you sent the WhatsApp draft before sending it again."
    : payment.receiptDeliveryStatus === "FAILED" ? "Check the student's contact details before trying again."
    : payment.hasEmail && payment.hasPhone ? "Payment recorded. Send the receipt by email or prepare a WhatsApp message."
    : payment.hasEmail ? "Payment recorded. Use Send receipt by email."
    : "Payment recorded. Prepare the WhatsApp receipt, then press Send in WhatsApp. To use email, ask the student to update their details.";
  return {queued, processing, label, hint, emailAvailable, whatsappAvailable};
}
