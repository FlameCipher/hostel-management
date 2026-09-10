export function GET() {
  const csv = "fullName,phone,university,admissionNumber,nationalId,admittedAt,status,guardianName,guardianPhone,guardianRelationship,guardianEmail,roomNumber,semesterName,checkInAt,notes\nJane Wanjiku,0712345678,JKUAT,SCT211-0001/2026,34567890,2026-09-01,ACTIVE,Mary Wanjiku,0723456789,Mother,mary@example.com,1,September to December 2026,2026-09-01,\n";
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="student-import-template.csv"' } });
}
