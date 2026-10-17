import {randomUUID} from "node:crypto";
import type {PrismaClient} from "@/generated/prisma/client";
import type {SessionPayload} from "./auth/session";
import {residentStaff} from "./resident-access";
import {pushConfigured,pushEligible} from "./push-service";
import {serviceId} from "./service-security";

/** A staff-only, rate-limited self-test; never creates an SOS or contacts students. */
export async function requestSafetyPushTest(
 db:PrismaClient,session:SessionPayload|null,deviceId:string|null,host:string|null,
 now=new Date()
):Promise<{error?:string;success?:string}>{
 if(!session||!await residentStaff(db,session))
   return {error:"Sign in as an authorized active hostel staff member."};
 if(!host||!deviceId)
   return {error:"Open your hostel's own website and enable notifications on this device first."};
 if(!pushConfigured())
   return {error:"The hostel push provider is not configured."};
 const sub=await db.pushSubscription.findFirst({where:{
   id:deviceId,organizationId:session.organizationId,accountId:session.userId,
   audience:"staff",host,sessionVersion:session.sessionVersion??-1,enabled:true,
 }});
 if(!sub||!await pushEligible(db,sub))
   return {error:"No active authorized staff notification subscription on this device. Enable notifications first."};
 // Lock this exact opt-in device before comparing/creating a TEST. Two tabs
 // cannot bypass the ten-minute cooldown by racing between count and create.
 return db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "PushSubscription"
     WHERE id=${sub.id} AND "organizationId"=${session.organizationId}
     AND "accountId"=${session.userId} AND audience='staff'
     FOR UPDATE`;
   const active=await tx.pushSubscription.findFirst({where:{
     id:sub.id,organizationId:session.organizationId,accountId:session.userId,
     audience:"staff",host,sessionVersion:session.sessionVersion??-1,enabled:true,
   }});
   if(!active||!await residentStaff(tx,session)||!await pushEligible(tx as PrismaClient,active))
     return {error:"Staff access or device notifications have changed. Re-enable your own device before testing."};
   const recent=await tx.pushDelivery.count({where:{
     subscriptionId:active.id,kind:"SOS_DRILL",
     createdAt:{gte:new Date(now.getTime()-10*60000)},
   }});
   if(recent>0)return {error:"A test was requested on this device recently. Check your notification before trying again in ten minutes."};
   const testId=randomUUID(),key=serviceId("staff-safety-device-test",active.id,testId);
   await tx.pushDelivery.create({data:{
     id:serviceId(active.id,key),eventKey:key,subscriptionId:active.id,
     kind:"SOS_DRILL",targetUrl:"/safety",
     expiresAt:new Date(now.getTime()+15*60000),
   }});
   return {success:"TEST notification queued. It is not a real SOS. Check this device after the scheduled worker runs. No delivery or response is confirmed."};
 },{timeout:10000});
}
