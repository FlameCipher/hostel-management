import { db } from "@/lib/db";

function money(value: number) {
  return `KES ${value.toLocaleString("en-KE")}`;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function queueDuePaymentReminders() {
  const organizations = await db.organization.findMany({
    where: { whatsappEnabled: true },
    select: { id: true, name: true, reminderDaysBefore: true },
  });
  let queued = 0;

  for (const organization of organizations) {
    const now = new Date();
    const horizon = new Date(now);
    horizon.setUTCDate(horizon.getUTCDate() + organization.reminderDaysBefore);
    horizon.setUTCHours(23, 59, 59, 999);

    const charges = await db.charge.findMany({
      where: {
        organizationId: organization.id,
        status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
        dueDate: { lte: horizon },
      },
      include: {
        student: true,
        payments: { where: { reversedAt: null }, select: { amount: true } },
      },
    });

    for (const charge of charges) {
      const paid = charge.payments.reduce((sum, item) => sum + Number(item.amount), 0);
      const balance = Math.max(0, Number(charge.amount) - paid);
      if (!balance || !charge.student.phone) continue;

      const due = charge.dueDate.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
      const message = charge.dueDate < now
        ? `Hello ${charge.student.fullName}, this is a payment reminder from ${organization.name}. Your outstanding accommodation balance is ${money(balance)} and was due on ${due}. Please arrange payment or contact the hostel office for assistance. Thank you.`
        : `Hello ${charge.student.fullName}, this is a payment reminder from ${organization.name}. Your accommodation balance of ${money(balance)} is due on ${due}. Please arrange payment by the due date. Thank you.`;

      const marker = `AUTO_DUE:${charge.id}:${dayKey(now)}`;
      const alreadyQueued = await db.notification.findFirst({
        where: { organizationId: organization.id, studentId: charge.studentId, channel: "WHATSAPP", message: { contains: marker } },
        select: { id: true },
      });
      if (alreadyQueued) continue;

      await db.notification.create({
        data: {
          organizationId: organization.id,
          studentId: charge.studentId,
          channel: "WHATSAPP",
          recipientType: "STUDENT",
          recipientName: charge.student.fullName,
          recipientPhone: charge.student.phone,
          message: `${message}\n\n[${marker}]`,
          status: "QUEUED",
          scheduledAt: now,
        },
      });
      queued += 1;
    }
  }
  return queued;
}
