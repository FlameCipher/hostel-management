import { normalizedResidentName } from "./resident-policy";
import { whatsappNumber } from "./whatsapp-policy";

export type ReviewRegistration = {
  id:string; organizationId:string; propertyId:string;
  fullName:string; phone:string; roomNumber:string;
  createdAt:Date; expiresAt:Date; status:string;
};
export type RegisteredTenant = {
  id:string; organizationId:string; fullName:string; phone:string;
  status:string; portalEnabled:boolean;
  portalPasswordHash:string|null; portalLastLoginAt:Date|null;
  portalInviteBlocked:boolean;
  occupancies:Array<{
    status:string;
    room:{number:string;propertyId:string};
  }>;
};
export type ReviewResultKind =
  | "EXACT_MATCH" | "MULTIPLE_MATCHES" | "ALREADY_ENABLED"
  | "WRONG_ROOM" | "INELIGIBLE" | "UNKNOWN_IDENTITY" | "EXPIRED";

export type RegistrationReviewResult = {
  request:ReviewRegistration;
  kind:ReviewResultKind;
  matchingStudentIds:string[];
  identityExists:boolean;
};
export type RegistrationReviewGroup = {
  key:string;
  fullName:string;
  phone:string;
  propertyId:string;
  submissions:RegistrationReviewResult[];
  conflictingRooms:boolean;
  conflictingPhoneClaims:boolean;
  rooms:string[];
  latest:Date;
};
export type RegistrationCaseKind =
  | "VERIFY_IDENTITY" | "CONFLICT" | "RECORD_REVIEW" | "EXISTING_ACCOUNT" | "EXPIRED";

/** One applicant group is one review case, however many submissions it contains.
 * This label is only a queue priority. It NEVER proves the applicant's identity.
 * Owners must still verify through the existing registered contact or in person.
 */
export function registrationCaseKind(group:RegistrationReviewGroup):RegistrationCaseKind {
  if(group.conflictingRooms || group.conflictingPhoneClaims) return "CONFLICT";
  const latest=group.submissions[0];
  if(!latest || latest.kind==="EXPIRED") return "EXPIRED";
  if(latest.kind==="ALREADY_ENABLED") return "EXISTING_ACCOUNT";
  if(latest.kind==="EXACT_MATCH" && latest.matchingStudentIds.length===1)
    return "VERIFY_IDENTITY";
  return "RECORD_REVIEW";
}
export const registrationCaseLabels:Record<RegistrationCaseKind,string>={
  VERIFY_IDENTITY:"Candidate for independent identity verification",
  CONFLICT:"Conflicting room or phone claims — resolve first",
  RECORD_REVIEW:"Missing, inconsistent or ineligible resident record",
  EXISTING_ACCOUNT:"Existing portal account — use login or recovery",
  EXPIRED:"Request expired — new submission required",
};

export function comparablePhone(phone:string,country:string|null) {
  return whatsappNumber(phone,country) ?? phone.trim().replace(/[^0-9]/g,"");
}
export function registrationIdentityKey(request:Pick<ReviewRegistration,"organizationId"|"propertyId"|"fullName"|"phone">,country:string|null) {
  return JSON.stringify([
    request.organizationId,
    request.propertyId,
    normalizedResidentName(request.fullName),
    comparablePhone(request.phone,country),
  ]);
}

/** Pure read-only review of submitted identity against *existing* student records.
 * A candidate is not a verified identity: staff must verify independently.
 */
