import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {createSession} from '@/lib/auth/session';
import {healthfixAuthorized} from '@/lib/healthfix';
import {pendingSso,platformIdentity,consumeSso,validOpaque} from '@/lib/platform-sso';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const url=new URL(request.url),code=url.searchParams.get('code'),state=url.searchParams.get('state'),jar=await cookies();
 const verifier=jar.get('hostel_sso_verifier')?.value;
 const fail=()=>new Response('Shared login could not be confirmed. Start again from StudentsHostels.',{status:403,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
 if(!validOpaque(code)||!validOpaque(state)||!validOpaque(verifier)||!healthfixAuthorized(jar.get('hostel_sso_state')?.value,state))return fail();
 const grant=await pendingSso(db,code,verifier);if(!grant)return fail();
 const identity=await platformIdentity(grant);if(!identity)return fail();
 const linked=await db.user.findFirst({where:{platformUserId:identity.platformUserId,active:true,organization:{platformOrganizationId:identity.platformOrganizationId,platformProductCode:'STUDENTSHOSTELS',status:'ACTIVE'}},select:{id:true}});
 const r=NextResponse.redirect(new URL(linked?'/dashboard':'/platform/connection','https://studentshostels.com'));r.headers.set('cache-control','no-store');r.headers.set('referrer-policy','no-referrer');
 if(linked){await createSession(await consumeSso(db,code,verifier,identity));for(const name of ['hostel_sso_state','hostel_sso_verifier','hostel_sso_code'])r.cookies.delete(name);}
 else r.cookies.set('hostel_sso_code',code,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:300});
 return r;
}
