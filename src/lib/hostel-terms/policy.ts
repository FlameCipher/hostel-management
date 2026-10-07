import { createHash } from "node:crypto";
import { z } from "zod";

export const TERMS_ORGANIZATION_ID = "mama-mbugua-hostel";
export const TERMS_VERSION = "2026-10-08-v2";
export const TERMS_CONTACT = { name: "MMAMBUGUA HOSTEL", phone: "0714 464 701", location: "Gachororo, Highpoint Road, approximately 500 metres from JKUAT Gate B, Juja" };
export const TERMS_RULES = [
  { title: "Semester rent and arrears", text: "Rent is charged per semester. Outstanding rent balances must be cleared by the 10th of every month. Your allocated room, semester and recorded semester rent are shown in this agreement; refer to your account statement for subsequent payments and adjustments." },
  { title: "Entry and exit hours", text: "Students may enter and leave the hostel between 6:30 a.m. and 10:00 p.m. Plan your movements within these hours. Contact management in advance if an exceptional arrangement is needed." },
  { title: "Visitors and occupants", text: "The hostel accommodates students only. Visitors are not permitted inside students' rooms and must remain in the designated common area. Do not accommodate unauthorized overnight guests or transfer your room to another person." },
  { title: "Long holidays and returning", text: "No accommodation charges apply while you are away at home during a long holiday, provided you inform management and confirm that you will return for the next semester. If your room is retained during the holiday and you later decide to vacate instead of returning, rent for the retained holiday months becomes payable at the applicable room rate. Confirm the holiday dates, room reservation and rate with management before leaving. This rule does not apply to a room properly surrendered and cleared before the holiday." },
  { title: "Personal belongings and safety", text: "Keep your room locked, safeguard your keys and belongings, and report suspicious activity or security concerns promptly. Do not leave valuables unattended. Management cannot guarantee that loss or theft will never occur; CCTV supports security but is not a guarantee. Students' responsibilities do not remove management's applicable responsibilities." },
  { title: "CCTV and Wi-Fi", text: "CCTV and Wi-Fi are provided at no additional charge. Use shared services responsibly. CCTV is used for security in shared areas; do not tamper with cameras or network equipment. Report faults to management." },
  { title: "Borehole water", text: "Borehole water is available. Always boil it before drinking." },
  { title: "Cleanliness, respect and damage", text: "Keep rooms and common areas clean, dispose of rubbish correctly and avoid excessive noise. Respect other residents and their property. Report damage, maintenance issues and unsafe conditions promptly." },
  { title: "Moving out and clearance", text: "Inform management before moving out. Arrange a room inspection, return keys and clear outstanding charges. Obtain confirmation that the room has been surrendered. Refer to any separately agreed deposit and notice terms; this document does not introduce a new deposit, notice period, penalty or automatic charge." },
] as const;
export const TERMS_DECLARATION = "I have read and understood these hostel rules and accommodation terms, including semester rent, payment deadlines, holiday room retention and visitors. I agree to comply with them. By selecting Accept accommodation and agree to hostel terms, I accept my accommodation at MMAMBUGUA HOSTEL subject to all the terms above. My digital acceptance is recorded against my student account, and I can download a copy.";

const ruleSchema = z.object({ title: z.string().min(1).max(150), text: z.string().min(1).max(3000) });
export const snapshotSchema = z.object({
  version: z.string().min(1).max(100), hostel: z.object({ name: z.string().min(1).max(200), phone: z.string().max(100), location: z.string().max(500) }),
  student: z.object({ name: z.string().min(1).max(300), admissionNumber: z.string().max(200), institution: z.string().max(300) }),
  room: z.string().max(200), semester: z.string().max(300), semesterStart: z.string(), semesterEnd: z.string(),
  rentCharges: z.array(z.object({ amount: z.string().regex(/^\d+\.\d{2}$/), dueDate: z.string() })).max(100),
  rules: z.array(ruleSchema).min(1).max(30), declaration: z.string().min(1).max(3000),
  // Optional so previously signed snapshots retain their original hash and signature meaning.
  acceptanceMethod: z.literal("DIGITAL_ACCEPTANCE").optional(),
});
export type TermsSnapshot = z.infer<typeof snapshotSchema>;
export const acceptanceSchema = z.object({ version: z.literal(TERMS_VERSION), occupancyId: z.string().min(1).max(128).regex(/^[\w-]+$/), documentHash: z.string().regex(/^[a-f0-9]{64}$/), agree: z.literal("yes") });
export function termsHash(snapshot: TermsSnapshot, signatureName: string, acceptedAt: Date, reference: string) {
  return createHash("sha256").update(JSON.stringify({ snapshot: snapshotSchema.parse(snapshot), signatureName, acceptedAt: acceptedAt.toISOString(), reference })).digest("hex");
}
