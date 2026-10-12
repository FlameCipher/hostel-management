import { normalizeGuardianPhone, normalizeStudentLookupName } from "@/lib/student-identifiers";

export type GuardianReviewContact = {
  name: string | null | undefined;
  phone: string | null | undefined;
};

/** Display-only comparison; never changes student, guardian or approval records. */
export function compareGuardianUpdate(
  previous: GuardianReviewContact | null,
  proposed: GuardianReviewContact,
) {
  const previousName = previous?.name?.trim() ?? "";
  const proposedName = proposed.name?.trim() ?? "";
  const previousPhone = previous?.phone?.trim() ?? "";
  const proposedPhone = proposed.phone?.trim() ?? "";
  const sameName = Boolean(previousName && proposedName) &&
    normalizeStudentLookupName(previousName) === normalizeStudentLookupName(proposedName);
  const samePhone = Boolean(previousPhone && proposedPhone) &&
    normalizeGuardianPhone(previousPhone) === normalizeGuardianPhone(proposedPhone);
  return {
    nameFormattingOnly: sameName && previousName !== proposedName,
    phoneFormattingOnly: samePhone && previousPhone !== proposedPhone,
    normalizedProposedPhone: normalizeGuardianPhone(proposedPhone),
    sameName,
    samePhone,
  };
}
