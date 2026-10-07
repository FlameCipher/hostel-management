import Link from "next/link";
import { db } from "@/lib/db";
import { usableInvitation } from "@/lib/portal-invitations";
import { TenantActivationForm } from "@/components/tenant-activation-form";
export const dynamic="force-dynamic";
export const metadata={title:"Activate tenant account",robots:{index:false,follow:false},referrer:"no-referrer"};
export default async function ActivatePage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;const invitation=await usableInvitation(db,token);
 return <main className="marketing-section"><h1>Create your tenant account</h1>{invitation?<TenantActivationForm token={token}/>:<section className="panel entity-form"><p>This private invitation is unavailable, expired or already used. Contact management for a new link.</p><Link className="secondary-button" href="/tenant/login">Student sign in</Link></section>}</main>;
}
