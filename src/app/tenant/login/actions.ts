"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createTenantSession, deleteTenantSession } from "@/lib/auth/tenant-session";
import { TERMS_ORGANIZATION_ID } from "@/lib/hostel-terms/policy";
import { normalizeStudentPhone } from "@/lib/student-identifiers";
import { db } from "@/lib/db";

export type TenantLoginState = { error: string };
const schema = z.object({ email: z.string().trim().min(5).max(254), password: z.string().min(8).max(128) });

export async function tenantLoginAction(_state: TenantLoginState, formData: FormData): Promise<TenantLoginState> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your registered mobile number or email and password." };
  const identifier=parsed.data.email;
  const isEmail=z.string().email().safeParse(identifier).success;
  const phone=normalizeStudentPhone(identifier);
  if(!isEmail && !/^(?:\+|[0-9])[0-9 ()+-]*$/.test(identifier)) return {error:"The mobile number, email or password is incorrect."};
  const matches=isEmail ? null : await db.$queryRaw<Array<{id:string}>>`
    SELECT id FROM "Student" WHERE "portalEnabled"=true AND status != 'ARCHIVED'
    AND CASE WHEN regexp_replace(phone, '[^0-9]', '', 'g') LIKE '0%'
      THEN '254' || substring(regexp_replace(phone, '[^0-9]', '', 'g') FROM 2)
      WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[17][0-9]{8}$'
      THEN '254' || regexp_replace(phone, '[^0-9]', '', 'g')
      ELSE regexp_replace(phone, '[^0-9]', '', 'g') END = ${phone} LIMIT 2`;
  const students = await db.student.findMany({
    where: { ...(isEmail ? {email:{equals:identifier.toLowerCase(),mode:"insensitive" as const}} : {id:{in:(matches??[]).map(x=>x.id)}}), portalEnabled: true, status: { not: "ARCHIVED" } },
    select: { id: true, organizationId: true, fullName: true, portalPasswordHash: true }, take: 2,
  });
  if (students.length !== 1 || !students[0].portalPasswordHash || !(await compare(parsed.data.password, students[0].portalPasswordHash))) {
    return { error: "The mobile number, email or password is incorrect." };
  }
  const student = students[0];
  await db.student.update({ where: { id: student.id }, data: { portalLastLoginAt: new Date() } });
  await createTenantSession({ studentId: student.id, organizationId: student.organizationId, name: student.fullName });
  redirect(student.organizationId === TERMS_ORGANIZATION_ID ? "/tenant/terms" : "/tenant/account");
}

export async function tenantLogoutAction() {
  await deleteTenantSession();
  redirect("/tenant/login");
}
