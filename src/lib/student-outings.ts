import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantSession } from "./auth/tenant-session";
import type { SessionPayload } from "./auth/session";
import { residentTenant, residentStaff } from "./resident-access";
import { hostelTimeZone, visitLocalTime } from "./resident-policy";

const studentAction=z.object({
 action:z.enum(["GO_OUT","REPORT_LATE","REPORT_RETURN"]),
 requestId:z.string().uuid().optional(),
 outingId:z.string().min(1).max(128).optional(),
 expectedReturnLocal:z.string().max(20).optional(),
 note:z.string().trim().max(180).default(""),
});
const staffAction=z.object({
 id:z.string().min(1).max(128),
 action:z.enum(["ACKNOWLEDGE_LATE","VERIFY_RETURN"]),
 verified:z.boolean(),
 note:z.string().trim().min(10).max(400),
});

/** The student reports an intention or a return. Neither is GPS nor gate proof. */
export function outingAttention(out:{
 status:string;expectedReturnAt:Date;lateNotifiedAt:Date|null;
 lateAcknowledgedAt:Date|null;studentReturnedAt:Date|null
},now:Date) {
 return {
  hasNoConfirmedReturn:out.status!=="VERIFIED_RETURN",
  overdueUnconfirmed:out.status==="OUT"&&out.expectedReturnAt<now,
  lateNoticeUnacknowledged:out.status==="OUT"&&out.lateNotifiedAt!==null&&out.lateAcknowledgedAt===null,
  returnAwaitingGate:out.status==="RETURN_REPORTED",
 };
}

