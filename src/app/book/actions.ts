"use server";
import { requestPropertyContext } from "@/lib/property-host";
import { submitBooking, type BookingState } from "@/lib/booking-requests";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
export async function bookingAction(_state:BookingState,f:FormData):Promise<BookingState>{
 const {property}=await requestPropertyContext();if(!property)return{error:"Open the hostel's own website to request a room."};
 if(f.get("website"))return{error:"Request could not be submitted."};
 try {const result=await submitBooking(db,property,{fullName:f.get("fullName"),phone:f.get("phone"),email:f.get("email"),roomTypeId:f.get("roomTypeId"),preferredMoveIn:f.get("preferredMoveIn"),consent:f.get("consent")==="on"},f.get("ticket"));if(result.reference)revalidatePath("/bookings");return result;}catch{return{error:"We could not confirm your request. Retry from this page or contact management."};}
}
