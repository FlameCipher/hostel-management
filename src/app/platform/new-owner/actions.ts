"use server";
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {createSession} from '@/lib/auth/session';
import {pendingSso,platformIdentity,consumeSso} from '@/lib/platform-sso';
export async function confirmFirstOwner(form:FormData){
 if(form.get('confirm')!=='yes')redirect('/platform/new-owner');
 const jar=await cookies(),code=jar.get('hostel_sso_code')?.value??'',verifier=jar.get('hostel_sso_verifier')?.value??'';
 const grant=await pendingSso(db,code,verifier),identity=grant?await platformIdentity(grant):null;
 if(!identity)redirect('/platform/new-owner');
 let session;try{session=await consumeSso(db,code,verifier,identity,{bootstrap:true});}catch{redirect('/platform/new-owner');}
 await createSession(session);for(const name of ['hostel_sso_state','hostel_sso_verifier','hostel_sso_code'])jar.delete(name);
 redirect('/setup');
}
