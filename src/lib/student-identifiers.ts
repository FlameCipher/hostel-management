export type StudentIdentifiers = {
  phone: string;
  admissionNumber?: string | null;
  nationalId?: string | null;
};

export function normalizeStudentPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return digits;
}

/** Canonicalizes Kenyan guardian numbers entered as 07/01, 7/1, +254 or 00254.
 * Other explicitly international phone numbers retain their country prefix.
 * Validated form values are stored without punctuation; this does not change existing records.
 */
export function normalizeGuardianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  if (/^00254[17]\d{8}$/.test(digits)) return digits.slice(2);
  return digits;
}

/** A case-only spelling or harmless whitespace difference is not a different identity. */
export function normalizeStudentLookupName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function normalizeStudentDocument(value?: string | null) {
  const normalized = value?.trim().replace(/\s+/g, "").toUpperCase();
  return normalized || null;
}

export function normalizeStudentIdentifiers(values: StudentIdentifiers) {
  return {
    phone: normalizeStudentPhone(values.phone),
    admissionNumber: normalizeStudentDocument(values.admissionNumber),
    nationalId: normalizeStudentDocument(values.nationalId),
  };
}

export function matchingStudentIdentifier(left: StudentIdentifiers, right: StudentIdentifiers) {
  const normalizedLeft = normalizeStudentIdentifiers(left);
  const normalizedRight = normalizeStudentIdentifiers(right);
  if (normalizedLeft.phone === normalizedRight.phone) return "phone number";
  if (normalizedLeft.admissionNumber && normalizedLeft.admissionNumber === normalizedRight.admissionNumber) return "admission number";
  if (normalizedLeft.nationalId && normalizedLeft.nationalId === normalizedRight.nationalId) return "national ID";
  return null;
}
