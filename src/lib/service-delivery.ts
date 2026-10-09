import type { PrismaClient } from "@/generated/prisma/client";
import { runPushDelivery } from "./push-service";
import { runWhatsAppDelivery } from "./whatsapp-cloud";
export async function runServiceDelivery(db:PrismaClient){
 const run=await db.operationalRun.create({data:{kind:"DELIVERY",status:"RUNNING"}});
 const results=await Promise.allSettled([runPushDelivery(db),runWhatsAppDelivery(db)]);
 const result={push:results[0].status==="fulfilled"?results[0].value:{error:"Push processing failed."},whatsapp:results[1].status==="fulfilled"?results[1].value:{error:"WhatsApp processing failed."}};
 const status=results.some(r=>r.status==="rejected")?"FAILED":"COMPLETED";
 await db.operationalRun.update({where:{id:run.id},data:{status,completedAt:new Date(),metadata:result}});return {status,...result};
}
