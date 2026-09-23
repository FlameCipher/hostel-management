import "server-only";

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ReceiptPdfData = {
  organizationName: string;
  ownerName: string;
  organizationPhone: string;
  receiptNumber: string;
  securityReference?: string | null;
  integrityHash?: string | null;
  issuedAt?: string | null;
  reprintCount?: number;
  verificationUrl?: string | null;
  studentName: string;
  studentPhone: string;
  studentEmail: string | null;
  roomNumber: string;
  semesterName: string;
  paymentDate: string;
  description: string;
  amountReceived: number;
  paymentMethod: string;
  reference: string;
  totalCharge: number;
  balanceRemaining: number;
  nextBalanceDue: string | null;
  receivedBy: string;
  reversed: boolean;
  reversalReason?: string | null;
};

const blue = rgb(0.40, 0.47, 0.53);
const navy = rgb(0.18, 0.25, 0.31);
const muted = rgb(0.39, 0.47, 0.51);
const paleBlue = rgb(0.93, 0.95, 0.96);
const border = rgb(0.78, 0.83, 0.86);
const red = rgb(0.82, 0.12, 0.2);

const money = (value: number) =>
  `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

function pdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "-");
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const words = pdfText(value).split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLabelValue({
  page,
  regular,
  bold,
  label,
  value,
  x,
  y,
  width,
}: {
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  label: string;
  value: string;
  x: number;
  y: number;
  width: number;
}) {
  page.drawText(pdfText(label.toUpperCase()), { x, y, size: 7, font: bold, color: muted });
  const lines = wrapText(value, bold, 10.5, width);
  lines.slice(0, 2).forEach((line, index) => {
    page.drawText(line, { x, y: y - 17 - index * 13, size: 10.5, font: index ? regular : bold, color: navy });
  });
}

export async function generateReceiptPdf(data: ReceiptPdfData) {
  const document = await PDFDocument.create();
  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const width = page.getWidth();
  const margin = 48;
  const contentWidth = width - margin * 2;

  page.drawRectangle({ x: 0, y: 0, width, height: page.getHeight(), color: rgb(1, 1, 1) });
  page.drawText("MMAMBUGUA HOSTEL - OFFICIAL RECEIPT", { x: 92, y: 410, size: 26, font: bold, color: rgb(0.91, 0.93, 0.94), rotate: degrees(35) });
  page.drawRectangle({ x: margin, y: 736, width: contentWidth, height: 68, color: paleBlue, borderColor: border, borderWidth: 1 });
  page.drawRectangle({ x: margin + 16, y: 754, width: 34, height: 34, color: blue });
  page.drawText("MMH", { x: margin + 21, y: 766, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText(pdfText(data.organizationName), { x: margin + 62, y: 776, size: 16, font: bold, color: navy });
  page.drawText("OFFICIAL PAYMENT RECEIPT", { x: margin + 62, y: 758, size: 7.5, font: bold, color: muted });
  page.drawText("RECEIPT NUMBER", { x: 403, y: 779, size: 6.5, font: bold, color: muted });
  page.drawText(pdfText(data.receiptNumber), { x: 403, y: 760, size: 10.5, font: bold, color: blue });
  if ((data.reprintCount ?? 0) > 0) page.drawText(`REPRINT #${data.reprintCount}`, { x: 403, y: 746, size: 6.5, font: bold, color: red });

  if (data.reversed) {
    page.drawRectangle({ x: margin, y: 706, width: contentWidth, height: 22, color: rgb(1, 0.91, 0.92) });
    page.drawText(`REVERSED${data.reversalReason ? ` - ${pdfText(data.reversalReason)}` : ""}`, { x: margin + 12, y: 713, size: 8, font: bold, color: red });
  }

  const top = data.reversed ? 672 : 692;
  drawLabelValue({ page, regular, bold, label: "Received from", value: data.studentName, x: margin, y: top, width: 220 });
  drawLabelValue({ page, regular, bold, label: "Room and semester", value: `${data.roomNumber} | ${data.semesterName}`, x: 309, y: top, width: 238 });
  page.drawText(pdfText([data.studentPhone, data.studentEmail].filter(Boolean).join(" | ")), { x: margin, y: top - 45, size: 8, font: regular, color: muted });

  page.drawLine({ start: { x: margin, y: top - 62 }, end: { x: width - margin, y: top - 62 }, thickness: 1, color: border });
  drawLabelValue({ page, regular, bold, label: "Payment date", value: data.paymentDate, x: margin, y: top - 89, width: 220 });
  drawLabelValue({ page, regular, bold, label: "Payment method", value: data.paymentMethod, x: 309, y: top - 89, width: 238 });

  page.drawRectangle({ x: margin, y: top - 211, width: contentWidth, height: 88, color: paleBlue, borderColor: border, borderWidth: 1 });
  drawLabelValue({ page, regular, bold, label: "Description", value: data.description, x: margin + 16, y: top - 146, width: 285 });
  page.drawText("AMOUNT RECEIVED", { x: 389, y: top - 146, size: 7, font: bold, color: muted });
  page.drawText(money(data.amountReceived), { x: 389, y: top - 174, size: 17, font: bold, color: blue });

  const detailTop = top - 258;
  const details = [
    ["Reference", data.reference],
    ["Total charge", money(data.totalCharge)],
    ["Balance remaining", money(data.balanceRemaining)],
    ["Next balance due", data.nextBalanceDue ?? "Fully paid"],
  ];
  details.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    drawLabelValue({ page, regular, bold, label, value, x: margin + column * 261, y: detailTop - row * 62, width: 225 });
  });

  page.drawLine({ start: { x: margin, y: 272 }, end: { x: width - margin, y: 272 }, thickness: 1, color: border });
  if (data.securityReference) page.drawText(`Security Ref: ${pdfText(data.securityReference)}`, { x: margin, y: 253, size: 7.5, font: bold, color: navy });
  if (data.integrityHash) page.drawText(`Integrity: ${pdfText(data.integrityHash.slice(0, 24).toUpperCase())}`, { x: margin, y: 239, size: 7, font: regular, color: muted });
  if (data.issuedAt) page.drawText(`Issued: ${pdfText(data.issuedAt)}`, { x: 350, y: 253, size: 7, font: regular, color: muted });
  if (data.verificationUrl) page.drawText(`Verify: ${pdfText(data.verificationUrl)}`, { x: margin, y: 225, size: 6.5, font: regular, color: blue });
  page.drawLine({ start: { x: margin, y: 212 }, end: { x: width - margin, y: 212 }, thickness: 1, color: border });
  page.drawText(`Received by: ${pdfText(data.receivedBy)}`, { x: margin, y: 194, size: 9, font: regular, color: navy });
  page.drawText(pdfText(`${data.ownerName} | ${data.organizationPhone}`), { x: margin, y: 176, size: 9, font: regular, color: navy });
  page.drawText(data.reversed
    ? "This receipt is retained only as a reversal audit record."
    : "This computer-generated receipt is valid without a signature.", {
    x: margin,
    y: 150,
    size: 8,
    font: regular,
    color: muted,
  });

  document.setTitle(`Receipt ${pdfText(data.receiptNumber)}`);
  document.setAuthor(pdfText(data.organizationName));
  document.setSubject("Payment receipt");
  document.setCreator("MMAMBUGUA HOSTEL Management System");

  return document.save();
}
