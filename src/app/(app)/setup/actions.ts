"use server";
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {requireSession} from '@/lib/auth/session';
import {db} from '@/lib/db';
import {publishProperty} from '@/lib/property-publication';
export type SetupState={error:string;message:string};
const rateSchema=z.object({name:z.string().trim().min(3).max(120),sharingMode:z.enum(['PRIVATE','SHARED']),monthlyRate:z.coerce.number().positive().max(10000000).multipleOf(0.01),semesterRate:z.coerce.number().positive().max(100000000).multipleOf(0.01),defaultCapacity:z.coerce.number().int().min(1).max(20)});
export async function createAccommodationType(_state:SetupState,form:FormData):Promise<SetupState>{
 const session=await requireSession();if(!['OWNER','ADMIN'].includes(session.role))return{error:'Only an owner or admin can configure accommodation.',message:''};
 const parsed=rateSchema.safeParse(Object.fromEntries(['name','sharingMode','monthlyRate','semesterRate','defaultCapacity'].map(k=>[k,form.get(k)])));
 if(!parsed.success)return{error:parsed.error.issues[0]?.message??'Check room type details.',message:''};
 try{await db.$transaction(async tx=>{const rate=await tx.roomType.create({data:{organizationId:session.organizationId,...parsed.data}});await tx.auditLog.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:'ROOM_TYPE_CREATED',entityType:'RoomType',entityId:rate.id}});});}catch{return{error:'This accommodation type already exists or could not be saved.',message:''};}
 revalidatePath('/setup');revalidatePath('/settings');revalidatePath('/rooms/new');return{error:'',message:'Accommodation type created. You can now add rooms.'};
}
export async function setWebsitePublication(_state:SetupState,form:FormData):Promise<SetupState>{
 const session=await requireSession();if(session.role!=='OWNER')return{error:'Only the owner can publish or unpublish the website.',message:''};
 const id=String(form.get('propertyId')??''),publish=form.get('publish')==='yes';if(form.get('confirm')!=='yes')return{error:'Confirm your publication choice.',message:''};
 try{await publishProperty(db,session,id,publish);}catch(error){return{error:error instanceof Error && /^(Only |Owner access|Sign in |Connect |Property unavailable|Add |A StudentsHostels)/.test(error.message)?error.message:'The website could not be updated.',message:''};}
 revalidatePath('/');revalidatePath('/setup');return{error:'',message:publish?'Website published in the directory.':'Website unpublished.'};
}
