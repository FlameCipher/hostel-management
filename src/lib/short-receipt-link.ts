import { createHash, randomBytes } from "node:crypto";

export function receiptCodeHash(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function newReceiptLink() {
  const code = randomBytes(16).toString("base64url");
  return { code, codeHash: receiptCodeHash(code), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
}

export function receiptWhatsAppNumber(phone: string) {
  const digits = phone.replace(/[^0-9]/g, "");
  const number = digits.startsWith("00") ? digits.slice(2)
    : /^0[17]\d{8}$/.test(digits) ? `254${digits.slice(1)}`
    : /^[17]\d{8}$/.test(digits) ? `254${digits}` : digits;
  return /^[1-9]\d{7,14}$/.test(number) ? number : null;
}
