import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantSession } from "@/lib/auth/tenant-session";
import type { SessionPayload } from "@/lib/auth/session";
import { residentTenant, residentStaff } from "@/lib/resident-access";

const sosSchema=z.object({
 requestId:z.string().uuid(),
 note:z.string().trim().max(240).default(""),
 shareLocation:z.boolean(),
 latitude:z.number().finite().min(-90).max(90).nullable().optional(),
 longitude:z.number().finite().min(-180).max(180).nullable().optional(),
 accuracyMeters:z.number().finite().min(0).max(50000).nullable().optional(),
});
const responseSchema=z.object({
 id:z.string().min(1).max(128),
 decision:z.enum(["ACKNOWLEDGE","CLOSE"]),
 verified:z.boolean(),
 note:z.string().trim().min(10).max(500),
});
/** Scope the pilot to one explicitly configured hostel, never all SaaS tenants. */
export function sosPilotEnabled(organizationId:string){
 const allowed=process.env.HOSTEL_SOS_PILOT_ORGANIZATION_ID||"mama-mbugua-hostel";
 return organizationId===allowed && process.env.HOSTEL_SOS_ENABLED==="true";
}
export const SOS_LOCATION_DISPLAY_MS=30*60*1000;
export const SOS_LOCATION_RETENTION_MS=24*60*60*1000;

export function availableSOSLocation(alert:{
 status:string;latitude:number|null;longitude:number|null;
 locationSharedAt:Date|null;accuracyMeters:number|null
},now=new Date()) {
 if(!["OPEN","ACKNOWLEDGED"].includes(alert.status) || !alert.locationSharedAt ||
    alert.latitude===null || alert.longitude===null ||
    now.getTime()-alert.locationSharedAt.getTime()>SOS_LOCATION_DISPLAY_MS ||
    now<alert.locationSharedAt) return null;
 const lat=alert.latitude, lon=alert.longitude;
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180) return null;
 return {
   latitude:lat,longitude:lon,
   accuracyMeters:alert.accuracyMeters,
   recordedAt:alert.locationSharedAt,
   mapUrl:"https://www.google.com/maps?q="+encodeURIComponent(lat+","+lon),
 };
}

