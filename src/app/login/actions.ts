"use server";

import { cookies } from "next/headers";
import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, deleteSession } from "@/lib/auth/session";
import { requestPropertyContext } from "@/lib/property-host";
import { db } from "@/lib/db";

export type LoginState = { error: string };

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address and password." };
  }

  const context=await requestPropertyContext();
  if(!context.shared && !context.property) return {error:"Hostel address unavailable."};
  const users = await db.user.findMany({
    where: { email: parsed.data.email.toLowerCase(), active: true, organization:{status:"ACTIVE"}, ...(context.property?{organizationId:context.property.organizationId}:{}) },
    take:2,
    select: {
      id: true,
      organizationId: true,
      name: true,
      role: true,
      passwordHash: true,
    },
  });

  if(users.length !== 1) return {error:"Use your hostel website to sign in, or sign in with SYSTEM IN ONE."};
  const user=users[0];
  if (!user || !(await compare(parsed.data.password, user.passwordHash))) {
    return { error: "The email address or password is incorrect." };
  }

  await createSession({
    userId: user.id,
    organizationId: user.organizationId,
    name: user.name,
    role: user.role,
  });

  redirect((await cookies()).get("hostel_sso_code") ? "/platform/connection" : "/dashboard");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
