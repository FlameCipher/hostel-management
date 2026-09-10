export function GET() {
  const csv = "fullName,phone,email,university,admissionNumber,nationalId,admittedAt,status,guardianName,guardianPhone,guardianRelationship,guardianEmail,notes\nJane Wanjiku,0712345678,jane@example.com,JKUAT,SCT211-0001/2026,34567890,2026-09-01,ACTIVE,Mary Wanjiku,0723456789,Mother,mary@example.com,\n";
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="student-import-template.csv"' } });
}
