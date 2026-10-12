export type ReceiptDeliveryStatus = "PENDING" | "SENT" | "FAILED" | "ACTION_REQUIRED";
export type ReceiptDeliveryChannel = "EMAIL" | "WHATSAPP" | null;

export type ReceiptDeliveryRow = {
  receiptDeliveryStatus: ReceiptDeliveryStatus;
  receiptDeliveryChannel: ReceiptDeliveryChannel;
  reversedAt: Date | null;
  hasEmail: boolean;
  hasPhone: boolean;
};

/** Presentation-only logic; opening WhatsApp does not prove a message was delivered. */
export function receiptDeliveryQueueState(payment: ReceiptDeliveryRow) {
  const queued = !payment.reversedAt && payment.receiptDeliveryStatus !== "SENT";
  const emailAvailable = queued && payment.hasEmail;
  const whatsappAvailable = queued && payment.hasPhone;
  const label = !queued ? "Completed or reversed"
    : payment.receiptDeliveryStatus === "FAILED" ? "Email delivery failed"
    : payment.receiptDeliveryStatus === "PENDING" ? "Not yet delivered"
    : payment.receiptDeliveryChannel === "WHATSAPP" ? "WhatsApp sharing required"
    : "Action required";
  return { queued, label, emailAvailable, whatsappAvailable };
}
