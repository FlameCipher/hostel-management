import { randomBytes } from "node:crypto";
import type { PrismaClient, RentGateway } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import type { TenantSession } from "@/lib/auth/tenant-session";
import { minorUnits, validAmount, formatMoney } from "@/lib/currency";
import { openServiceSecret, sealServiceSecret } from "@/lib/service-security";
import { PesapalApi, RENT_ORGANIZATION, RENT_ORIGIN, gatewayEnvironmentAllowed, validTrackingId, type PesapalCredentials } from "@/lib/pesapal-api";
import { applyVerifiedRentPayment } from "@/lib/rent-payment-verification";

export async function activeRentGateway(db: PrismaClient, organizationId: string) {
  if (organizationId !== RENT_ORGANIZATION || process.env.VERCEL_ENV !== "production") return null;
  return db.rentGateway.findFirst({ where: { organizationId, active: true, environment: "LIVE" }, orderBy: { createdAt: "desc" } });
}
function apiFor(gateway: RentGateway) {
  if (gateway.organizationId !== RENT_ORGANIZATION || !gatewayEnvironmentAllowed(gateway.environment)) throw Error("GATEWAY_NOT_AVAILABLE");
  return new PesapalApi(JSON.parse(openServiceSecret(gateway.credentials, gateway.organizationId)), "LIVE");
}
export async function connectRentGateway(db: PrismaClient, session: SessionPayload, credentials: PesapalCredentials) {
  if (!Number.isSafeInteger(session.sessionVersion) || session.role !== "OWNER" || session.organizationId !== RENT_ORGANIZATION || process.env.VERCEL_ENV !== "production") throw Error("OWNER_REQUIRED");
  if (Object.values(credentials).some(value => !value || value.length > 512)) throw Error("CREDENTIALS_REQUIRED");
  const sealed = sealServiceSecret(JSON.stringify(credentials), session.organizationId);
  const api = new PesapalApi(credentials, "LIVE");
  await api.authenticate();
  // Adds this application's listener; never modifies the merchant's other IPNs.
  const notificationId = await api.registerNotification();
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${session.organizationId} FOR UPDATE`;
    const actor = await tx.user.findFirst({ where: { id: session.userId, organizationId: session.organizationId, role: "OWNER", active: true, sessionVersion: session.sessionVersion } });
    if (!actor) throw Error("OWNER_REQUIRED");
    if (await tx.rentGateway.findFirst({ where: { organizationId: session.organizationId, active: true } })) throw Error("ALREADY_CONNECTED");
    const gateway = await tx.rentGateway.create({ data: { organizationId: session.organizationId, environment: "LIVE", credentials: sealed, notificationId } });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "RENT_GATEWAY_CONNECTED", entityType: "RentGateway", entityId: gateway.id, metadata: { provider: "Pesapal", environment: "LIVE" } } });
  });
}

type RequestInput = { id: string; chargeId: string; amount: number; payerName: string; payerEmail?: string; payerPhone?: string };
export async function createRentRequest(db: PrismaClient, actor: { staff: SessionPayload } | { tenant: TenantSession }, input: RequestInput) {
  const session = "staff" in actor ? actor.staff : actor.tenant;
  if (!Number.isSafeInteger(session.sessionVersion)) throw Error("FINANCE_ACCESS_DENIED");
  const gateway = await activeRentGateway(db, session.organizationId);
  if (!gateway) throw Error("GATEWAY_NOT_CONNECTED");
  const email = input.payerEmail?.trim().toLowerCase() || null;
  const phone = input.payerPhone?.replace(/[\s()-]/g, "") || null;
  if (!/^R-[a-f0-9-]{36}$/.test(input.id) || !input.payerName.trim() || input.payerName.length > 100 || (!email && !phone) || (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) || (phone && !/^\+?\d{9,15}$/.test(phone))) throw Error("CHECK_PAYER_DETAILS");
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${session.organizationId} FOR UPDATE`;
    const staffId = "staff" in actor ? actor.staff.userId : null;
    if ("staff" in actor) {
      if (!await tx.user.findFirst({ where: { id: staffId!, organizationId: session.organizationId, active: true, sessionVersion: session.sessionVersion, role: { in: ["OWNER", "ADMIN", "MANAGER"] } } })) throw Error("FINANCE_ACCESS_DENIED");
    } else if (!await tx.student.findFirst({ where: { id: actor.tenant.studentId, organizationId: session.organizationId, portalEnabled: true, portalSessionVersion: session.sessionVersion, status: { not: "ARCHIVED" } } })) throw Error("STUDENT_ACCESS_DENIED");
    const existing = await tx.rentPaymentRequest.findUnique({ where: { id: input.id } });
    if (existing) {
      if (existing.organizationId !== session.organizationId || existing.createdById !== staffId || ("tenant" in actor && existing.studentId !== actor.tenant.studentId)) throw Error("REQUEST_NOT_FOUND");
      return existing;
    }
    const charge = await tx.charge.findFirst({ where: { id: input.chargeId, organizationId: session.organizationId, ...("tenant" in actor ? { studentId: actor.tenant.studentId } : {}) }, include: { payments: { where: { reversedAt: null }, select: { amount: true } } } });
    if (!charge || charge.currency !== "KES" || charge.status === "WAIVED") throw Error("CHARGE_NOT_FOUND");
    const balance = minorUnits(Number(charge.amount), charge.currency) - charge.payments.reduce((sum, payment) => sum + minorUnits(Number(payment.amount), charge.currency), 0);
    if (!validAmount(input.amount, charge.currency) || input.amount <= 0 || minorUnits(input.amount, charge.currency) > balance) throw Error("CHECK_AMOUNT");
    // Bound repeated new requests, including retries with different IDs.
    if (await tx.rentPaymentRequest.count({ where: { organizationId: session.organizationId, chargeId: charge.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } } }) >= 10) throw Error("TOO_MANY_REQUESTS");
    const request = await tx.rentPaymentRequest.create({ data: { id: input.id, token: randomBytes(32).toString("base64url"), organizationId: session.organizationId, chargeId: charge.id, studentId: charge.studentId, gatewayId: gateway.id, createdById: staffId, amount: input.amount, currency: charge.currency, payerName: input.payerName.trim(), payerEmail: email, payerPhone: phone, expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
    await tx.auditLog.create({ data: { organizationId: session.organizationId, actorUserId: staffId, action: "RENT_PAYMENT_REQUESTED", entityType: "RentPaymentRequest", entityId: request.id, metadata: { chargeId: charge.id, amount: input.amount, currency: charge.currency } } });
    return request;
  });
}