export function triageTenantRegistrations(
  requests:readonly ReviewRegistration[],
  students:readonly RegisteredTenant[],
  countryForProperty:(propertyId:string)=>string|null,
  now:Date,
) {
  const results:RegistrationReviewResult[] = [];
  const grouped=new Map<string,RegistrationReviewGroup>();
  for(const request of requests) {
    const country=countryForProperty(request.propertyId);
    const phone=comparablePhone(request.phone,country);
    const name=normalizedResidentName(request.fullName);
    const identities=students.filter(s=>
      s.organizationId===request.organizationId &&
      normalizedResidentName(s.fullName)===name &&
      comparablePhone(s.phone,country)===phone
    );
    const eligible=identities.filter(s=>
      s.status==="ACTIVE"&&!s.portalEnabled&&s.portalPasswordHash===null&&
      s.portalLastLoginAt===null&&!s.portalInviteBlocked &&
      s.occupancies.some(o=>
        o.status==="ACTIVE" && o.room.propertyId===request.propertyId &&
        o.room.number.toLowerCase()===request.roomNumber.toLowerCase()
      )
    );
    const sameRoom=identities.some(s=>s.occupancies.some(o=>
      o.status==="ACTIVE" && o.room.propertyId===request.propertyId &&
      o.room.number.toLowerCase()===request.roomNumber.toLowerCase()));
    const kind:ReviewResultKind=request.expiresAt<=now?"EXPIRED"
      :eligible.length>1?"MULTIPLE_MATCHES"
      :eligible.length===1?"EXACT_MATCH"
      :identities.some(s=>s.portalEnabled)?"ALREADY_ENABLED"
      :identities.length===0?"UNKNOWN_IDENTITY"
      :!sameRoom?"WRONG_ROOM"
      :"INELIGIBLE";
    const result:RegistrationReviewResult={
      request,kind,matchingStudentIds:eligible.map(s=>s.id),identityExists:identities.length>0,
    };
    results.push(result);
    const key=registrationIdentityKey(request,country);
    const group=grouped.get(key);
    if(group){
      group.submissions.push(result);
      if(request.createdAt>group.latest)group.latest=request.createdAt;
      if(!group.rooms.some(r=>r.toLowerCase()===request.roomNumber.toLowerCase()))
        group.rooms.push(request.roomNumber);
      group.conflictingRooms=group.rooms.length>1;
    }else grouped.set(key,{
      key,fullName:request.fullName,phone:request.phone,propertyId:request.propertyId,
      submissions:[result],conflictingRooms:false,conflictingPhoneClaims:false,
      rooms:[request.roomNumber],latest:request.createdAt,
    });
  }
  // Same property and phone with different submitted names must not
  // silently be treated as separate accounts. Flag every affected identity.
  const byPropertyPhone=new Map<string,Set<string>>();
  for(const [key,group] of grouped){
    const request=group.submissions[0].request;
    const country=countryForProperty(group.propertyId);
    const propertyPhone=JSON.stringify([
      request.organizationId,group.propertyId,comparablePhone(group.phone,country),
    ]);
    const identities=byPropertyPhone.get(propertyPhone)??new Set<string>();
    identities.add(key);byPropertyPhone.set(propertyPhone,identities);
  }
  for(const group of grouped.values()){
    const request=group.submissions[0].request;
    const phoneKey=JSON.stringify([
      request.organizationId,group.propertyId,
      comparablePhone(group.phone,countryForProperty(group.propertyId)),
    ]);
    group.conflictingPhoneClaims=(byPropertyPhone.get(phoneKey)?.size??0)>1;
  }
  const groups=[...grouped.values()].sort((a,b)=>
    b.latest.getTime()-a.latest.getTime() || a.key.localeCompare(b.key));
  // Break equal submission timestamps using the same ID order as the approval
  // transaction so the UI never labels a different attempt "newest".
  for(const g of groups)g.submissions.sort((a,b)=>
    b.request.createdAt.getTime()-a.request.createdAt.getTime() ||
    b.request.id.localeCompare(a.request.id));
  const caseCounts={
    verifyIdentity:groups.filter(g=>registrationCaseKind(g)==="VERIFY_IDENTITY").length,
    conflicts:groups.filter(g=>registrationCaseKind(g)==="CONFLICT").length,
    recordReview:groups.filter(g=>registrationCaseKind(g)==="RECORD_REVIEW").length,
    existingAccount:groups.filter(g=>registrationCaseKind(g)==="EXISTING_ACCOUNT").length,
    expired:groups.filter(g=>registrationCaseKind(g)==="EXPIRED").length,
  };
  return {
    groups,results,caseCounts,
    counts:{
      requests:results.length,identities:groups.length,
      exactEligible:results.filter(x=>x.kind==="EXACT_MATCH").length,
      blocked:results.filter(x=>x.kind!=="EXACT_MATCH").length,
      repeatSubmissions:results.length-groups.length,
      duplicateApplicants:groups.filter(g=>g.submissions.length>1).length,
      conflictingRooms:groups.filter(g=>g.conflictingRooms).length,
      conflictingPhoneGroups:groups.filter(g=>g.conflictingPhoneClaims).length,
      expired:results.filter(x=>x.kind==="EXPIRED").length,
    },
  };
}
export const registrationReviewLabels:Record<ReviewResultKind,string>={
  EXACT_MATCH:"Existing record matches — verify identity",
  MULTIPLE_MATCHES:"Multiple possible student records",
  ALREADY_ENABLED:"Account already enabled — use sign-in/recovery",
  WRONG_ROOM:"Registered identity found, but current room differs",
  INELIGIBLE:"Record exists, but is not eligible for activation",
  UNKNOWN_IDENTITY:"No matching registered student identity",
  EXPIRED:"Request expired — new submission required",
};
