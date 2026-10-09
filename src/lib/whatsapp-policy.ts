import { createHash } from "node:crypto";
import { managedPropertyHost } from "@/lib/property-host-policy";

// Local Kenyan numbers require a known Kenyan property. Other countries use
// explicit international numbers, avoiding guesses based on a phone's prefix.
export function whatsappNumber(phone: string | null | undefined, country?: string | null) {
  if (!phone || !/^[+\d\s().-]+$/.test(phone)) return null;
  const compact = phone.replace(/[\s().-]/g, "");
  let digits = compact.replace(/^\+/, "").replace(/^00/, "");
  if (!compact.startsWith("+") && !compact.startsWith("00") && country === "KE") {
    if (/^0[17]\d{8}$/.test(digits)) digits = `254${digits.slice(1)}`;
    else if (/^[17]\d{8}$/.test(digits)) digits = `254${digits}`;
  }
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
export function whatsappLink(number: string, message = "") {
  if (!/^[1-9]\d{7,14}$/.test(number)) throw Error("INVALID_WHATSAPP_NUMBER");
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
export function whatsappDraftId(organizationId: string, requestId: string, kind: string, recipientId: string) {
  return "wa_" + createHash("sha256").update(JSON.stringify([organizationId, requestId, kind, recipientId])).digest("hex");
}
export const manualDeliveryLabels: Record<string, string> = {
  QUEUED: "Ready to open", OPENED_FOR_SENDING: "Opened in WhatsApp — send not confirmed",
  SENT: "Marked sent manually", FAILED: "Needs attention", CANCELLED: "Cancelled",
};
export function propertyTenantLogin(properties: Array<{ customDomain: string | null; publicListing: boolean }>) {
  const host = properties.length === 1 && properties[0].publicListing ? managedPropertyHost(properties[0].customDomain) : null;
  return `https://${host || "studentshostels.com"}/tenant/login`;
}
