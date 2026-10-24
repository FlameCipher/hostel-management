import { whatsappNumber } from "./whatsapp-policy";

/** A confirmed Meta display number must match the owner's independently
 * nominated sender. This is a verification gate, never permission to send.
 * Future landlords may onboard their own independent authorized numbers.
 */
export const MMAMBUGUA_WHATSAPP_SENDER = "254726717120";

export function verifiedHostelSender(
  organizationId:string,
  metaDisplayPhone:unknown,
):boolean{
  if(typeof metaDisplayPhone!=="string")return false;
  const normalized=whatsappNumber(metaDisplayPhone,"KE");
  if(!normalized)return false;
  return organizationId!=="mama-mbugua-hostel"||normalized===MMAMBUGUA_WHATSAPP_SENDER;
}

export function approvedSingleBodyTemplate(templates:unknown,name:string,language:string):boolean{
  if(!templates || typeof templates!=="object")return false;
  const data=(templates as {data?:unknown}).data;
  if(!Array.isArray(data))return false;
  return data.some((item:unknown)=>{
    if(!item || typeof item!=="object")return false;
    const template=item as {name?:unknown;language?:unknown;status?:unknown;components?:unknown};
    if(template.name!==name||template.language!==language||template.status!=="APPROVED"||!Array.isArray(template.components))return false;
    const components=template.components as Array<{type?:unknown;text?:unknown}>;
    const bodies=components.filter(c=>c?.type==="BODY");
    if(bodies.length!==1||components.some(c=>!c || (c.type!=="BODY"&&c.type!=="FOOTER")))return false;
    const body=bodies[0].text;
    if(typeof body!=="string")return false;
    const placeholders=[...body.matchAll(/\{\{(\d+)\}\}/g)].map(x=>x[1]);
    return placeholders.length===1&&placeholders[0]==="1"&&body.replace(/\{\{1\}\}/g,"").indexOf("{{")===-1;
  });
}
