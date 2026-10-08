import type {PrismaClient} from '@/generated/prisma/client';
import type {SessionPayload} from '@/lib/auth/session';
import {platformIdentity} from '@/lib/platform-sso';
import {publicationProblems} from '@/lib/landlord-onboarding-policy';
export async function publishProperty(database:PrismaClient,session:SessionPayload,id:string,publish:boolean,resolveIdentity=platformIdentity){
 if(session.role!=='OWNER')throw Error('Only the owner can update publication.');
 if(publish){if(!session.platformSubject || !(await resolveIdentity(session.platformSubject)))throw Error('Sign in with SYSTEM IN ONE to confirm active access.');}
 return database.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "User" WHERE id=${session.userId} AND "organizationId"=${session.organizationId} FOR UPDATE`;
 const owner=await tx.user.findFirst({where:{id:session.userId,organizationId:session.organizationId,active:true,role:'OWNER',organization:{status:'ACTIVE'}},include:{organization:true}});
 if(!owner)throw Error('Owner access could not be confirmed.');
 if(publish && (!owner.platformUserId || owner.platformUserId!==session.platformSubject?.platformUserId || owner.organization.platformOrganizationId!==session.platformSubject?.platformOrganizationId || owner.organization.platformProductCode!=='STUDENTSHOSTELS'))throw Error('Connect the owner account to SYSTEM IN ONE before publishing.');
 await tx.$queryRaw`SELECT id FROM "Property" WHERE id=${id} AND "organizationId"=${session.organizationId} FOR UPDATE`;
 const property=await tx.property.findFirst({where:{id,organizationId:session.organizationId,active:true,organization:{status:'ACTIVE'}}});if(!property)throw Error('Property unavailable.');
 if(publish){const count=await tx.room.count({where:{propertyId:id,organizationId:session.organizationId,status:{notIn:['INACTIVE','MAINTENANCE']},roomType:{organizationId:session.organizationId,active:true,monthlyRate:{gt:0},semesterRate:{gt:0},defaultCapacity:{gt:0}}}});const problems=publicationProblems(property,count);if(problems.length)throw Error(problems.join(' '));}
 await tx.property.update({where:{id:property.id},data:{publicListing:publish}});
 await tx.auditLog.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:publish?'PROPERTY_WEBSITE_PUBLISHED':'PROPERTY_WEBSITE_UNPUBLISHED',entityType:'Property',entityId:id}});
 });
}
