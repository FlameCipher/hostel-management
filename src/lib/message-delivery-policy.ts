export type DeliveryState = { label: string; sent: boolean; delivered: boolean; queued: boolean; attention: boolean };
const state = (label: string, flags: Partial<Omit<DeliveryState,"label">> = {}): DeliveryState => ({label,sent:false,delivered:false,queued:false,attention:false,...flags});
export function whatsappMessageState(input: { requested: boolean; provider?: string | null; manual?: string | null; ready: boolean; phone: boolean; consent: boolean; predatesConnection?: boolean; tooLong?: boolean; needsNewDraft?: boolean }) {
  if (input.provider === "READ") return state("Read on WhatsApp",{sent:true,delivered:true});
  if (input.provider === "DELIVERED") return state("Delivered on WhatsApp",{sent:true,delivered:true});
  if (input.provider === "SENT") return state("Sent on WhatsApp; delivery pending",{sent:true});
  if (["ACCEPTED","SENDING"].includes(input.provider ?? "")) return state("Processing; delivery not confirmed",{queued:true});
  if (["FAILED","REVIEW","CANCELLED"].includes(input.provider ?? "")) return state(input.provider === "REVIEW" ? "Send outcome uncertain — review required" : `WhatsApp ${input.provider!.toLowerCase()}`,{attention:true});
  if (input.manual === "SENT") return state("Marked sent manually — unverified",{attention:true});
  if (input.manual === "OPENED_FOR_SENDING") return state("Opened in WhatsApp — sending unconfirmed",{attention:true});
  if (["FAILED","CANCELLED"].includes(input.manual ?? "")) return state(`WhatsApp ${input.manual!.toLowerCase()}`,{attention:true});
  if (!input.requested && !input.manual && !input.provider) return state("WhatsApp not requested");
  if (!input.phone) return state("Not sent — add a valid mobile number",{attention:true});
  if (input.needsNewDraft) return state("Not sent — update contact details and create the reminder again",{attention:true});
  if (!input.ready) return state("Not sent — automatic WhatsApp is not connected",{attention:true});
  if (!input.consent) return state("Not sent — student WhatsApp opt-in needed",{attention:true});
  if (input.predatesConnection) return state("Not sent — draft predates sender connection",{attention:true});
  if (input.tooLong) return state("Not sent — shorten the WhatsApp message",{attention:true});
  return state("Queued for WhatsApp — not sent yet",{queued:true});
}
