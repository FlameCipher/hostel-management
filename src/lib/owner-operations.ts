/** Read-only owner worklist. Counts are operational records, not proof of delivery, absence or safety. */
export type OwnerOperationsCounts={
  inactivePortals:number;
  pendingApplications:number;
  pendingReceipts:number;
  activeCaretakers:number;
};
export type OwnerOperation={key:"registration"|"accounts"|"receipts"|"caretaker";href:string;label:string;detail:string};
export function ownerOperationLinks(input:OwnerOperationsCounts):OwnerOperation[]{
  const out:OwnerOperation[]=[];
  const count=(value:number)=>Number.isSafeInteger(value)&&value>0?value:0;
  const applicants=count(input.pendingApplications);
  const inactive=count(input.inactivePortals);
  const receipts=count(input.pendingReceipts);
  if(applicants)out.push({
    key:"registration",href:"/students/registrations",
    label:`${applicants} registration application${applicants===1?"":"s"} to review`,
    detail:"Verify each student against the existing registered name, phone and room before approving",
  });
  if(inactive)out.push({
    key:"accounts",href:"/communications/invitations/mobile",
    label:`${inactive} active student${inactive===1?"":"s"} without portal access`,
    detail:"Review existing invitations and share a public registration link only when appropriate",
  });
  if(receipts)out.push({
    key:"receipts",href:"/payments?delivery=all",
    label:`${receipts} receipt${receipts===1?"":"s"} needing delivery follow-up`,
    detail:"Check student contact details and provider status before sending or resending",
  });
  if(count(input.activeCaretakers)===0)out.push({
    key:"caretaker",href:"/users/new?role=CARETAKER",
    label:"No active caretaker account",
    detail:"Owner must independently authorize and enrol named gate staff before relying on gate or SOS response",
  });
  return out;
}
