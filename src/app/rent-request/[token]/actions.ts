"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { beginRentCheckout, verifyRentRequest } from "@/lib/rent-payments";
import { safeCheckoutUrl } from "@/lib/pesapal-api";
export async function startRentCheckoutAction(token: string, _state: { error: string }): Promise<{ error: string }> {
  void _state;
  let url: string;
  try { url = await beginRentCheckout(db, token); } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { error: code === "BALANCE_CHANGED" ? "The balance has changed. Return to your student account or ask management for an updated request before paying." : code === "PAYMENT_BEING_CHECKED" ? "Your checkout is being checked. Do not start another payment. Refresh shortly; contact management if this continues." : "This payment request is unavailable. It may have expired or already been paid. Please check with management before paying again." };
  }
  if (!safeCheckoutUrl(url)) return { error: "Secure checkout is unavailable." };
  redirect(url);
}
export async function checkRentPaymentAction(token: string) {
  const request = await db.rentPaymentRequest.findUnique({ where: { token } });
  if (request?.trackingId && (!request.lastCheckedAt || request.lastCheckedAt.getTime() < Date.now() - 20_000)) {
    await verifyRentRequest(db, request.id).catch(() => undefined);
  }
  revalidatePath("/rent-request/" + token);
}
