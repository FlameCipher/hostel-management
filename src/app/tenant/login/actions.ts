"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createTenantSession, deleteTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";

export type TenantLoginState = { error: string };
const schema = z.object({ email: z.string().trim().email(), password: z.string().min(8).max(128) });

export async function tenantLoginAction(_state: TenantLoginState, formData: FormData): Promise<TenantLoginState> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter a valid email address and password." };
  const students = await db.student.findMany({
    where: { email: { equals: parsed.data.email.toLowerCase(), mode: "insensitive" }, portalEnabled: true, status: { not: "ARCHIVED" } },
    select: { id: true, organizationId: true, fullName: true, portalPasswordHash: true },
    take: 2,
  });
  if (students.length !== 1 || !students[0].portalPasswordHash || !(await compare(parsed.data.password, students[0].portalPasswordHash))) {
    return { error: "The email address or password is incorrect." };
  }
  const student = students[0];
  await db.student.update({ where: { id: student.id }, data: { portalLastLoginAt: new Date() } });
  await createTenantSession({ studentId: student.id, organizationId: student.organizationId, name: student.fullName });
  redirect("/tenant/account");
}

export async function tenantLogoutAction() {
  await deleteTenantSession();
  redirect("/tenant/login");
}
