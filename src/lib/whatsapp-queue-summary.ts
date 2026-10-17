/** Read-only operational truth for WhatsApp drafts and provider receipts.
 * Never treat a queued/opened/manually marked message as provider delivered.
 * Aggregated counts are organization-scoped by the caller.
 */
export type StatusAggregate = { status: string; _count: { _all: number } };
const count = (rows: readonly StatusAggregate[], status: string) =>
  rows.reduce((sum, row) => sum + (row.status === status && Number.isSafeInteger(row._count._all) && row._count._all > 0 ? row._count._all : 0), 0);

export function whatsappQueueSummary(drafts: readonly StatusAggregate[], deliveries: readonly StatusAggregate[]) {
  const queued = count(drafts, "QUEUED");
  const openedUnconfirmed = count(drafts, "OPENED_FOR_SENDING");
  const manualSentUnverified = count(drafts, "SENT");
  const failed = count(drafts, "FAILED");
  const cancelled = count(drafts, "CANCELLED");
  const providerAccepted = count(deliveries, "ACCEPTED") + count(deliveries, "SENT");
  const providerConfirmed = count(deliveries, "DELIVERED") + count(deliveries, "READ");
  const providerReview = count(deliveries, "REVIEW") + count(deliveries, "FAILED");
  return {
    queued, openedUnconfirmed, manualSentUnverified, failed, cancelled,
    providerAccepted, providerConfirmed, providerReview,
    needsManualAttention: queued + openedUnconfirmed + failed,
  };
}
