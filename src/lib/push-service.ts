import webpush from "web-push";
import { z } from "zod";
import type { PrismaClient, PushSubscription } from "@/generated/prisma/client";
import { serviceId } from "./service-security";
import { residentAlerts } from "./resident-alerts";
import { residentStaff, residentTenant } from "./resident-access";
import { dueLessonReminders } from "./student-timetable";

export function allowedPushEndpoint(endpoint:string) {
 try {const u=new URL(endpoint);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&!u.hash&&["fcm.googleapis.com","updates.push.services.mozilla.com","web.push.apple.com","notify.windows.com"].some(host=>u.hostname===host||u.hostname.endsWith(`.${host}`));}catch{return false;}
}
export const pushSchema=z.object({endpoint:z.string().max(2048).refine(allowedPushEndpoint),keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{87}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22}$/)})});
export function pushConfigured(env=process.env){return Boolean(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT);}
export const pushSession=(sub:PushSubscription)=>sub.audience==="tenant"?{studentId:sub.accountId,organizationId:sub.organizationId,name:"Push subscriber",sessionVersion:sub.sessionVersion}:{userId:sub.accountId,organizationId:sub.organizationId,name:"Push subscriber",role:"CARETAKER" as const,sessionVersion:sub.sessionVersion};
export async function pushEligible(db:PrismaClient,sub:PushSubscription){
 if(!sub.enabled)return false;
 if(!await db.property.findFirst({where:{organizationId:sub.organizationId,customDomain:sub.host,active:true,publicListing:true},select:{id:true}}))return false;
 const session=pushSession(sub);return sub.audience==="tenant"?Boolean(await residentTenant(db,session as Parameters<typeof residentTenant>[1])):Boolean(await residentStaff(db,session as Parameters<typeof residentStaff>[1]));
}
export async function sendWebPush(sub:PushSubscription,tag:string,kind="ACTIVITY"){
 // No class title, student's name or precise whereabouts are put on a lock screen.
 const lesson=kind==="CLASS_REMINDER",gate=kind==="GATE_UPDATE";
 const url=lesson?"/tenant/timetable":gate?"/outings":"/open-app";
 const title=lesson?"Class reminder":gate?"Hostel gate update":"Your hostel";
 const body=lesson?"A lesson reminder is ready. Open your private class timetable.":
   gate?"A student gate update needs review. Open the hostel security queue.":
   "New activity is ready to review. Open your hostel app to see the details.";
 await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},
   JSON.stringify({title,body,url,kind,tag}),
   {TTL:3600,timeout:8000,vapidDetails:{subject:process.env.VAPID_SUBJECT!,
     publicKey:process.env.VAPID_PUBLIC_KEY!,privateKey:process.env.VAPID_PRIVATE_KEY!}});
}
export async function runPushDelivery(db:PrismaClient,send=sendWebPush,now=new Date()) {
 if(!pushConfigured())return {configured:false,queued:0,sent:0,failed:0};
 let queued=0,sent=0,failed=0;
 const subscriptions=await db.pushSubscription.findMany({where:{enabled:true},orderBy:{updatedAt:"asc"},take:30});
 for(const sub of subscriptions){
  if(!await pushEligible(db,sub)){await db.pushSubscription.update({where:{id:sub.id},data:{enabled:false}});continue;}
  const tenant=sub.audience==="tenant",session=pushSession(sub);
  const alerts=await residentAlerts(db,session,tenant,now);
  const staff=tenant?null:await residentStaff(db,session as Parameters<typeof residentStaff>[1]);
  const manager=!!staff&&["OWNER","ADMIN","MANAGER"].includes(staff.role);
  const latest=tenant?await db.tenantMessage.findFirst({where:{organizationId:sub.organizationId,studentId:sub.accountId,publishAt:{lte:now,gte:sub.createdAt}},orderBy:{publishAt:"desc"},select:{id:true}}):manager?await db.tenantConversationEntry.findFirst({where:{author:"STUDENT",createdAt:{gte:sub.createdAt},conversation:{organizationId:sub.organizationId}},orderBy:{createdAt:"desc"},select:{id:true}}):null;
  const visit=await db.visitorRequest.findFirst({where:{organizationId:sub.organizationId,...(tenant?{studentId:sub.accountId}:{}),status:"REQUESTED",expectedDeparture:{gt:now}},orderBy:{createdAt:"desc"},select:{id:true}});
  const registration=manager?await db.tenantRegistration.findFirst({where:{organizationId:sub.organizationId,status:"PENDING",expiresAt:{gt:now}},orderBy:{createdAt:"desc"},select:{id:true}}):null;
  // Private student timetable: only queue when THIS signed-in student's
  // explicitly opted-in lesson reminder is due. Stable occurrence keys make
  // five-minute cron retries idempotent across devices and deployments.
  if(tenant){
    const lessons=await db.studentLesson.findMany({where:{
      organizationId:sub.organizationId,studentId:sub.accountId,
      active:true,reminderEnabled:true,
    },select:{id:true,organizationId:true,studentId:true,propertyId:true,title:true,
      courseCode:true,venue:true,dayOfWeek:true,startMinutes:true,endMinutes:true,
      timeZone:true,remindBeforeMinutes:true,reminderEnabled:true,active:true},
      take:60});
    const events=dueLessonReminders(lessons,now);
    if(events.length){
      const jobs=events.map(e=>{
        const key=serviceId("class",e.occurrence.lessonId,e.occurrence.localDate,e.kind);
        return {id:serviceId(sub.id,key),subscriptionId:sub.id,eventKey:key,
          kind:"CLASS_REMINDER",subjectId:e.occurrence.lessonId,targetUrl:"/tenant/timetable",
          expiresAt:new Date(e.occurrence.startAt.getTime()+5*60000)};
      });
      queued+=(await db.pushDelivery.createMany({data:jobs,skipDuplicates:true})).count;
    }
  }else{
    // Gate alerts only to already opted-in, currently authorized staff
    // subscriptions. Never claim that a push was read or security is waiting.
    const movement=await db.studentOuting.findMany({where:{
      organizationId:sub.organizationId,
      OR:[{status:"OUT",lateNotifiedAt:{gte:sub.createdAt},lateAcknowledgedAt:null},
          {status:"RETURN_REPORTED",studentReturnedAt:{gte:sub.createdAt}}],
    },select:{id:true,status:true,lateNotifiedAt:true,studentReturnedAt:true},
    orderBy:{updatedAt:"desc"},take:12});
    if(movement.length){
      const jobs=movement.map(out=>{
        const key=serviceId("outing",out.id,out.status,
          out.status==="OUT"?out.lateNotifiedAt?.toISOString()??"":
          out.studentReturnedAt?.toISOString()??"");
        return {id:serviceId(sub.id,key),subscriptionId:sub.id,eventKey:key,
          kind:"GATE_UPDATE",subjectId:out.id,targetUrl:"/outings",
          expiresAt:new Date(now.getTime()+24*3600000)};
      });
      queued+=(await db.pushDelivery.createMany({data:jobs,skipDuplicates:true})).count;
    }
  }
  const fingerprint=serviceId(String(alerts?.overdueCount??0),String(alerts?.pendingVisits??0),String(alerts?.pendingRegistrations??0),latest?.id??"",visit?.id??"",registration?.id??"",...(alerts?.overdue.map(v=>v.id)??[]));
  const hasActivity=!!latest||!!alerts&&(alerts.overdueCount>0||alerts.pendingVisits>0||!!alerts.pendingRegistrations);
  if(hasActivity&&fingerprint!==sub.lastFingerprint){
   const id=serviceId(sub.id,fingerprint);
   queued+=(await db.pushDelivery.createMany({data:[{id,subscriptionId:sub.id,eventKey:fingerprint}],skipDuplicates:true})).count;
  }
  await db.pushSubscription.update({where:{id:sub.id},data:{lastFingerprint:fingerprint,updatedAt:now}});
 }
 // Push services can acknowledge a retry twice; the stable tag replaces the same visible alert.
 await db.pushDelivery.updateMany({where:{status:"SENDING",attemptAt:{lt:new Date(now.getTime()-15*60000)}},data:{status:"QUEUED",nextAttemptAt:now,error:"Interrupted attempt recovered."}});
 await db.pushDelivery.updateMany({where:{status:"QUEUED",attempts:{gte:3}},data:{status:"FAILED",error:"Delivery attempts exhausted. Re-enable notifications if this device no longer receives alerts."}});
 const jobs=await db.pushDelivery.findMany({where:{status:"QUEUED",attempts:{lt:3},nextAttemptAt:{lte:now}},include:{subscription:true},orderBy:{createdAt:"asc"},take:40});
 for(const job of jobs){
  if(!await pushEligible(db,job.subscription)){await db.pushDelivery.update({where:{id:job.id},data:{status:"CANCELLED"}});continue;}
  if(job.expiresAt && job.expiresAt<=now){
    await db.pushDelivery.update({where:{id:job.id},data:{status:"CANCELLED"}});continue;
  }
  if(job.kind==="CLASS_REMINDER" && (!job.subjectId || job.subscription.audience!=="tenant" ||
    !await db.studentLesson.findFirst({where:{id:job.subjectId,
      organizationId:job.subscription.organizationId,
      studentId:job.subscription.accountId,active:true,reminderEnabled:true},
      select:{id:true}}))){
    await db.pushDelivery.update({where:{id:job.id},data:{status:"CANCELLED"}});continue;
  }
  if(job.kind==="GATE_UPDATE" && (!job.subjectId || job.subscription.audience!=="staff" ||
    !await db.studentOuting.findFirst({where:{id:job.subjectId,
      organizationId:job.subscription.organizationId,
      status:{in:["OUT","RETURN_REPORTED"]}},
      select:{id:true}}))){
    await db.pushDelivery.update({where:{id:job.id},data:{status:"CANCELLED"}});continue;
  }
  if(!(await db.pushDelivery.updateMany({where:{id:job.id,status:"QUEUED",attempts:job.attempts},data:{status:"SENDING",attemptAt:now,attempts:{increment:1}}})).count)continue;
  try{await send(job.subscription,job.id,job.kind);await db.pushDelivery.update({where:{id:job.id},data:{status:"SENT",sentAt:new Date(),error:null}});sent++;}
  catch(error){const code=Number((error as {statusCode?:number}).statusCode);const expired=[404,410].includes(code);if(expired)await db.pushSubscription.update({where:{id:job.subscriptionId},data:{enabled:false}});const retry=!expired&&job.attempts<2;await db.pushDelivery.update({where:{id:job.id},data:{status:retry?"QUEUED":"FAILED",nextAttemptAt:new Date(now.getTime()+Math.pow(2,job.attempts)*5*60000),error:expired?"Device subscription expired. Enable notifications again on that device.":"Push service did not confirm this delivery."}});failed++;}
 }
 return {configured:true,queued,sent,failed};
}
