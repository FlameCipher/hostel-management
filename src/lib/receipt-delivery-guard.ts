import type { Prisma } from "@/generated/prisma/client";

/** An atomic lease: only one caller can change a pending/failed receipt into processing.
 * A stale lease can be recovered, but a successfully emailed receipt cannot be claimed.
 */
export const RECEIPT_EMAIL_PROCESSING = "DELIVERY_PROCESSING";

export function receiptEmailClaimWhere(
  id: string, organizationId: string, staleBefore: Date,
): Prisma.PaymentWhereInput {
  return {
    id, organizationId, reversedAt: null,
    OR: [
      {receiptDeliveryStatus: {in: ["PENDING", "FAILED"]}},
      {receiptDeliveryStatus: "ACTION_REQUIRED", receiptDeliveryChannel: "WHATSAPP"},
      {receiptDeliveryStatus: "ACTION_REQUIRED", receiptDeliveryChannel: null},
      {receiptDeliveryStatus: "ACTION_REQUIRED", receiptDeliveryChannel: "EMAIL",
        receiptDeliveryError: {not: RECEIPT_EMAIL_PROCESSING}},
      {receiptDeliveryStatus: "ACTION_REQUIRED", receiptDeliveryChannel: "EMAIL",
        updatedAt: {lt: staleBefore}},
    ],
  };
}

export function activeReceiptEmailClaimWhere(id: string, organizationId: string): Prisma.PaymentWhereInput {
  return {
    id, organizationId, reversedAt: null,
    receiptDeliveryStatus: "ACTION_REQUIRED",
    receiptDeliveryChannel: "EMAIL",
    receiptDeliveryError: RECEIPT_EMAIL_PROCESSING,
  };
}
