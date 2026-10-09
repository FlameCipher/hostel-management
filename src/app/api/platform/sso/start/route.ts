import {normalizeHost,managedPropertyHost,publishedWhere} from '@/lib/property-host-policy';
import {db} from '@/lib/db';
import {randomBytes} from 'node:crypto';
import {NextResponse} from 'next/server';
import {ssoHash} from '@/lib/platform-sso';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const host=normalizeHost(request.headers.get('host'));
  if(!process.env.HOSTEL_SSO_SECRET)return new Response('Shared login is not configured.',{status:503});
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  const propertyHost=!!host&&managedPropertyHost(host)===host;
  if(propertyHost){
    const property=await db.property.findFirst({where:{...publishedWhere(),customDomain:host},select:{id:true}});
    if(!property)return new Response('Hostel website unavailable.',{status:404,headers:{'cache-control':'no-store'}});
  }else if(host!=='studentshostels.com'&&process.env.NODE_ENV==='production')return NextResponse.redirect('https://studentshostels.com/api/platform/sso/start');
  const target=new URL(propertyHost?'https://studentshostels.com/api/platform/sso/handoff':'https://systeminone.com/account/hostel/authorize');
  if(propertyHost)target.searchParams.set('host',host!);
  target.searchParams.set('state',state);target.searchParams.set('challenge',ssoHash(verifier));
  const r=NextResponse.redirect(target);r.headers.set('cache-control','no-store');r.headers.set('referrer-policy','no-referrer');
  const prefix=propertyHost?'hostel_handoff':'hostel_sso';
  for(const [name,value] of [[`${prefix}_state`,state],[`${prefix}_verifier`,verifier]])r.cookies.set(name,value,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:600});
  return r;
}
