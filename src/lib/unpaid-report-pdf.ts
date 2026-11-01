import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { UnpaidReport } from "./unpaid-report";
const clean = (text: string) => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "-");
export async function unpaidReportPdf(report: UnpaidReport, recipient: { name: string; role: string }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(.16,.23,.27), muted = rgb(.35,.43,.47), line = rgb(.83,.87,.89);
  const fit = (value: string, width: number, size = 9) => {
    const words = clean(value).split(/\s+/), lines: string[] = []; let current = "";
    for (const word of words) {
      const candidate=current ? current+" "+word : word;
      if(regular.widthOfTextAtSize(candidate,size)<=width){current=candidate;continue;}
      if(current){lines.push(current);current="";}
      for(const ch of word){if(regular.widthOfTextAtSize(current+ch,size)>width){lines.push(current);current="";}current+=ch;}
    }
    if (current) lines.push(current); return lines.length ? lines : [""];
  };
  let page = pdf.addPage([595.28,841.89]), y = 0;
  const text = (value: string, x: number, at: number, size = 9, strong = false) => page.drawText(clean(value), { x, y: at, size, font: strong ? bold : regular, color: ink });
  function header() {
    text(report.organizationName.slice(0,70), 36, 800, 15, true);
    text("UNPAID RENT BALANCES - CONFIDENTIAL STAFF COPY",36,778,11,true);
    text("Prepared " + new Date(report.generatedAt).toLocaleString("en-GB", {timeZone:"Africa/Nairobi"}) + " (Nairobi)",36,759,8);
    text("For: " + recipient.name.slice(0,65) + " / " + recipient.role,36,744,8);
    text("Current tenants only. Agreements pause demands; future balances are not overdue.",36,727,8);
    page.drawRectangle({x:36,y:691,width:523,height:24,color:rgb(.92,.95,.95)});
    ["Student", "Room", "Unpaid", "Overdue", "Status"].forEach((v,i)=>text(v,[42,218,265,355,445][i],699,9,true)); y=676;
  }
  header();
  for (const row of report.rows) {
    const cells = [fit(row.name,165),fit(row.room,35),fit(row.balance,80),fit(row.overdue,80),fit(row.status,105)];
    const height = Math.max(...cells.map(c=>c.length))*12 + 14;
    if (y-height < 74) { page=pdf.addPage([595.28,841.89]); header(); }
    cells.forEach((lines,i)=>lines.forEach((v,j)=>text(v,[42,218,265,355,445][i],y-j*12)));
    page.drawLine({start:{x:36,y:y-height+14},end:{x:559,y:y-height+14},thickness:.5,color:line}); y-=height;
  }
  if (!report.rows.length) text("No unpaid balances found for current tenants.",42,y);
  const pages=pdf.getPages();
  pages.forEach((p,i)=>{p.drawText(clean(`${report.rows.length} accounts | ${report.reviewCount} excluded for ledger review | Page ${i+1} of ${pages.length}`),{x:36,y:47,size:8,font:regular,color:muted});p.drawText("Internal follow-up only. Honour agreed dates. Do not forward to student groups.",{x:36,y:32,size:8,font:regular,color:muted});});
  pdf.setTitle("Unpaid rent balances - confidential staff copy"); pdf.setAuthor(report.organizationName);
  return pdf.save();
}
