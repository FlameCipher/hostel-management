import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { getTenantSession } from "@/lib/auth/tenant-session";
import { db } from "@/lib/db";
import { requestPropertyContext } from "@/lib/property-host";
import { pushSchema,pushConfigured } from "@/lib/push-service";
import { sameOrigin,serviceId } from "@/lib/service-security";
const headers={"Cache-Control":"private, no-store","Vary":"Cookie"};
async function principal(request:Request){const tenant=new URL(request.url).searchParams.get("audience")==="tenant";const s=tenant?await getTenantSession():await getSession();if(!s)return null;const context=await requestPropertyContext();if(context.property?.organizationId!==s.organizationId||context.property.customDomain!==context.host)return null;return {organizationId:s.organizationId,accountId:"studentId" in s?s.studentId:s.userId,audience:tenant?"tenant":"staff",sessionVersion:s.sessionVersion??0,host:context.host!};}
export async function GET(request:Request){const p=await principal(request);if(!p)return Response.json({error:"Open your own hostel website and sign in first."},{status:401,headers});const id=(await cookies()).get("hostel_push_device")?.value;const device=id?await db.pushSubscription.findFirst({where:{id,...p,enabled:true},select:{id:true}}):null;return Response.json({configured:pushConfigured(),publicKey:process.env.VAPID_PUBLIC_KEY??null,enabled:!!device},{headers});}
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:"Request not allowed."},{status:403,headers});
 const p=await principal(request);if(!p)return Response.json({error:"Sign in on your hostel website first."},{status:401,headers});
 if(!pushConfigured())return Response.json({error:"Device notifications are not configured yet."},{status:503,headers});
 const raw=await request.text();if(raw.length>5000)return Response.json({error:"Invalid device subscription."},{status:413,headers});
 let input;try{input=pushSchema.safeParse(JSON.parse(raw));}catch{return Response.json({error:"Invalid device subscription."},{status:400,headers});}if(!input.success)return Response.json({error:"Invalid device subscription."},{status:400,headers});
 const sub=input.data,id=serviceId(sub.endpoint);const existing=await db.pushSubscription.findUnique({where:{id}});
 if(existing&&(existing.organizationId!==p.organizationId||existing.accountId!==p.accountId||existing.audience!==p.audience))return Response.json({error:"Disable notifications for the previous account on this device first."},{status:409,headers});
 await db.pushSubscription.upsert({where:{id},create:{id,...p,endpoint:sub.endpoint,...sub.keys},update:{...p,...sub.keys,enabled:true}});
 (await cookies()).set("hostel_push_device",id,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:365*86400});
 return Response.json({success:true},{headers});
}
export async function DELETE(request:Request){if(!sameOrigin(request))return Response.json({error:"Request not allowed."},{status:403,headers});const p=await principal(request);if(!p)return Response.json({error:"Sign in first."},{status:401,headers});const id=(await cookies()).get("hostel_push_device")?.value;if(id)await db.pushSubscription.updateMany({where:{id,organizationId:p.organizationId,accountId:p.accountId,audience:p.audience},data:{enabled:false}});(await cookies()).delete("hostel_push_device");return Response.json({success:true},{headers});}
