import { createHash } from "node:crypto";
import { normalizeGuardianPhone } from "./student-identifiers";
import { whatsappNumber } from "./whatsapp-policy";

export type GuardianContactRecord = {
  id: string;
  studentId: string;
  phone: string;
  name: string;
  relationship: string | null;
  email: string | null;
  student: {
    fullName: string;
    status: string;
    admissionNumber: string | null;
  };
};

export type GuardianPhoneCorrection = {
  id: string;
  studentId: string;
  previousPhone: string;
  newPhone: string;
};

/** Conservative conversion: the form 07xxxxxxxx or 01xxxxxxxx is
 * unambiguously Kenyan only when all active hostel properties are in Kenya.
 * Never rewrite international numbers, landlines, or uncertain values.
 */
export function guardianPhoneCorrections(
  records: readonly Pick<GuardianContactRecord, "id" | "studentId" | "phone">[],
  country: string | null,
): GuardianPhoneCorrection[] {
  if (country !== "KE") return [];
  return records.flatMap((r) => {
    if (!/^0[17]\d{8}$/.test(r.phone)) return [];
    const next = normalizeGuardianPhone(r.phone);
    if (!/^254[17]\d{8}$/.test(next)) return [];
    return [{ id: r.id, studentId: r.studentId, previousPhone: r.phone, newPhone: next }];
  }).sort((a, b) => a.id.localeCompare(b.id));
}

export function guardianCorrectionFingerprint(
  changes: readonly GuardianPhoneCorrection[],
): string {
  return createHash("sha256").update(JSON.stringify(
    changes.map(c => [c.id, c.studentId, c.previousPhone, c.newPhone])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  )).digest("hex");
}

export function guardianContactSummary(
  records: readonly GuardianContactRecord[],
  country: string | null,
  studentCount: number,
) {
  const candidateCount = guardianPhoneCorrections(records, country).length;
  const callable = records.filter(r => whatsappNumber(r.phone, country)).length;
  const contactReady = records.filter(r =>
    r.name.trim().length > 1 && !!whatsappNumber(r.phone, country)
  ).length;
  return {
    students: studentCount,
    guardians: records.length,
    missingGuardians: Math.max(0, studentCount - records.length),
    contactReady,
    validMobileContacts: callable,
    formatCorrections: candidateCount,
    missingEmail: records.filter(r => !r.email?.trim()).length,
    unreadablePhones: records.length - callable,
  };
}

export function uniqueCountry(
  properties: readonly {countryCode: string | null}[],
): string | null {
  if (!properties.length || properties.some(p => !p.countryCode)) return null;
  const unique = [...new Set(properties.map(p => p.countryCode!.trim().toUpperCase()))];
  return unique.length === 1 ? unique[0] : null;
}

export function guardianContactHref(phone: string, country: string | null) {
  const international = whatsappNumber(phone, country);
  return international ? {
    phoneHref: "tel:+" + international,
    whatsappHref: "https://wa.me/" + international,
  } : {
    phoneHref: null,
    whatsappHref: null,
  };
}
