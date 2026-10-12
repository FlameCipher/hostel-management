import assert from "node:assert/strict";
import {PDFDocument,StandardFonts} from "pdf-lib";

/** Check that an issued receipt can generate stable bytes for provider idempotency retries. */
async function buildFixedReceipt() {
  const doc=await PDFDocument.create();
  const date=new Date("2026-10-12T03:48:01.984Z");
  doc.setCreationDate(date);
  doc.setModificationDate(date);
  doc.setTitle("Receipt MMH-2026-00043");
  doc.setAuthor("MMAMBUGUA HOSTEL");
  doc.setSubject("Payment receipt");
  doc.setCreator("StudentsHostels");
  const page=doc.addPage([595.28,841.89]);
  const font=await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Receipt MMH-2026-00043", {x:48,y:700,font,size:12});
  return Buffer.from(await doc.save());
}
async function run(){
  const [first,second]=await Promise.all([buildFixedReceipt(),buildFixedReceipt()]);
  assert.equal(first.length,second.length);
  assert.ok(first.equals(second),"Identical receipt data must produce identical PDF bytes.");
  console.log("Stable PDF metadata/idempotency fixture test passed");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