export async function reportStudentOuting(db:PrismaClient,session:TenantSession|null,raw:unknown,now=new Date()):
Promise<{error?:string;success?:string}> {
 if(!session)return {error:"Please sign in to your own student portal."};
 const parsed=studentAction.safeParse(raw);
 if(!parsed.success)return {error:"Choose an outing action and complete any required return time."};
 const input=parsed.data,organizationId=session.organizationId,studentId=session.studentId;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${studentId}
     AND "organizationId"=${organizationId} FOR UPDATE`;
  if(!await residentTenant(tx,session))
   return {error:"Only a currently active resident can update their own voluntary return status."};
  if(input.action==="GO_OUT"){
    if(!input.requestId)return {error:"Refresh this form and try again."};
    const previous=await tx.studentOuting.findUnique({
      where:{organizationId_studentId_requestId:{organizationId,studentId,requestId:input.requestId}},
      select:{id:true},
    });
    if(previous)return {success:"Your earlier going-out update is already saved. It does not confirm your physical whereabouts."};
  }
  const stays=await tx.occupancy.findMany({
    where:{organizationId,studentId,status:"ACTIVE",semester:{organizationId},
      room:{organizationId,property:{organizationId,active:true}}},
    select:{id:true,room:{select:{number:true,propertyId:true,
      property:{select:{timeZone:true,countryCode:true}}}}},
    take:2,
  });
  if(stays.length!==1)return {error:"The hostel must verify your current room before accepting this update."};
  const stay=stays[0],tz=hostelTimeZone(stay.room.property.timeZone,stay.room.property.countryCode);
  if(input.action==="GO_OUT"){
    const expected=visitLocalTime(input.expectedReturnLocal??"",tz);
    if(!expected||expected.getTime()<=now.getTime()+5*60000||
       expected.getTime()>now.getTime()+7*86400000)
       return {error:"Select a valid expected return at least 5 minutes ahead, and within 7 days, in the hostel's displayed time zone."};
    const active=await tx.studentOuting.findFirst({where:{organizationId,studentId,
      status:{in:["OUT","RETURN_REPORTED"]}},select:{id:true}});
    if(active)return {error:"You already have an open outing or a return awaiting gate confirmation. Contact security if that record is incorrect."};
    if(await tx.studentOuting.count({where:{organizationId,studentId,
      createdAt:{gte:new Date(now.getTime()-86400000)}}})>=12)
       return {error:"Too many outing updates today. Contact management to review the record."};
    const created=await tx.studentOuting.create({data:{
      organizationId,studentId,propertyId:stay.room.propertyId,occupancyId:stay.id,
      requestId:input.requestId!,roomLabel:stay.room.number,status:"OUT",
      leftAt:now,expectedReturnAt:expected,initialExpectedReturnAt:expected,
    },select:{id:true}});
    await tx.auditLog.create({data:{organizationId,action:"STUDENT_OUTING_REPORTED",
      entityType:"StudentOuting",entityId:created.id,metadata:{propertyId:stay.room.propertyId}}});
    return {success:"Going-out intention recorded. This is self-reported, not a witnessed gate departure. Security has not necessarily read it."};
  }
  if(!input.outingId)return {error:"Select the current outing before updating your return."};
  await tx.$queryRaw`SELECT id FROM "StudentOuting" WHERE id=${input.outingId}
      AND "organizationId"=${organizationId} AND "studentId"=${studentId} FOR UPDATE`;
  const entry=await tx.studentOuting.findFirst({
    where:{id:input.outingId,organizationId,studentId,
      propertyId:stay.room.propertyId,occupancyId:stay.id},
    select:{id:true,status:true,expectedReturnAt:true},
  });
  if(!entry)return {error:"Your outing does not match the current hostel allocation. Contact security."};
  if(input.action==="REPORT_RETURN"){
    if(entry.status==="RETURN_REPORTED")
      return {success:"Your return was already reported. A gate officer must separately verify actual entry."};
    if(entry.status!=="OUT")return {error:"This outing is already closed."};
    await tx.studentOuting.update({where:{id:entry.id},data:{
      status:"RETURN_REPORTED",studentReturnedAt:now,
    }});
    await tx.auditLog.create({data:{organizationId,action:"STUDENT_RETURN_SELF_REPORTED",
      entityType:"StudentOuting",entityId:entry.id}});
    return {success:"Return reported by you. It is NOT yet a verified arrival at the hostel gate."};
  }
  if(entry.status!=="OUT")return {error:"Only a currently open outing can receive a late-arrival notice."};
  const newReturn=visitLocalTime(input.expectedReturnLocal??"",tz);
  if(!newReturn||newReturn.getTime()<=Math.max(now.getTime()+5*60000,entry.expectedReturnAt.getTime())||
     newReturn.getTime()>now.getTime()+24*3600000)
     return {error:"Choose a later expected return, at least five minutes ahead and within 24 hours, using the hostel's time zone."};
  await tx.studentOuting.update({where:{id:entry.id},data:{
    expectedReturnAt:newReturn,lateNotifiedAt:now,lateMessage:input.note||null,
    lateAcknowledgedAt:null,lateAcknowledgedById:null,
  }});
  await tx.auditLog.create({data:{organizationId,action:"STUDENT_LATE_RETURN_REPORTED",
    entityType:"StudentOuting",entityId:entry.id,metadata:{lateExtensionMinutes:Math.round(
      (newReturn.getTime()-entry.expectedReturnAt.getTime())/60000)}}});
  return {success:"Late-return notice saved for the hostel gate team. It is a request, not approval to enter after hours. Contact security directly if urgent."};
 },{timeout:15000});
}

/** Gate staff record ONLY actual observed check-in or their own notice review. */
export async function recordStaffOutingResponse(db:PrismaClient,session:SessionPayload|null,raw:unknown,now=new Date()):
Promise<{error?:string;success?:string}> {
 if(!session)return {error:"Sign in as authorized hostel staff."};
 const parsed=staffAction.safeParse(raw);
 if(!parsed.success)return {error:"Choose an action, confirm a real check, and enter a factual note (10–400 characters)."};
 const input=parsed.data,organizationId=session.organizationId;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${session.userId}
     AND "organizationId"=${organizationId} FOR SHARE`;
  if(!await residentStaff(tx,session)||!input.verified)
   return {error:"Only active, authorized staff who actually completed the stated check may update the gate record."};
  await tx.$queryRaw`SELECT id FROM "StudentOuting" WHERE id=${input.id}
     AND "organizationId"=${organizationId} FOR UPDATE`;
  const entry=await tx.studentOuting.findFirst({where:{id:input.id,organizationId},
    select:{id:true,status:true,lateNotifiedAt:true,lateAcknowledgedAt:true}});
  if(!entry)return {error:"The requested outing is unavailable in this hostel."};
  if(input.action==="ACKNOWLEDGE_LATE"){
    if(entry.status!=="OUT"||!entry.lateNotifiedAt||entry.lateAcknowledgedAt)
     return {error:"There is no pending late-return notice to acknowledge."};
    await tx.studentOuting.update({where:{id:entry.id},data:{
      lateAcknowledgedAt:now,lateAcknowledgedById:session.userId,
    }});
  }else{
    if(entry.status!=="RETURN_REPORTED")
      return {error:"The student must first report their return; then staff must personally verify gate entry."};
    await tx.studentOuting.update({where:{id:entry.id},data:{
      status:"VERIFIED_RETURN",verifiedReturnAt:now,verifiedById:session.userId,
    }});
  }
  await tx.auditLog.create({data:{organizationId,actorUserId:session.userId,
    action:input.action==="ACKNOWLEDGE_LATE"?"STUDENT_LATE_NOTICE_ACKNOWLEDGED":"STUDENT_GATE_RETURN_VERIFIED",
    entityType:"StudentOuting",entityId:entry.id,metadata:{note:input.note}}});
  return {success:input.action==="ACKNOWLEDGE_LATE"
     ?"Late notice acknowledged in the system. Actual staffing/permission arrangements still require direct confirmation."
     :"Gate officer recorded personally verified return. No location history was inferred."};
 },{timeout:15000});
}
