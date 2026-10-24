import { managedPropertyHost } from "@/lib/property-host-policy";
import { whatsappLink, whatsappNumber } from "@/lib/whatsapp-policy";
import { registrationCountryCode } from "@/lib/tenant-registration";

/**
 * Only prepare a public, non-bearer registration link. This does not issue
 * invitation tokens, activate tenants, or record an actual WhatsApp send.
 */
export type PhoneOnboardingStay = {
  roomNumber: string;
  property: {
    name: string;
    countryCode: string | null;
    customDomain: string | null;
    active: boolean;
    publicListing: boolean;
  };
};
/** Read-only, property-scoped check of an *unverified claim* on a registered phone.
 * This only suppresses repeat outreach; it must never auto-approve a student.
 */
export function pendingPhoneClaim(
  phone: string | null,
  stays: readonly { propertyId: string; countryCode: string | null }[],
  requests: readonly { propertyId: string; phone: string }[],
  organizationId: string,
): boolean {
  if (!phone) return false;
  return stays.some(stay => {
    const registered = whatsappNumber(phone, registrationCountryCode(stay.countryCode, organizationId));
    return Boolean(registered && requests.some(request =>
      request.propertyId === stay.propertyId && request.phone === registered,
    ));
  });
}

export type PhoneOnboardingInput = {
  status: string;
  phone: string | null;
  accountEligible: boolean;
  // True when a current same-property request already claims this student's registered phone.
  // This is not proof the applicant is that student: management must verify the identity.
  pendingRegistration?: boolean;
  // Suppress new drafts if the latest registration backlog could not be fully checked.
  queueComplete?: boolean;
  stays: PhoneOnboardingStay[];
};

export type PhoneOnboardingDraft =
  | { ready: true; host: string; url: string; whatsappHref: string; phoneDigits: string; roomNumber: string }
  | { ready: false; reason: string };

export function buildPhoneOnboardingDraft(input: PhoneOnboardingInput): PhoneOnboardingDraft {
  if (!input.accountEligible) return { ready: false, reason: "Account is no longer eligible. Review the existing resident record." };
  if (input.queueComplete === false) return { ready: false, reason: "The registration queue could not be fully checked. Review existing applications before contacting this student." };
  if (input.pendingRegistration) return { ready: false, reason: "A pending registration already claims this registered number at the same hostel property. Verify that request first; do not send another registration invitation." };
  if (input.status === "PROVIDER_ACCEPTED") {
    return { ready: false, reason: "An invitation was accepted by the email provider, but activation is unconfirmed. Check its delivery and expiry with the resident before reissuing or opening another channel." };
  }
  if (!["MISSING_EMAIL", "EXPIRED", "NO_INVITATION"].includes(input.status)) {
    return { ready: false, reason: "This resident's invitation needs the normal email/provider workflow." };
  }
  if (input.stays.length !== 1) return { ready: false, reason: "A single active or reserved hostel room must be verified before contact." };
  const stay = input.stays[0];
  if (!stay.property.active || !stay.property.publicListing) {
    return { ready: false, reason: "The resident's hostel website is not published." };
  }
  const host = managedPropertyHost(stay.property.customDomain);
  if (!host) return { ready: false, reason: "This hostel has no safe, published registration hostname." };
  const number = whatsappNumber(input.phone, stay.property.countryCode);
  if (!number) return { ready: false, reason: "Review the registered mobile number and country code." };
  const url = `https://${host}/tenant/register`;
  const name = stay.property.name.trim().slice(0, 120);
  if (!name) return { ready: false, reason: "The hostel identity needs confirmation." };
  const message = `Hello. This is a private account access notice from ${name} management. If you are currently staying at this hostel, open ${url} to request your own student account. Enter your real registered full name, registered mobile number, current room and a password that you choose. Management must verify your identity before access is enabled. Never send anyone your password, payment PIN or verification code. If this message is unexpected, contact the hostel directly.`;
  return { ready: true, host, url, whatsappHref: whatsappLink(number, message), phoneDigits: number, roomNumber: stay.roomNumber };
}
