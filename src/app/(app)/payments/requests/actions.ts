"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaffFinanceAccess } from "@/lib/staff-route-authorization";
import { requireTenantSession } from "@/lib/auth/tenant-session";
import { createRentRequest, sendRentRequestEmail, connectRentGateway, beginRentCheckout } from "@/lib/rent-payments";
import { safeCheckoutUrl } from "@/lib/pesapal-api";
import type { RentActionState } from "@/components/rent-request-form";

function input(data: FormData) {
  return { id: String(data.get("requestId") || ""), chargeId: String(data.get("chargeId") || ""), amount: Number(data.get("amount")), payerName: String(data.get("payerName") || ""), payerEmail: String(data.get("payerEmail") || ""), payerPhone: String(data.get("payerPhone") || "") };
}
function failure(error: unknown): RentActionState {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = { CHECK_PAYER_DETAILS: "Enter the payer’s name and a valid email or mobile number.", CHECK_AMOUNT: "Enter an amount greater than zero and no more than the current charge balance.", TOO_MANY_REQUESTS: "Several requests already exist for this charge. Use the latest request below.", GATEWAY_NOT_CONNECTED: "The owner needs to connect the payment gateway first.", CHARGE_NOT_FOUND: "This rent charge is no longer available. Refresh your account." };
  return { error: messages[code] || "We could not prepare the payment request. Refresh the page and try again." };
}
async function openMpesaCheckout(token: string): Promise<never> {
  let url: string | undefined;
  try { url = await beginRentCheckout(db, token); } catch { /* Preserve the request if checkout is unavailable; never create a replacement on timeout. */ }
  if (url && safeCheckoutUrl(url)) redirect(url);
  redirect("/rent-request/" + token + "?checkout=unavailable");
}
export async function staffRentRequestAction(_state: RentActionState, data: FormData): Promise<RentActionState> {
  const session = await requireStaffFinanceAccess();
  const values = input(data);
  const email = data.get("delivery") === "email";
  const checkout = !data.get("delivery") || data.get("delivery") === "checkout";
  if (checkout && !values.payerPhone.trim()) return { error: "Enter the payer’s M-Pesa mobile number to open prompt checkout. Email is optional." };
  if (email && !values.payerEmail) return { error: "Enter the payer’s email, or choose Create a link to copy or share." };
  let id: string;
  let token: string;
  let sendFailed = false;
  try {
    const request = await createRentRequest(db, { staff: session }, values);
    id = request.id;
    token = request.token;
    if (email) try { await sendRentRequestEmail(db, id, session.organizationId); } catch { sendFailed = true; }
  } catch (error) { return failure(error); }
  revalidatePath("/payments/requests");
  if (checkout) {
    await openMpesaCheckout(token);
  }
  redirect("/payments/requests?created=" + id + (sendFailed ? "&send=failed" : ""));
}
export async function tenantRentRequestAction(_state: RentActionState, data: FormData): Promise<RentActionState> {
  const session = await requireTenantSession();
  const values = input(data);
  if (!values.payerPhone.trim()) return { error: "Enter the payer’s M-Pesa mobile number." };
  let token: string;
  try { token = (await createRentRequest(db, { tenant: session }, values)).token; } catch (error) { return failure(error); }
  return openMpesaCheckout(token);
}
export async function connectRentGatewayAction(_state: RentActionState, data: FormData): Promise<RentActionState> {
  const session = await requireStaffFinanceAccess();
  if (session.role !== "OWNER" || data.get("confirm") !== "yes") return { error: "The hostel owner must authorise this connection." };
  try { await connectRentGateway(db, session, { consumer_key: String(data.get("consumerKey") || "").trim(), consumer_secret: String(data.get("consumerSecret") || "").trim() }); } catch {
    return { error: "Connection was not completed. Check your live Pesapal API credentials and try again. If already connected, refresh this page." };
  }
  revalidatePath("/pay-rent"); revalidatePath("/payments");
  redirect("/payments/gateway?connected=yes");
}
