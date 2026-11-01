import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { communicationManager } from "@/lib/communications";
import { readMessageDelivery } from "@/lib/message-delivery";
import { MessageDeliveryReport } from "@/components/message-delivery-report";
export const dynamic="force-dynamic";
export default async function DeliveryPage({searchParams}:{searchParams:Promise<{batch?:string}>}) {
 const session=await requireSession();
 if(!await communicationManager(db,session)) return <p>Management access is required.</p>;
 const {batch}=await searchParams;
 const report=await readMessageDelivery(db,session.organizationId,batch??"");
 return <div className="panel entity-form"><h1>Message delivery</h1><Link href="/communications">Back to messages</Link>{report?<MessageDeliveryReport report={report}/>:<p>No messages found for this selection.</p>}</div>;
}
