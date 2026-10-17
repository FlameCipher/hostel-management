/** Advisory push never certifies that help was delivered or the student is safe. */
export const SOS_PUSH_WINDOW_MS=24*60*60*1000;
export type SOSPushStage="INITIAL"|"ESCALATE_5"|"ESCALATE_15";
export function sosPushStages(
 alert:{status:string;createdAt:Date},role:string|null|undefined,now=new Date()
):SOSPushStage[]{
 const elapsed=now.getTime()-alert.createdAt.getTime();
 if(alert.status!=="OPEN"||!Number.isFinite(elapsed)||elapsed<0||elapsed>=SOS_PUSH_WINDOW_MS)
   return [];
 const stages:SOSPushStage[]=["INITIAL"];
 if(role==="OWNER"||role==="ADMIN"){
   if(elapsed>=5*60000)stages.push("ESCALATE_5");
   if(elapsed>=15*60000)stages.push("ESCALATE_15");
 }
 return stages;
}
