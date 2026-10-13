import { createHmac, createHash, timingSafeEqual } from "node:crypto";
/** Kinari voice style; voice tickets never cover private ledger results. */
export const ASSISTANT_VOICE_MAX_CHARS=5500;
const VOICE_TICKET_TTL_MS=5*60*1000;
export type VoicePrincipal={organizationId:string;subjectId:string;audience:"staff"|"tenant";sessionVersion:number};
export const HOSTEL_VOICE_INSTRUCTIONS=
 "Narrate like the Kinari teaching reader: mature, deep male, calm, warm and grounded, with premium audiobook quality, measured conversational pacing and natural pauses. Read clearly as a professional hostel assistant, not a sacred persona. Never speak markdown punctuation or emoji names. Preserve meaningful words, amounts, names and dates; do not invent facts.";
export function assistantSpeechText(source:string) {
 return source.replace(/\r\n/g,"\n")
  .replace(/!\[([^\]]*)\]\([^)]*\)/g,"$1")
  .replace(/\[([^\]]+)\]\([^)]*\)/g,"$1")
  .replace(/^\s{0,3}#{1,6}\s+/gm,"")
  .replace(/^\s*>+\s?/gm,"")
  .replace(/^\s*[-*+]\s+/gm,"")
  .replace(/^\s*\d+[.)]\s+/gm,"")
  .replace(/\*\*([^*]+)\*\*/g,"$1")
  .replace(/__([^_]+)__/g,"$1")
  .replace(/~~([^~]+)~~/g,"$1")
  .replace(/^\s*[-*_]{3,}\s*$/gm,"")
  .replace(/\n{3,}/g,"\n\n").trim();
}
const hashText=(text:string)=>createHash("sha256").update(text,"utf8").digest("hex");
const sign=(data:string,secret:string)=>createHmac("sha256",secret).update("hostel-audio-v1:"+data).digest("base64url");
export function issueAssistantVoiceTicket(text:string,p:VoicePrincipal,secret:string,now=new Date()):string|null {
 if(secret.length<32||!p.organizationId||!p.subjectId||!["staff","tenant"].includes(p.audience)||
    text.length<1||text.length>ASSISTANT_VOICE_MAX_CHARS||!assistantSpeechText(text))return null;
 const data=Buffer.from(JSON.stringify({v:1,org:p.organizationId,subject:p.subjectId,audience:p.audience,
   session:p.sessionVersion,hash:hashText(text),exp:now.getTime()+VOICE_TICKET_TTL_MS})).toString("base64url");
 return data+"."+sign(data,secret);
}
export function verifyAssistantVoiceTicket(text:string,token:unknown,p:VoicePrincipal,secret:string,now=new Date()):boolean {
 if(typeof token!=="string"||token.length>1400||secret.length<32||text.length<1||
    text.length>ASSISTANT_VOICE_MAX_CHARS)return false;
 const parts=/^([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]{43})$/.exec(token);
 if(!parts)return false;
 const expected=Buffer.from(sign(parts[1],secret)),actual=Buffer.from(parts[2]);
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return false;
 try {
  const x=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
  return x?.v===1&&x.org===p.organizationId&&x.subject===p.subjectId&&x.audience===p.audience&&
   x.session===p.sessionVersion&&x.hash===hashText(text)&&Number.isSafeInteger(x.exp)&&
   x.exp>now.getTime()&&x.exp<=now.getTime()+VOICE_TICKET_TTL_MS;
 }catch{return false;}
}
