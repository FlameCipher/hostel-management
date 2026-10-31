import { MessageCircle } from "lucide-react";

export function ReceiptShareActions({ paymentId }: { paymentId: string }) {
  return <form action={`/payments/${encodeURIComponent(paymentId)}/receipt/whatsapp`} method="POST" target="_blank"><button className="secondary-button" type="submit"><MessageCircle size={17} /> Prepare WhatsApp receipt</button></form>;
}
