import {timingSafeEqual} from 'node:crypto';
import type {PrismaClient} from '@/generated/prisma/client';
import type {SessionPayload} from '@/lib/auth/session';
import {consumeSso,issueSsoGrant,pendingSso,platformIdentity,platformRoleAllows,validOpaque,validSubject} from './platform-sso';
import {managedPropertyHost,publishedWhere} from './property-host-policy';

export async function propertySignInDestination(db:PrismaClient,organizationId:string) {
 const properties=await db.property.findMany({where:{...publishedWhere(),organizationId,customDomain:{not:null}},select:{customDomain:true},orderBy:[{createdAt:'asc'},{id:'asc'}],take:20});
 const host=properties.map(p=>p.customDomain).find(h=>h&&managedPropertyHost(h)===h);
 return host?`https://${host}/api/platform/sso/start`:'/dashboard';
}

export async function issuePropertyHandoff(db:PrismaClient,session:SessionPayload,host:string,challenge:string,state:string,fetcher:typeof fetch=fetch) {
 if(managedPropertyHost(host)!==host||!validOpaque(challenge)||!validOpaque(state)||!validSubject(session.platformSubject)||!Number.isSafeInteger(session.sessionVersion)||(session.sessionVersion??-1)<0)throw Error('HANDOFF_DENIED');
 const identity=await platformIdentity(session.platformSubject,fetcher);
 const user=await db.user.findFirst({where:{id:session.userId,organizationId:session.organizationId,active:true,sessionVersion:session.sessionVersion,platformUserId:session.platformSubject.platformUserId,organization:{status:'ACTIVE',platformOrganizationId:session.platformSubject.platformOrganizationId,platformProductCode:'STUDENTSHOSTELS'}},select:{role:true}});
 const property=await db.property.findFirst({where:{...publishedWhere(),organizationId:session.organizationId,customDomain:host},select:{id:true}});
 if(!identity||!user||!property||!platformRoleAllows(user.role,identity.role))throw Error('HANDOFF_DENIED');
 const code=await issueSsoGrant(db,session.platformSubject,challenge);
 const target=new URL(`https://${host}/api/platform/sso/return`);target.searchParams.set('code',code);target.searchParams.set('state',state);
 return target.toString();
}

export async function acceptPropertyHandoff(db:PrismaClient,input:{host:string;state:unknown;expectedState:unknown;code:unknown;verifier:unknown},fetcher:typeof fetch=fetch) {
 const {host,state,expectedState,code,verifier}=input;
 if(managedPropertyHost(host)!==host||!validOpaque(state)||!validOpaque(expectedState)||!validOpaque(code)||!validOpaque(verifier)||!timingSafeEqual(Buffer.from(state),Buffer.from(expectedState)))throw Error('HANDOFF_DENIED');
 const grant=await pendingSso(db,code,verifier);if(!grant)throw Error('HANDOFF_DENIED');
 const property=await db.property.findFirst({where:{...publishedWhere(),customDomain:host,organization:{status:'ACTIVE',platformOrganizationId:grant.platformOrganizationId,platformProductCode:'STUDENTSHOSTELS'}},select:{organizationId:true}});
 const identity=property?await platformIdentity(grant,fetcher):null;
 if(!property||!identity)throw Error('HANDOFF_DENIED');
 const session=await consumeSso(db,code,verifier,identity);
 if(session.organizationId!==property.organizationId)throw Error('HANDOFF_DENIED');
 return session;
}
