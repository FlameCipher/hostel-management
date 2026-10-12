import { createHmac, timingSafeEqual } from "node:crypto";

/** A 15-minute conversation pointer, not conversational storage or a finance authorization. */
export type AssistantSubject = { kind:"room"; number:string };
export type AssistantPrincipal = {
  organizationId:string;
  userId:string;
  role:string;
  sessionVersion?:number;
};
const CONTEXT_LIFETIME=15*60*1000;
const ROOM_PATTERN=/^[0-9]{1,5}[A-Z]?$/;
const tag = (value:string,secret:string) => createHmac("sha256",secret).update("hostel-assistant-context-v1:"+value).digest("base64url");
export function issueAssistantContext(subject:AssistantSubject, principal:AssistantPrincipal, secret:string, now=new Date()):string|null {
  if(!ROOM_PATTERN.test(subject.number)||secret.length<32||!principal.userId||!principal.organizationId)return null;
  const payload={v:1,org:principal.organizationId,uid:principal.userId,role:principal.role,version:principal.sessionVersion??0,
    subject,expires:now.getTime()+CONTEXT_LIFETIME};
  const data=Buffer.from(JSON.stringify(payload)).toString("base64url");
  return data+"."+tag(data,secret);
}
export function readAssistantContext(token:string|null|undefined,principal:AssistantPrincipal,secret:string,now=new Date()):AssistantSubject|null {
  if(typeof token!=="string"||token.length<20||token.length>1200||secret.length<32)return null;
  const match=/^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(token);
  if(!match)return null;
  const expected=Buffer.from(tag(match[1],secret));
  const supplied=Buffer.from(match[2]);
  if(expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return null;
  try {
    const payload=JSON.parse(Buffer.from(match[1],"base64url").toString("utf8"));
    if(payload?.v!==1||payload.org!==principal.organizationId||payload.uid!==principal.userId||
       payload.role!==principal.role||payload.version!==(principal.sessionVersion??0)||
       !Number.isSafeInteger(payload.expires)||payload.expires<=now.getTime()||
       payload.expires>now.getTime()+CONTEXT_LIFETIME)return null;
    if(payload.subject?.kind!=="room"||typeof payload.subject.number!=="string"||!ROOM_PATTERN.test(payload.subject.number))return null;
    return {kind:"room",number:payload.subject.number};
  }catch{return null;}
}
/** Strict coreference: do not guess references on vague unrelated messages. */
export function isRoomFinanceFollowup(question:string):boolean {
  const q=question.toLowerCase().trim();
  if(q.length>1200||/\broom\s*(?:number\s*)?\d+/i.test(q))return false;
  return /^(?:and\s+|okay[,\s]+|then\s+|what about\s+)?(?:how much\s+(?:has|did|does)\s+(?:he|she|they|that\s+(?:student|resident|tenant))\s+(?:paid|pay|owe)|what(?:'s| is)\s+(?:his|her|their|that\s+(?:student|resident|tenant)'?s)\s+(?:balance|rent|payment)|(?:has|did)\s+(?:he|she|they)\s+pay|show\s+(?:his|her|their)\s+(?:payments?|balance)|(?:his|her|their)\s+(?:payment|rent|balance))/i.test(q);
}
