import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {createSession} from '@/lib/auth/session';
import {normalizeHost,managedPropertyHost} from '@/lib/property-host-policy';
import {acceptPropertyHandoff} from '@/lib/property-sso';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const host=normalizeHost(request.headers.get('host'));
 if(!host||managedPropertyHost(host)!==host)return new Response('Hostel website unavailable.',{status:404,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
 const url=new URL(request.url),jar=await cookies();
 let destination='/dashboard';
 try{
  const session=await acceptPropertyHandoff(db,{host,state:url.searchParams.get('state'),expectedState:jar.get('hostel_handoff_state')?.value,code:url.searchParams.get('code'),verifier:jar.get('hostel_handoff_verifier')?.value});
  await createSession(session);
 }catch{destination='/login?sharedLogin=expired';}
 const response=NextResponse.redirect(new URL(destination,`https://${host}`));
 for(const name of ['hostel_handoff_state','hostel_handoff_verifier'])response.cookies.delete(name);
 response.headers.set('cache-control','no-store');response.headers.set('referrer-policy','no-referrer');
 return response;
}
