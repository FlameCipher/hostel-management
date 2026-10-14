import Link from "next/link";
import { requestPropertyContext } from "@/lib/property-host";
import { createBookingTicket } from "@/lib/booking-requests";
import { TenantRegistrationForm } from "@/components/tenant-registration-forms";
import { registrationCountryCode } from "@/lib/tenant-registration";
import styles from "@/components/resident-services.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Existing student account",robots:{index:false,follow:false}};

export default async function TenantRegistrationPage(){
 const {property}=await requestPropertyContext();
 return <main className={`marketing-section ${styles.page}`} style={{maxWidth:560,marginInline:"auto"}}>
   {property?<><header style={{display:"grid",gap:8}}>
    <p className="eyebrow">Existing residents only · {property.name}</p>
    <h1 style={{margin:0,fontSize:"clamp(24px,5vw,32px)",lineHeight:1.22}}>Create your student account</h1>
    <p style={{margin:0,lineHeight:1.5}}>Already living here? Get access to your room details, rent statement, receipts and hostel messages.</p>
   </header>
   <section className={`panel ${styles.card}`}>
    <TenantRegistrationForm ticket={createBookingTicket(`registration:${property.id}`)} countryCode={registrationCountryCode(property.countryCode,property.organizationId)} hostelName={property.name}/>
   </section>
   <p className={styles.meta}>Only for students already staying at this hostel. Management verifies your registered name, mobile number and room before activation. Creating an account is free and does not book another room or change your rent.</p>
   <div className={styles.actions}>
    <Link className="secondary-button" href="/tenant/login">Already registered? Sign in</Link>
    <Link href="/help">Need help?</Link>
   </div></>:<section className={`panel ${styles.card}`}>
    <h1>Open your hostel's own website</h1>
    <p>For your privacy, account registration works only on the hostel's published website. Open the correct hostel site and choose <strong>Student sign in → Create my tenant account</strong>.</p>
    <Link href="/">Find your hostel</Link>
   </section>}
 </main>;
}
