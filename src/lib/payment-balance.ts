import type { Prisma } from "@/generated/prisma/client";

type TransactionClient = Prisma.TransactionClient;

export async function refreshChargeStatus(tx: TransactionClient, chargeId: string) {
  const charge = await tx.charge.findUnique({
    where: { id: chargeId },
    include: { payments: { where: { reversedAt: null }, select: { amount: true } } },
  });
  if (!charge) return;

  const paid = charge.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balance = Math.max(0, Number(charge.amount) - paid);
  const status = balance <= 0
    ? "FULLY_PAID"
    : charge.dueDate < new Date()
      ? "OVERDUE"
      : paid > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

  await tx.charge.update({ where: { id: charge.id }, data: { status } });
}
