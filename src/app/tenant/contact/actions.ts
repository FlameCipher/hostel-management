"use server";
import { requireTenantSession } from "@/lib/auth/tenant-session";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createConversation,replyConversation } from "@/lib/tenant-conversations";
import { revalidatePath } from "next/cache";
export type ContactState={error?:string;success?:string};
export async function contactAction(_state:ContactState,f:FormData):Promise<ContactState>{
 const s=await requireTenantSession();try{const result=await createConversation(db,s,{subject:f.get("subject"),body:f.get("body"),category:f.get("category"),requestId:f.get("requestId")});revalidatePath("/tenant/contact");revalidatePath("/communications/inbox");return result;}catch{return{error:"We could not confirm sending. Refresh your conversations before trying again."};}
}
export async function tenantReplyAction(_state:ContactState,f:FormData):Promise<ContactState>{
 const s=await requireTenantSession();try{const result=await replyConversation(db,s,{conversationId:f.get("conversationId"),body:f.get("body"),requestId:f.get("requestId")},false);revalidatePath("/tenant/contact");revalidatePath("/communications/inbox");return result;}catch{return{error:"Reply could not be confirmed. Refresh before retrying."};}
}
export async function managerReplyAction(_state:ContactState,f:FormData):Promise<ContactState>{
 const s=await requireSession();try{const result=await replyConversation(db,s,{conversationId:f.get("conversationId"),body:f.get("body"),requestId:f.get("requestId")},true);revalidatePath("/tenant/contact");revalidatePath("/tenant/messages");revalidatePath("/communications/inbox");return result;}catch{return{error:"Reply could not be confirmed. Refresh before retrying."};}
}
