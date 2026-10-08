'use server';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {createSession,requireSession} from '@/lib/auth/session';
import {consumeSso,pendingSso,platformIdentity} from '@/lib/platform-sso';
export async function connectExisting(form:FormData){
 if(form.get('confirm')!=='yes')redirect('/platform/connection?error=1');
 const session=await requireSession();
 const jar=await cookies(),code=jar.get('hostel_sso_code')?.value??'',verifier=jar.get('hostel_sso_verifier')?.value??'';
 let payload;
 try{const grant=await pendingSso(db,code,verifier);const identity=grant?await platformIdentity(grant):null;if(!identity)throw Error('SSO_DENIED');payload=await consumeSso(db,code,verifier,identity,{userId:session.userId,organizationId:session.organizationId,password:String(form.get('password')??'')});}catch{redirect('/platform/connection?error=1');}
 await createSession(payload);for(const n of ['hostel_sso_state','hostel_sso_verifier','hostel_sso_code'])jar.delete(n);redirect('/dashboard');
}
