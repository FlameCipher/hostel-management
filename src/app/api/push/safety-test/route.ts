import {cookies} from "next/headers";
import {getSession} from "@/lib/auth/session";
import {db} from "@/lib/db";
import {requestPropertyContext} from "@/lib/property-host";
import {requestSafetyPushTest} from "@/lib/sos-device-test";
import {sameOrigin} from "@/lib/service-security";

const headers={"Cache-Control":"private, no-store","Vary":"Cookie"};
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:"Request not allowed."},{status:403,headers});
 const session=await getSession();
 if(!session)return Response.json({error:"Authorized hostel staff login required."},{status:401,headers});
 const context=await requestPropertyContext();
 if(context.property?.organizationId!==session.organizationId||
    context.property.customDomain!==context.host)
   return Response.json({error:"Open your property's published hostel site."},{status:403,headers});
 const device=(await cookies()).get("hostel_push_device")?.value??null;
 try{
   const result=await requestSafetyPushTest(db,session,device,context.host);
   return Response.json(result,{status:result.error?409:200,headers});
 }catch{
   return Response.json({error:"Could not queue this TEST. Check the notification settings and retry later."},
     {status:503,headers});
 }
}
