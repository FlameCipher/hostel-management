import { MessageCircle } from "lucide-react";

export function ReceiptShareActions({ phone, message }: { phone: string; message: string }) {
  const digits = phone.replace(/[^0-9]/g, "");
  const internationalPhone = digits.startsWith("00") ? digits.slice(2)
    : /^0[17]\d{8}$/.test(digits) ? `254${digits.slice(1)}`
    : /^[17]\d{8}$/.test(digits) ? `254${digits}` : digits;
  const valid = /^[1-9]\d{7,14}$/.test(internationalPhone);

  if (!valid) return <button className="secondary-button" disabled title="Update the student’s phone number to share on WhatsApp." type="button"><MessageCircle size={17} /> WhatsApp</button>;

  return <a className="secondary-button no-underline" href={`https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> WhatsApp</a>;
}
