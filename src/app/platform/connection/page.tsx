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
 const local=session?await db.user.findFirst({where:{id:session.userId,organizationId:session.organizationId,active:true},include:{organization:true}}):null;
 return <main className="login-form-panel"><section className="panel entity-form w-full max-w-xl">
  <h1>Connect your existing hostel account</h1>
  <p>SYSTEM IN ONE account: <strong>{identity.email}</strong></p>
  <p>Organization: <strong>{identity.organizationName}</strong></p>
  <p>Use your existing hostel owner account to connect it for the first time. Your rooms, students and payment records stay in the same hostel account.</p>
  {(await searchParams).error?<p role="alert">The connection could not be confirmed. Check your hostel website, email and password, or start again.</p>:null}
  <form action={connectExisting} className="entity-form">
   {local?<p>Hostel: <strong>{local.organization.name}</strong>. Current account: <strong>{local.email}</strong>.</p>:<>
    <label>Hostel website<input name="host" type="text" autoComplete="off" placeholder="your-hostel.studentshostels.com" maxLength={300} aria-describedby="host-help" required/></label>
    <p id="host-help">Enter your hostel’s StudentsHostels address, or just the name before .studentshostels.com.</p>
    <label>Existing hostel email<input name="email" type="email" autoComplete="username" maxLength={254} required/></label>
   </>}
   <label>Current hostel password<input name="password" type="password" autoComplete="current-password" minLength={8} maxLength={128} required/></label>
   <label><input name="confirm" type="checkbox" value="yes" required/>Connect this hostel account to the SYSTEM IN ONE account shown above.</label>
   <button className="primary-button">Connect and open hostel</button>
  </form>
  <p>This connection request expires after five minutes. <a href="/api/platform/sso/start">Start again with SYSTEM IN ONE</a>.</p>
 </section></main>;
}
