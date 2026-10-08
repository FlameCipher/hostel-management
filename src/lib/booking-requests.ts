import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { localSessionCurrent } from "@/lib/account-security-policy";
import { publishedWhere } from "@/lib/property-host-policy";
import { activeBreakHoldWhere } from "@/lib/room-status";
const inputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().transform(v => v.replace(/[\s()-]/g, "")).pipe(z.string().regex(/^\+?[0-9]{9,15}$/)),
  email: z.string().trim().max(254).transform(v => v.toLowerCase()).pipe(z.union([z.email(), z.literal("")])),
  roomTypeId: z.string().min(1).max(128),
  preferredMoveIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  consent: z.literal(true),
});
function signingKey() { const key=process.env.SESSION_SECRET; if(!key || key.length<16) throw Error("BOOKING_UNAVAILABLE"); return key; }
function signature(value:string) { return createHmac("sha256",signingKey()).update(value).digest("hex"); }
export function createBookingTicket(propertyId:string, now=new Date()) {
 const payload=Buffer.from(JSON.stringify({propertyId,requestId:randomUUID(),issuedAt:now.getTime()})).toString("base64url");
 return `${payload}.${signature(payload)}`;
}
export function verifyBookingTicket(ticket:unknown,propertyId:string,now=new Date()):{requestId:string}|null {
 if(typeof ticket!=="string" || ticket.length>1024)return null;
 try {const [payload,sig,...extra]=ticket.split(".");if(extra.length || !/^[a-f0-9]{64}$/.test(sig??""))return null;
 if(!timingSafeEqual(Buffer.from(sig,"hex"),Buffer.from(signature(payload),"hex")))return null;
 const data=JSON.parse(Buffer.from(payload,"base64url").toString());
 if(data.propertyId!==propertyId || !z.uuid().safeParse(data.requestId).success || !Number.isSafeInteger(data.issuedAt) || data.issuedAt>now.getTime()+60000 || now.getTime()-data.issuedAt>30*60000)return null;
 return {requestId:data.requestId};}catch{return null;}
}
export function bookingToday() { return new Date(Date.now()+3*3600000).toISOString().slice(0,10); }
export function validMoveInDate(value:string,now=new Date()) {
 const date=new Date(`${value}T00:00:00.000Z`);
 const today=new Date(now.getTime()+3*3600000).toISOString().slice(0,10);
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value && value>=today && date.getTime()<=now.getTime()+366*86400000;
}
export async function bookingOptions(db:Pick<PrismaClient,"room">,propertyId:string,organizationId:string) {
 const rooms=await db.room.findMany({where:{propertyId,organizationId,property:publishedWhere(),roomType:{active:true,organizationId}},include:{roomType:true,occupancies:{where:{organizationId,status:{in:["ACTIVE","RESERVED"]}},select:{studentId:true}},breakReservations:{where:{...activeBreakHoldWhere,organizationId},select:{studentId:true}}}});
 const options=new Map<string,{id:string;name:string;monthlyRate:number;semesterRate:number;available:number}>();
 for(const room of rooms){if(["INACTIVE","MAINTENANCE"].includes(room.status))continue;
 const held=new Set([...room.occupancies,...room.breakReservations].map(r=>r.studentId)).size;
 const available=Math.max(0,(room.capacityOverride??room.roomType.defaultCapacity)-held);
 if(!available)continue;
 const type=room.roomType;const row=options.get(type.id)??{id:type.id,name:type.name,monthlyRate:Number(type.monthlyRate),semesterRate:Number(type.semesterRate),available:0};row.available+=available;options.set(type.id,row);}
 return [...options.values()];
}
export type BookingState={error?:string;reference?:string};
export async function submitBooking(db:PrismaClient,property:{id:string;organizationId:string},raw:unknown,ticket:unknown,now=new Date()):Promise<BookingState>{
 const parsed=inputSchema.safeParse(raw);const signed=verifyBookingTicket(ticket,property.id,now);
 if(!parsed.success || !signed || !validMoveInDate(parsed.data.preferredMoveIn,now))return{error:"Check your details and move-in date. If this page has been open for 30 minutes, refresh it."};
 const input=parsed.data;const contactKey=signature(`booking-contact:${input.phone.replace(/^\+/,"").replace(/^0(?=[17][0-9]{8}$)/,"254")}`);
 return db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT "id" FROM "Property" WHERE "id"=${property.id} AND "organizationId"=${property.organizationId} FOR UPDATE`;
 const parent=await tx.property.findFirst({where:{id:property.id,organizationId:property.organizationId,...publishedWhere()},select:{id:true}});
 if(!parent)return{error:"This hostel is not accepting website requests."};
 const prior=await tx.bookingRequest.findUnique({where:{propertyId_requestId:{propertyId:property.id,requestId:signed.requestId}}});
 if(prior)return prior.fullName===input.fullName && prior.phone===input.phone && prior.email===(input.email||null) && prior.roomTypeId===input.roomTypeId && prior.preferredMoveIn.toISOString().slice(0,10)===input.preferredMoveIn ? {reference:prior.reference}:{error:"This request was already submitted. Refresh to send a different request."};
 const hour=new Date(now.getTime()-3600000);
 const [contactCount,propertyCount]=await Promise.all([tx.bookingRequest.count({where:{propertyId:property.id,contactKey,createdAt:{gte:hour}}}),tx.bookingRequest.count({where:{propertyId:property.id,createdAt:{gte:hour}}})]);
 if(contactCount>=3 || propertyCount>=100)return{error:"Too many recent requests. Please contact the hostel directly or try again later."};
 const options=await bookingOptions(tx,property.id,property.organizationId);
 if(!options.some(o=>o.id===input.roomTypeId))return{error:"That room type is currently unavailable. Refresh to see current options."};
 const reference=`BR-${randomUUID().replaceAll("-","").slice(0,16).toUpperCase()}`;
 await tx.bookingRequest.create({data:{organizationId:property.organizationId,propertyId:property.id,requestId:signed.requestId,reference,fullName:input.fullName,phone:input.phone,email:input.email||null,roomTypeId:input.roomTypeId,preferredMoveIn:new Date(`${input.preferredMoveIn}T00:00:00.000Z`),contactKey}});
 return{reference};
 });
}
export async function updateBooking(db:PrismaClient,session:SessionPayload,id:unknown,status:unknown):Promise<BookingState>{
 if(typeof id!=="string" || id.length>128 || !["REQUESTED","CONTACTED","CLOSED"].includes(String(status)))return{error:"Invalid request."};
 return db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${session.userId} AND "organizationId"=${session.organizationId} FOR SHARE`;
 const user=await tx.user.findFirst({where:{id:session.userId,organizationId:session.organizationId,active:true,role:{in:["OWNER","ADMIN","MANAGER"]},organization:{status:"ACTIVE"}},select:{id:true,sessionVersion:true}});
 if(!user || !localSessionCurrent(session.sessionVersion,user.sessionVersion))return{error:"Your account cannot manage booking requests."};
 const result=await tx.bookingRequest.updateMany({where:{id,organizationId:session.organizationId},data:{status:String(status)}});
 if(!result.count)return{error:"Request not found."};
 await tx.auditLog.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"BOOKING_REQUEST_STATUS",entityType:"BookingRequest",entityId:id,metadata:{status:String(status)}}});
 return{};
 });
}
