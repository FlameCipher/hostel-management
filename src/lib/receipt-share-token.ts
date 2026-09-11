import { SignJWT, jwtVerify } from "jose";

const RECEIPT_SHARE_ISSUER = "mama-mbugua-hostel";
const RECEIPT_SHARE_AUDIENCE = "payment-receipt-pdf";
const RECEIPT_SHARE_DURATION = "30d";

function receiptShareSecret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not configured");
  return new TextEncoder().encode(value);
}

export async function createReceiptShareToken({
  paymentId,
  organizationId,
}: {
  paymentId: string;
  organizationId: string;
}) {
  return new SignJWT({ paymentId, organizationId, purpose: "receipt-pdf" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(RECEIPT_SHARE_ISSUER)
    .setAudience(RECEIPT_SHARE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(RECEIPT_SHARE_DURATION)
    .sign(receiptShareSecret());
}

export async function verifyReceiptShareToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, receiptShareSecret(), {
      issuer: RECEIPT_SHARE_ISSUER,
      audience: RECEIPT_SHARE_AUDIENCE,
    });
    if (
      payload.purpose !== "receipt-pdf" ||
      typeof payload.paymentId !== "string" ||
      typeof payload.organizationId !== "string"
    ) {
      return null;
    }
    return {
      paymentId: payload.paymentId,
      organizationId: payload.organizationId,
    };
  } catch {
    return null;
  }
}
