import { normalizedResidentName } from "@/lib/resident-policy";
import { whatsappNumber } from "@/lib/whatsapp-policy";

export type PendingTenantRegistration = {
  id:string;
  organizationId:string;
  propertyId:string;
  fullName:string;
  phone:string;
  roomNumber:string;
  createdAt:Date;
  expiresAt:Date;
  status:string;
};

export type PendingRegistrationGroup<T extends PendingTenantRegistration> = {
  key:string;
  latest:T;
  attempts:T[];
  phoneConflict:boolean;
  latestOnly:boolean;
};

export type RegistrationStudentCandidate = {
  id:string;fullName:string;phone:string;portalEnabled:boolean;
  portalPasswordHash:string|null;portalInviteBlocked:boolean;
  portalLastLoginAt:Date|null;
  occupancies:{status:string;room:{number:string;propertyId:string}}[];
};

const normalizedRoom=(value:string)=>value.trim().toLocaleLowerCase();
const phoneKey=(row:Pick<PendingTenantRegistration,"propertyId"|"phone">)=>
  row.propertyId+"|"+row.phone;
export function registrationIdentityKey(
  row:Pick<PendingTenantRegistration,"propertyId"|"phone"|"fullName"|"roomNumber">,
){
  return JSON.stringify([
    row.propertyId,row.phone,normalizedResidentName(row.fullName),
    normalizedRoom(row.roomNumber),
  ]);
}

/** Group repeat submissions only when hostel, number, name and room match.
 * Different names/rooms sharing a phone are never merged or approved silently.
 */
export function groupPendingRegistrations<T extends PendingTenantRegistration>(
  rows:readonly T[],now=new Date(),
):PendingRegistrationGroup<T>[] {
  const valid=rows.filter(r=>r.status==="PENDING"&&r.expiresAt>now);
  const byKey=new Map<string,T[]>();
  const phoneIdentities=new Map<string,Set<string>>();
  for(const item of valid){
    const key=registrationIdentityKey(item);
    byKey.set(key,[...(byKey.get(key)??[]),item]);
    const pk=phoneKey(item);
    const identities=phoneIdentities.get(pk)??new Set<string>();
    identities.add(key);phoneIdentities.set(pk,identities);
  }
  const groups=[...byKey.entries()].map(([key,items])=>{
    const attempts=[...items].sort((a,b)=>
      b.createdAt.getTime()-a.createdAt.getTime()||
      b.id.localeCompare(a.id));
    return {
      key,latest:attempts[0],attempts,
      phoneConflict:(phoneIdentities.get(phoneKey(attempts[0]))?.size??0)>1,
      latestOnly:true,
    };
  });
  return groups.sort((a,b)=>
    b.latest.createdAt.getTime()-a.latest.createdAt.getTime()||
    b.latest.id.localeCompare(a.latest.id));
}

export type RegistrationTriageReason =
  "EXACT_MATCH"|"ALREADY_ENABLED"|"NO_EXACT_MATCH"|"MULTIPLE_MATCHES"|"PHONE_CONFLICT"|"OLDER_ATTEMPT";

export function registrationCandidateTriage<T extends PendingTenantRegistration>(
  group:PendingRegistrationGroup<T>,
  students:readonly RegistrationStudentCandidate[],
  countryCode:string|null,
):{reason:RegistrationTriageReason;matches:RegistrationStudentCandidate[];approvable:boolean}{
  if(group.phoneConflict)return {reason:"PHONE_CONFLICT",matches:[],approvable:false};
  const candidates=students.filter(student=>
    normalizedResidentName(student.fullName)===normalizedResidentName(group.latest.fullName)&&
    whatsappNumber(student.phone,countryCode)===group.latest.phone&&
    student.occupancies.some(o=>o.status==="ACTIVE"&&
      o.room.propertyId===group.latest.propertyId&&
      normalizedRoom(o.room.number)===normalizedRoom(group.latest.roomNumber)),
  );
  const active=candidates.filter(s=>s.portalEnabled||s.portalPasswordHash!==null||
    s.portalInviteBlocked||s.portalLastLoginAt!==null);
  if(active.length)return {reason:"ALREADY_ENABLED",matches:[],approvable:false};
  if(candidates.length===0)return {reason:"NO_EXACT_MATCH",matches:[],approvable:false};
  if(candidates.length>1)return {reason:"MULTIPLE_MATCHES",matches:candidates,approvable:false};
  return {reason:"EXACT_MATCH",matches:candidates,approvable:true};
}

export const registrationTriageLabels:Record<RegistrationTriageReason,string>={
  EXACT_MATCH:"Exact record match — verify identity before activating",
  ALREADY_ENABLED:"Account already in use — use recovery",
  NO_EXACT_MATCH:"No exact existing resident match",
  MULTIPLE_MATCHES:"Multiple matching residents — investigate",
  PHONE_CONFLICT:"One phone used with different names or rooms — investigate",
  OLDER_ATTEMPT:"Newer registration already exists",
};

export function activeQueueSummary(groups:readonly PendingRegistrationGroup<PendingTenantRegistration>[],
  triages:readonly {reason:RegistrationTriageReason}[]){
  return {
    pendingGroups:groups.length,
    attempts:groups.reduce((sum,g)=>sum+g.attempts.length,0),
    repeatSubmissions:groups.reduce((sum,g)=>sum+g.attempts.length-1,0),
    readyForIndependentVerification:triages.filter(t=>t.reason==="EXACT_MATCH").length,
    needsInvestigation:triages.filter(t=>t.reason!=="EXACT_MATCH").length,
    phoneConflictGroups:groups.filter(g=>g.phoneConflict).length,
  };
}
