/** Read-only Meta WhatsApp connection status for management diagnostics.
 * This helper deliberately receives booleans, never provider tokens or secrets.
 */
export type WhatsAppReadinessInput = {
  enabledForProperty: boolean;
  senderExists: boolean;
  senderVerified: boolean;
  senderEnabled: boolean;
  webhookConfigured: boolean;
  eligibleOptIns: number;
};

export function whatsappReadiness(input:WhatsAppReadinessInput) {
  const senderReady=input.senderExists && input.senderVerified && input.senderEnabled;
  const ready=input.enabledForProperty && senderReady && input.webhookConfigured && input.eligibleOptIns>0;
  const blockers:string[]=[];
  if(!input.enabledForProperty) blockers.push("Enable WhatsApp for this hostel in Settings.");
  if(!input.senderExists) blockers.push("Connect a verified WhatsApp Business Cloud sender.");
  else if(!input.senderVerified) blockers.push("Verify the sender and approved message template with Meta.");
  else if(!input.senderEnabled) blockers.push("Enable automatic delivery when the sender is ready.");
  if(!input.webhookConfigured) blockers.push("Complete the Meta webhook configuration to receive delivery results.");
  if(input.eligibleOptIns===0) blockers.push("Record explicit recipient permission before sending automated messages.");
  return {
    ready,
    senderReady,
    senderLabel: !input.senderExists ? "Not connected" : !input.senderVerified ? "Verification required" : !input.senderEnabled ? "Paused" : "Verified and enabled",
    webhookLabel: input.webhookConfigured ? "Configured" : "Setup incomplete",
    recipientLabel: input.eligibleOptIns===0 ? "No opt-ins yet" : `${input.eligibleOptIns} opted in`,
    blockers,
  };
}
