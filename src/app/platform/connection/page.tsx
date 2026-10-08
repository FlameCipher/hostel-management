import {getSession} from '@/lib/auth/session';
import {cookies} from 'next/headers';
import {db} from '@/lib/db';
import {pendingSso,platformIdentity} from '@/lib/platform-sso';
import {connectExisting} from './actions';
export const dynamic='force-dynamic';
export const metadata={title:'Connect your hostel account',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function Connection({searchParams}:{searchParams:Promise<{error?:string}>}){
 const jar=await cookies(),grant=await pendingSso(db,jar.get('hostel_sso_code')?.value??'',jar.get('hostel_sso_verifier')?.value??'');const identity=grant?await platformIdentity(grant):null;
 if(!identity)return <main className="login-form-panel"><section className="panel"><h1>Connection expired</h1><a href="/api/platform/sso/start">Start again with SYSTEM IN ONE</a></section></main>;
 const session=await getSession();
 if(!session)return <main className="login-form-panel"><section className="panel"><h1>Sign in to your existing hostel account</h1><p>Then confirm its connection to {identity.email}.</p><a href="/login">Sign in to hostel</a></section></main>;
 const local=await db.user.findFirst({where:{id:session.userId,organizationId:session.organizationId,active:true},include:{organization:true}});
 if(!local)return <main><h1>Hostel account unavailable</h1></main>;
 return <main className="login-form-panel"><section className="panel entity-form"><h1>Connect your existing hostel account</h1><p>SYSTEM IN ONE account: <strong>{identity.email}</strong></p><p>Organization: <strong>{identity.organizationName}</strong></p><p>Sign in to the hostel account you want to connect. To connect a hostel for the first time, use its owner account.</p>{(await searchParams).error?<p role="alert">The connection could not be confirmed. Check your details and organization access, or start again.</p>:null}<form action={connectExisting} className="entity-form"><p>Hostel: <strong>{local.organization.name}</strong>. Current account: <strong>{local.email}</strong>.</p><label>Current hostel password<input name="password" type="password" autoComplete="current-password" minLength={8} maxLength={128} required/></label><label><input name="confirm" type="checkbox" value="yes" required/>Connect this hostel account to the SYSTEM IN ONE account shown above.</label><button className="primary-button">Connect and open hostel</button></form></section></main>;
}
