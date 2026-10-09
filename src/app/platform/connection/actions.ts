'use server';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {createSession,getSession} from '@/lib/auth/session';
import {consumeSso,pendingSso,platformIdentity} from '@/lib/platform-sso';
import {propertySignInDestination} from '@/lib/property-sso';
export async function connectExisting(form:FormData){
 if(form.get('confirm')!=='yes')redirect('/platform/connection?error=1');
 const session=await getSession();
 const jar=await cookies(),code=jar.get('hostel_sso_code')?.value??'',verifier=jar.get('hostel_sso_verifier')?.value??'';
 let payload;
 try{
  const grant=await pendingSso(db,code,verifier),identity=grant?await platformIdentity(grant):null;
  if(!identity)throw Error('SSO_DENIED');
  const password=String(form.get('password')??'');
  const proof=session?{userId:session.userId,organizationId:session.organizationId,password}:{host:String(form.get('host')??''),email:String(form.get('email')??''),password};
  payload=await consumeSso(db,code,verifier,identity,proof);
 }catch{redirect('/platform/connection?error=1');}
 await createSession(payload);
 for(const n of ['hostel_sso_state','hostel_sso_verifier','hostel_sso_code'])jar.delete(n);
 redirect(await propertySignInDestination(db,payload.organizationId));
}
