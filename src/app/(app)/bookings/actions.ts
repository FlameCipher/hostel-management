"use server";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { updateBooking } from "@/lib/booking-requests";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export async function updateBookingAction(f:FormData){
 const session=await requireSession();let failed=true;
 try{failed=Boolean((await updateBooking(db,session,f.get("id"),f.get("status"))).error);}catch{}
 revalidatePath("/bookings");redirect(failed?"/bookings?error=1":"/bookings");
}
