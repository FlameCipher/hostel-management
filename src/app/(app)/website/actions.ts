"use server";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { editPropertyPhoto } from "@/lib/property-photography";
export type PhotoState = { error: string; message: string };
export async function updatePhotoAction(_state: PhotoState, form: FormData): Promise<PhotoState> {
  const session = await requireSession();
  let result;
  try { result = await editPropertyPhoto(db, session, { id: form.get("id"), operation: form.get("operation"), caption: form.get("caption") ?? undefined, visible: form.get("visible") === "on", category: form.get("category"), roomTypeId: form.get("roomTypeId"), confirmed: form.get("confirmed") === "on" }); }
  catch { return { error: "Check the photo category, confirm it meets the rules, and keep no more than four photos in each group.", message: "" }; }
  revalidatePath("/"); revalidatePath("/website");
  if (result.deletionUrl) {
    try { await del(result.deletionUrl); await db.propertyPhoto.updateMany({ where: { id: result.id, organizationId: session.organizationId, deletedAt: { not: null } }, data: { url: null } }); }
    catch { return { error: "The photo is hidden from your website. Storage deletion is pending; use Delete again to retry.", message: "" }; }
  }
  return { error: "", message: "Photo updated." };
}