export async function beginRentCheckout(db: PrismaClient, token: string) {
  const request = await db.rentPaymentRequest.findUnique({ where: { token }, include: { gateway: true } });
  if (!request || request.expiresAt < new Date() || request.paymentId || !request.gateway.active) throw Error("REQUEST_UNAVAILABLE");
  const api = apiFor(request.gateway);
  if (!request.checkoutUrl) await api.authenticate();
  // Claim once. An ambiguous timeout never creates a second payable order.
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${request.organizationId} FOR UPDATE`;
    const charge = await tx.charge.findFirst({ where: { id: request.chargeId, organizationId: request.organizationId, studentId: request.studentId, currency: request.currency }, include: { payments: { where: { reversedAt: null }, select: { amount: true } } } });
    if (!charge || charge.status === "WAIVED" || minorUnits(Number(request.amount), request.currency) > minorUnits(Number(charge.amount), request.currency) - charge.payments.reduce((sum, p) => sum + minorUnits(Number(p.amount), request.currency), 0)) throw Error("BALANCE_CHANGED");
    if (request.checkoutUrl && ["PENDING", "FAILED"].includes(request.status)) return;
    const claim = await tx.rentPaymentRequest.updateMany({ where: { id: request.id, status: "READY", paymentId: null, expiresAt: { gt: new Date() } }, data: { status: "CREATING" } });
    if (claim.count !== 1) throw Error("PAYMENT_BEING_CHECKED");
  });
  if (request.checkoutUrl && ["PENDING", "FAILED"].includes(request.status)) return request.checkoutUrl;
  try {
    const result = await api.submit({ id: request.id, amount: Number(request.amount), currency: request.currency, notificationId: request.gateway.notificationId, name: request.payerName, email: request.payerEmail, phone: request.payerPhone });
    await db.rentPaymentRequest.updateMany({ where: { id: request.id, status: { in: ["CREATING", "CHECKING"] } }, data: { ...result, trackingId: result.trackingId.toLowerCase(), status: "PENDING", exception: null } });
    return result.checkoutUrl;
  } catch {
    await db.rentPaymentRequest.updateMany({ where: { id: request.id, status: "CREATING" }, data: { status: "CHECKING", exception: "ORDER_RESPONSE_UNCONFIRMED" } });
    throw Error("PAYMENT_BEING_CHECKED");
  }
}

export async function verifyRentRequest(db: PrismaClient, id: string, trackingId?: string) {
  const order = await db.rentPaymentRequest.findUnique({ where: { id }, include: { gateway: true } });
  const tracking = trackingId || order?.trackingId;
  if (!order || !validTrackingId(tracking) || (order.trackingId && order.trackingId.toLowerCase() !== tracking.toLowerCase()) || (!order.trackingId && !["CREATING", "CHECKING"].includes(order.status))) throw Error("REQUEST_NOT_FOUND");
  const provider = await apiFor(order.gateway).status(tracking);
  if (provider.merchant_reference !== order.id) throw Error("REFERENCE_MISMATCH");
  return applyVerifiedRentPayment(db, order.id, tracking, provider);
}

export async function sendRentRequestEmail(db: PrismaClient, id: string, organizationId: string) {
  const order = await db.rentPaymentRequest.findFirst({ where: { id, organizationId, status: "READY", expiresAt: { gt: new Date() } } });
  if (!order?.payerEmail) throw Error("EMAIL_REQUIRED");
  const key = process.env.RESEND_API_KEY, from = process.env.RECEIPT_EMAIL_FROM;
  if (!key || !from) throw Error("EMAIL_NOT_CONFIGURED");
  // Resend guarantees idempotency for 24 hours. Never retry an ambiguous send outside that window.
  if (order.emailStatus === "SENT") return;
  if (order.emailAttemptedAt && order.emailAttemptedAt.getTime() < Date.now() - 23 * 3_600_000) throw Error("EMAIL_STATUS_UNKNOWN");
  const claimed = await db.rentPaymentRequest.updateMany({ where: { id, organizationId, emailStatus: { in: ["NOT_SENT", "FAILED"] } }, data: { emailStatus: "SENDING", emailAttemptedAt: order.emailAttemptedAt || new Date() } });
  if (!claimed.count) throw Error("EMAIL_IN_PROGRESS");
  try {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": "rent-request-" + order.id }, signal: AbortSignal.timeout(15_000), body: JSON.stringify({ from, to: [order.payerEmail], subject: "MMAMBUGUA HOSTEL rent payment request", text: `MMAMBUGUA HOSTEL has requested ${formatMoney(Number(order.amount), order.currency)} for hostel rent.\n\nReview and pay securely: ${RENT_ORIGIN}/rent-request/${order.token}\n\nPayments are collected through Sampesa Group Limited on Pesapal. The student and charge are already linked. If this request is unexpected, contact hostel management before paying. This request expires in seven days.` }) });
    if (!response.ok) throw Error("EMAIL_SEND_FAILED");
    await db.rentPaymentRequest.update({ where: { id }, data: { emailStatus: "SENT" } });
  } catch {
    await db.rentPaymentRequest.updateMany({ where: { id, emailStatus: "SENDING" }, data: { emailStatus: "FAILED" } });
    throw Error("EMAIL_SEND_FAILED");
  }
}

export async function reconcileRentRequests(db: PrismaClient) {
  if (process.env.VERCEL_ENV !== "production") return { checked: 0, failed: 0 };
  const rows = await db.rentPaymentRequest.findMany({ where: { organizationId: RENT_ORGANIZATION, trackingId: { not: null }, status: { in: ["PENDING", "FAILED", "COMPLETED", "REVIEW"] }, nextCheckAt: { lte: new Date() } }, orderBy: { nextCheckAt: "asc" }, take: 10 });
  let failed = 0;
  await Promise.all(rows.map(async row => {
    try { await verifyRentRequest(db, row.id); } catch {
      failed++;
      await db.rentPaymentRequest.update({ where: { id: row.id }, data: { exception: "PROVIDER_CHECK_RETRY", nextCheckAt: new Date(Date.now() + 900_000) } });
    }
  }));
  return { checked: rows.length, failed };
}
