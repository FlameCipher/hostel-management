/** Meta status callbacks can arrive late, duplicated or out of order.
 * Never turn a confirmed failure back into SENT or downgrade a delivery/read.
 * Contradictory terminal states require manual provider reconciliation.
 */
const providerProgress:Record<string,number>={ACCEPTED:0,SENT:1,DELIVERED:2,READ:3};

export function allowWhatsAppProviderTransition(current:string,incoming:string):boolean{
  if(current==="FAILED"||current==="CANCELLED")return false;
  if(incoming==="FAILED")return current==="ACCEPTED"||current==="SENT";
  if(!(incoming in providerProgress))return false;
  const before=providerProgress[current],after=providerProgress[incoming];
  return Number.isInteger(before)&&after>before;
}
