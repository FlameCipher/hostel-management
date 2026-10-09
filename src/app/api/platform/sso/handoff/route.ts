import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getSession} from '@/lib/auth/session';
import {normalizeHost,managedPropertyHost} from '@/lib/property-host-policy';
import {validOpaque} from '@/lib/platform-sso';
import {issuePropertyHandoff} from '@/lib/property-sso';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const url=new URL(request.url),host=url.searchParams.get('host'),challenge=url.searchParams.get('challenge'),state=url.searchParams.get('state');
 const fail=()=>new Response('Shared sign-in could not be confirmed. Return to your hostel website and start again.',{status:403,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
 if(normalizeHost(request.headers.get('host'))!=='studentshostels.com'||!host||managedPropertyHost(host)!==host||!validOpaque(challenge)||!validOpaque(state))return fail();
 const session=await getSession();
 let target='https://studentshostels.com/api/platform/sso/start';
 if(session?.platformSubject){
  try{target=await issuePropertyHandoff(db,session,host,challenge,state);}catch{return fail();}
 }
 const response=NextResponse.redirect(target);
 response.headers.set('cache-control','no-store');response.headers.set('referrer-policy','no-referrer');
 return response;
}
