"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, deleteSession } from "@/lib/auth/session";
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

  const user = await db.user.findFirst({
    where: { email: parsed.data.email.toLowerCase(), active: true },
    select: {
      id: true,
      organizationId: true,
      name: true,
      role: true,
      passwordHash: true,
    },
  });

  if (!user || !(await compare(parsed.data.password, user.passwordHash))) {
    return { error: "The email address or password is incorrect." };
  }

  await createSession({
    userId: user.id,
    organizationId: user.organizationId,
    name: user.name,
    role: user.role,
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
