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
    <h1 style={{margin:0,fontSize:"clamp(24px,5vw,32px)",lineHeight:1.22}}>Request student access</h1>
    <p style={{margin:0,lineHeight:1.5}}>Your landlord has already created your student record. This step only activates online access to that existing record, room details, rent statement, receipts and hostel messages. Your owner or authorised admin must approve the request before you can sign in.</p>
   </header>
   <section className={`panel ${styles.card}`}>
    <TenantRegistrationForm ticket={createBookingTicket(`registration:${property.id}`)} countryCode={registrationCountryCode(property.countryCode,property.organizationId)} hostelName={property.name}/>
   </section>
   <p className={styles.meta}>Only for students already staying at this hostel. The hostel owner or authorised admin verifies your registered name, mobile number and room before activation. Requesting access is free and does not book another room or change your rent.</p>
   <div className={styles.actions}>
    <Link className="secondary-button" href="/tenant/login">Already have a password? Sign in</Link>
    <Link href="/update-details">Complete my existing student details</Link>
    <Link href="/help">Need help?</Link>
   </div></>:<section className={`panel ${styles.card}`}>
    <h1>Open your hostel's own website</h1>
    <p>For your privacy, account registration works only on the hostel's published website. Open the correct hostel site and choose <strong>Student sign in → Request student access</strong>.</p>
    <Link href="/">Find your hostel</Link>
   </section>}
 </main>;
}
