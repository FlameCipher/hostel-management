import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { snapshotSchema, termsHash } from "./policy";

type Record = { reference: string; version: string; snapshot: unknown; signatureName: string; acceptedAt: Date; integrityHash: string };
export async function generateTermsPdf(record: Record) {
  const snapshot = snapshotSchema.parse(record.snapshot);
  if (record.version !== snapshot.version || record.integrityHash !== termsHash(snapshot, record.signatureName, record.acceptedAt, record.reference)) throw new Error("TERMS_INTEGRITY_MISMATCH");
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(.15, .22, .28);
  let page = doc.addPage([595.28, 841.89]);
  let y = 786;
  const text = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e\xa0-\xff]/g, "-");
  function line(value: string, heading = false) {
    if (heading && y < 135) { page = doc.addPage([595.28, 841.89]); y = 786; }
    const font = heading ? bold : regular, size = heading ? 11 : 10;
    let current = "";
    // Character wrapping also bounds unusually long names and reference strings.
    for (const word of text(value).split(/\s+/)) {
      if (current && font.widthOfTextAtSize(current + " " + word, size) > 499) { draw(current); current = ""; }
      for (const char of (current ? " " : "") + word) {
        if (font.widthOfTextAtSize(current + char, size) > 499) { draw(current); current = ""; }
        current += char;
      }
    }
    if (current) draw(current);
    y -= 7;
    function draw(s: string) {
      if (y < 75) { page = doc.addPage([595.28, 841.89]); y = 786; }
      page.drawText(s, { x: 48, y, size, font, color: ink }); y -= 15;
    }
  }
  line(snapshot.hostel.name, true);
  line("SIGNED HOSTEL RULES AND ACCOMMODATION TERMS", true);
  line(snapshot.hostel.location);
  line("Contact: " + snapshot.hostel.phone);
  line("Reference: " + record.reference);
  line("Terms version: " + snapshot.version);
  line("Student: " + snapshot.student.name, true);
  line("Institution: " + snapshot.student.institution + " | Admission number: " + snapshot.student.admissionNumber);
  line("Room: " + snapshot.room + " | Semester: " + snapshot.semester);
  line("Semester dates: " + snapshot.semesterStart.slice(0, 10) + " to " + snapshot.semesterEnd.slice(0, 10));
  line(snapshot.rentCharges.length ? "Recorded semester rent at signing: " + snapshot.rentCharges.map(c => "KES " + c.amount + " (account due date " + c.dueDate.slice(0, 10) + ")").join("; ") : "Semester rent has not yet been recorded. Confirm the amount with management; this agreement does not invent a rent charge.");
  snapshot.rules.forEach((rule, i) => { line(`${i + 1}. ${rule.title}`, true); line(rule.text); });
  line("STUDENT ACCEPTANCE", true);
  line(snapshot.declaration);
  line("Electronic signature (typed full name): " + record.signatureName, true);
  line("Signed: " + new Intl.DateTimeFormat("en-KE", {dateStyle:"long", timeStyle:"short", timeZone:"Africa/Nairobi"}).format(record.acceptedAt) + " EAT");
  line("Acceptance was recorded from the student's authenticated portal account. This is a typed electronic signature, not a certificate-based digital signature. Management retains the same acceptance record.");
  line("Record checksum: " + record.integrityHash);
  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(`MMAMBUGUA HOSTEL | Signed terms | Page ${i + 1} of ${pages.length}`, { x: 48, y: 35, size: 8, font: regular, color: ink }));
  doc.setTitle("Signed terms " + record.reference); doc.setAuthor(snapshot.hostel.name); doc.setCreationDate(record.acceptedAt); doc.setModificationDate(record.acceptedAt);
  return doc.save();
}
export async function termsPdfResponse(record: Record | null) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!record) return new Response("Signed terms not found", { status: 404, headers });
  try {
    const pdf = await generateTermsPdf(record);
    const body = new ArrayBuffer(pdf.byteLength); new Uint8Array(body).set(pdf);
    // Database-generated reference is additionally constrained for header safety.
    const filename = record.reference.replace(/[^A-Za-z0-9-]/g, "");
    return new Response(body, { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"` } });
  } catch { return new Response("Signed terms temporarily unavailable", { status: 503, headers }); }
}
