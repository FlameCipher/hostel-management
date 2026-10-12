import { whatsappNumber } from "@/lib/whatsapp-policy";

/** Normalise mobile contacts where a country is known without guessing that
 * every international hostel uses the Kenyan numbering plan.
 *
 * Non-mobile/landline contacts are retained (rather than fabricated into
 * international mobiles); existing validation still controls acceptance.
 */
export function normalizeGuardianPhone(phone: string, country?: string | null) {
  const entered = phone.trim();
  if (!entered) return "";
  return whatsappNumber(entered, country) ?? entered;
}

function comparableName(name: string | null | undefined) {
  return (name ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export type GuardianContact = {
  name: string | null | undefined;
  phone: string | null | undefined;
};

export function guardianContactComparison(
  existing: GuardianContact | null,
  proposed: GuardianContact,
  country?: string | null,
) {
  const oldName = existing?.name?.trim() ?? "";
  const newName = proposed.name?.trim() ?? "";
  const oldPhone = existing?.phone?.trim() ?? "";
  const newPhone = proposed.phone?.trim() ?? "";
  const normalizedOld = normalizeGuardianPhone(oldPhone, country);
  const normalizedNew = normalizeGuardianPhone(newPhone, country);
  return {
    nameSame: Boolean(oldName && newName) && comparableName(oldName) === comparableName(newName),
    nameFormattingOnly: Boolean(oldName && newName) && oldName !== newName &&
      comparableName(oldName) === comparableName(newName),
    phoneSame: Boolean(oldPhone && newPhone) && normalizedOld === normalizedNew,
    phoneFormattingOnly: Boolean(oldPhone && newPhone) && oldPhone !== newPhone &&
      normalizedOld === normalizedNew,
    proposedInternationalPhone: normalizedNew,
  };
}
