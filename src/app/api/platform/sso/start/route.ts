import {randomBytes} from 'node:crypto';
import {NextResponse} from 'next/server';
import {ssoHash} from '@/lib/platform-sso';
export const dynamic='force-dynamic';
export async function GET(){
  if(!process.env.HOSTEL_SSO_SECRET)return new Response('Shared login is not configured.',{status:503});
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  const target=new URL('https://systeminone.com/account/hostel/authorize');target.searchParams.set('state',state);target.searchParams.set('challenge',ssoHash(verifier));
  const r=NextResponse.redirect(target);r.headers.set('cache-control','no-store');r.headers.set('referrer-policy','no-referrer');
  for(const [name,value] of [['hostel_sso_state',state],['hostel_sso_verifier',verifier]])r.cookies.set(name,value,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:600});
  return r;
}
