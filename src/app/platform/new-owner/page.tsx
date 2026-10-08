import {cookies} from 'next/headers';
import {db} from '@/lib/db';
import {pendingSso,platformIdentity} from '@/lib/platform-sso';
import {confirmFirstOwner} from './actions';
export const metadata={title:'Set up your hostel',robots:{index:false,follow:false}};
export default async function NewOwner(){
 const jar=await cookies();const grant=await pendingSso(db,jar.get('hostel_sso_code')?.value??'',jar.get('hostel_sso_verifier')?.value??'');const identity=grant?await platformIdentity(grant):null;
 const org=identity?.role==='OWNER'?await db.organization.findFirst({where:{platformOrganizationId:identity.platformOrganizationId,status:'ACTIVE',platformProductCode:'STUDENTSHOSTELS',platformBootstrapAllowed:true,users:{none:{}}},select:{name:true}}):null;
 if(!org || !identity)return <main className="login-form-panel"><section className="panel"><h1>Setup unavailable</h1><p>Start again with your approved organization owner account.</p><a href="/api/platform/sso/start">Start with SYSTEM IN ONE</a></section></main>;
 return <main className="login-form-panel"><section className="panel entity-form"><h1>Set up {org.name}</h1><p>Your verified SYSTEM IN ONE owner account is <strong>{identity.email}</strong>.</p><p>This is a newly provisioned organization. Confirm to create its first hostel management account and configure your property. It will remain unpublished until you review and publish it.</p><form action={confirmFirstOwner}><label><input name="confirm" value="yes" type="checkbox" required/>I confirm this organization is mine and want to set up its hostel management account.</label><button className="primary-button">Create my management account</button></form></section></main>;
}
