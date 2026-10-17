import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { residentStaff } from "@/lib/resident-access";
import { MMAMBUGUA_EMERGENCY_ORGANIZATION_ID, MMAMBUGUA_EMERGENCY_PHONES } from "@/lib/hostel-emergency-contacts";
import {type CallTestResult} from "@/lib/emergency-call-acceptance-policy";

export const EMERGENCY_CALL_TEST_AUDIT_ACTION="HOSTEL_EMERGENCY_CALL_TEST";
const testSchema=z.object({
 line:z.enum(["0","1"]).transform(Number),
 result:z.enum(["ANSWERED","NO_ANSWER","WRONG_RECIPIENT","FAILED_TO_CONNECT"]),
 note:z.string().trim().min(10).max(280),
 personallyTested:z.literal(true),
});
export type EmergencyCallTestRecord={
 line:number;result:CallTestResult;note:string;createdAt:Date;testedBy:string;
};

export function latestEmergencyCallTests(rows:readonly {
 createdAt:Date;actor?:{name:string}|null;metadata:unknown
}[]):EmergencyCallTestRecord[]{
 const latest=new Map<number,EmergencyCallTestRecord>();
 for(const item of rows){
  const m=item.metadata;
  if(!m||typeof m!=="object"||Array.isArray(m))continue;
  const v=m as Record<string,unknown>;
  const parsed=z.object({line:z.number().int().min(0).max(1),
   result:z.enum(["ANSWERED","NO_ANSWER","WRONG_RECIPIENT","FAILED_TO_CONNECT"]),
   note:z.string().max(280)}).safeParse(v);
  if(!parsed.success||latest.has(parsed.data.line))continue;
  latest.set(parsed.data.line,{...parsed.data,createdAt:item.createdAt,testedBy:item.actor?.name??"Previous authorized manager"});
 }
 return [...latest.values()].sort((a,b)=>a.line-b.line);
}

/** Call tests are staff self-report ONLY. This function neither dials nor enables SOS. */
export async function recordEmergencyCallTest(
 database:PrismaClient,session:SessionPayload|null,raw:unknown
):Promise<{error?:string;success?:string}>{
 if(!session||session.organizationId!==MMAMBUGUA_EMERGENCY_ORGANIZATION_ID)
  return {error:"Emergency-line verification is available only to MMAMBUGUA HOSTEL's authorized owner or administrator."};
 const parsed=testSchema.safeParse(raw);
 if(!parsed.success)return {error:"Select the correct line, real call outcome and a factual note (10–280 characters). Confirm you personally made the call."};
 const {line,result,note}=parsed.data;
 const display=MMAMBUGUA_EMERGENCY_PHONES[line].display;
 return database.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${session.userId} AND "organizationId"=${session.organizationId} FOR SHARE`;
  const staff=await residentStaff(tx,session);
  if(!staff||!["OWNER","ADMIN"].includes(staff.role))
   return {error:"Only an active owner or administrator can record an emergency-phone acceptance check."};
  await tx.auditLog.create({data:{
   organizationId:session.organizationId,actorUserId:session.userId,
   action:EMERGENCY_CALL_TEST_AUDIT_ACTION,
   entityType:"Organization",entityId:session.organizationId,
   metadata:{line,result,note,personallyTested:true},
  }});
  return {success:"Recorded your self-reported call test for "+display+". This is not independent telephone-provider evidence, proof of 24-hour staffing or permission to activate SOS."};
 });
}
