export function GET() {
  const csv = "transactionCode,phone,amount,transactedAt,reference\nTAA11ABC23,254714464701,18000,2026-09-01T10:30:00+03:00,STUDENT-001\n";
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="mpesa-reconciliation-template.csv"' } });
}