export async function submitSOS(
 database:PrismaClient,session:TenantSession|null,raw:unknown,now=new Date()
):Promise<{error?:string;success?:string}> {
 if(!session)return {error:"Sign in to your own student portal first."};
 if(!sosPilotEnabled(session.organizationId))return {error:"SOS pilot not enabled. Use the emergency phone links for urgent assistance."};
 const parsed=sosSchema.safeParse(raw);
 if(!parsed.success)return {error:"Could not verify your SOS request. Retry or call 999/112 immediately."};
 const value=parsed.data;
 const haveCoords=value.latitude!==null&&value.latitude!==undefined &&
   value.longitude!==null&&value.longitude!==undefined;
 if(!value.shareLocation && (haveCoords||value.accuracyMeters!=null))
   return {error:"Location must be shared only by your explicit choice."};
 if(value.shareLocation && !haveCoords && value.accuracyMeters!=null)
   return {error:"Incomplete location information. Try sending SOS without location."};
 if((value.latitude==null)!==(value.longitude==null))
   return {error:"Incomplete location information. Try sending SOS without location."};
 return database.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${session.studentId}
       AND "organizationId"=${session.organizationId} FOR UPDATE`;
   if(!await residentTenant(tx,session))
      return {error:"Your student portal is not eligible for SOS. Call 999/112 for immediate help."};
   const prior=await tx.safetyAlert.findUnique({
      where:{organizationId_studentId_requestId:{
        organizationId:session.organizationId,studentId:session.studentId,requestId:value.requestId,
      }},select:{id:true}
   });
   const saved="SOS recorded for authorized hostel staff. Delivery and response are NOT confirmed. In immediate danger, call 999 or 112 if safe.";
   if(prior)return {success:saved};
   const active=await tx.safetyAlert.findFirst({
     where:{organizationId:session.organizationId,studentId:session.studentId,
       status:{in:["OPEN","ACKNOWLEDGED"]},createdAt:{gte:new Date(now.getTime()-10*60000)}},
     select:{id:true},
   });
   if(active)return {success:"Your recent SOS is still in the hostel response queue. Do not assume anyone has seen it. Call 999 or 112 for immediate help."};
   const count=await tx.safetyAlert.count({
     where:{organizationId:session.organizationId,studentId:session.studentId,
       createdAt:{gte:new Date(now.getTime()-24*3600000)}},
   });
   if(count>=10)return {error:"SOS rate limit reached. Call 999 or 112 immediately and contact hostel security."};
   const stays=await tx.occupancy.findMany({
     where:{organizationId:session.organizationId,studentId:session.studentId,status:"ACTIVE",
       room:{organizationId:session.organizationId,
         property:{organizationId:session.organizationId,active:true}},
       semester:{organizationId:session.organizationId}},
     select:{room:{select:{number:true,propertyId:true}}},
     take:2,
   });
   if(stays.length!==1)return {error:"Your room record requires management review. Call 999 or 112 for immediate help."};
   const room=stays[0].room;
   const coords=value.shareLocation&&haveCoords;
   const item=await tx.safetyAlert.create({data:{
     organizationId:session.organizationId,studentId:session.studentId,
     propertyId:room.propertyId,roomLabel:room.number,requestId:value.requestId,
     status:"OPEN",note:value.note||null,
     latitude:coords?value.latitude:null,
     longitude:coords?value.longitude:null,
     accuracyMeters:coords?value.accuracyMeters??null:null,
     locationSharedAt:coords?now:null,
   },select:{id:true}});
   await tx.auditLog.create({data:{
      organizationId:session.organizationId,action:"STUDENT_SOS_CREATED",
      entityType:"SafetyAlert",entityId:item.id,
      metadata:{locationShared:Boolean(coords),requestId:value.requestId},
   }});
   return {success:saved};
 });
}

export async function updateSOS(
 database:PrismaClient,session:SessionPayload|null,raw:unknown,now=new Date()
):Promise<{error?:string;success?:string}>{
 if(!session)return {error:"Authorized staff sign-in required."};
 const parsed=responseSchema.safeParse(raw);
 if(!parsed.success)return {error:"Confirm the action and provide a brief factual response note (10–500 characters)."};
 const value=parsed.data;
 return database.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "SafetyAlert" WHERE id=${value.id}
     AND "organizationId"=${session.organizationId} FOR UPDATE`;
   const staff=await residentStaff(tx,session);
   if(!staff)return {error:"Only current authorized hostel staff can respond."};
   if(value.decision==="CLOSE"&&!["OWNER","ADMIN"].includes(staff.role))
     return {error:"Only the Owner/Admin may close an SOS after independent safety follow-up."};
   if(!value.verified)return {error:"Staff must confirm they performed the described follow-up."};
   const alert=await tx.safetyAlert.findFirst({
     where:{id:value.id,organizationId:session.organizationId},
     select:{id:true,status:true},
   });
   if(!alert||alert.status==="CLOSED")return {error:"Alert unavailable or already closed."};
   if(value.decision==="ACKNOWLEDGE") {
     if(alert.status!=="OPEN")return {error:"This SOS has already been acknowledged."};
     await tx.safetyAlert.update({where:{id:alert.id},data:{
       status:"ACKNOWLEDGED",acknowledgedAt:now,acknowledgedById:session.userId,
     }});
   } else {
     await tx.safetyAlert.update({where:{id:alert.id},data:{
       status:"CLOSED",closedAt:now,closedById:session.userId,closureNote:value.note,
       // No precise location is retained after staff closes the incident.
       latitude:null,longitude:null,accuracyMeters:null,locationSharedAt:null,
     }});
   }
   await tx.auditLog.create({data:{
      organizationId:session.organizationId,actorUserId:session.userId,
      action:value.decision==="ACKNOWLEDGE"?"STUDENT_SOS_ACKNOWLEDGED":"STUDENT_SOS_CLOSED",
      entityType:"SafetyAlert",entityId:alert.id,metadata:{note:value.note},
   }});
   return {success:value.decision==="ACKNOWLEDGE"
     ?"Marked acknowledged by staff. This does not mean the student is safe or help has arrived."
     :"Staff incident record closed. This does not certify the student was rescued or police responded."};
 });
}
