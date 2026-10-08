"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { saveHostelStaff } from "@/lib/hostel-staff";
export type UserFormState = { error: string };
async function save(id: string | null, form: FormData): Promise<UserFormState> {
  const session = await requireSession();
  let result;
  try { result = await saveHostelStaff(db, session, id, { name: form.get("name"), email: form.get("email"), phone: form.get("phone") || "", role: form.get("role"), password: form.get("password") || "", active: form.get("active") === "on" }); }
  catch { return { error: "Changes could not be saved. Refresh and try again." }; }
  if (!result.success) return { error: result.error };
  revalidatePath("/users");
  redirect("/users");
}
export async function createUserAction(_state: UserFormState, form: FormData) { return save(null, form); }
export async function updateUserAction(id: string, _state: UserFormState, form: FormData) { return save(id, form); }
