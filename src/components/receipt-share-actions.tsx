"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Mail, MessageCircle, Share2 } from "lucide-react";

function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return digits;
}

export function ReceiptShareActions({
  autoOpenWhatsApp,
  email,
  message,
  phone,
  receiptNumber,
}: {
  autoOpenWhatsApp: boolean;
  email: string | null;
  message: string;
  phone: string;
  receiptNumber: string;
}) {
  const [copied, setCopied] = useState(false);
  const whatsappUrl = useMemo(() => `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(message)}`, [message, phone]);
  const emailUrl = `mailto:${encodeURIComponent(email ?? "")}?subject=${encodeURIComponent(`Payment receipt ${receiptNumber}`)}&body=${encodeURIComponent(message)}`;

  useEffect(() => {
    if (!autoOpenWhatsApp) return;
    const key = `receipt-whatsapp-opened:${receiptNumber}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    window.location.assign(whatsappUrl);
  }, [autoOpenWhatsApp, receiptNumber, whatsappUrl]);

  async function shareReceipt() {
    if (navigator.share) {
      await navigator.share({ title: `Receipt ${receiptNumber}`, text: message, url: window.location.href });
      return;
    }
    await navigator.clipboard.writeText(`${message}\n${window.location.href}`);
    setCopied(true);
  }

  return (
    <div className="heading-actions">
      <button className="secondary-button" onClick={shareReceipt} type="button">{copied ? <Check size={17} /> : <Share2 size={17} />} {copied ? "Copied" : "Share"}</button>
      {email ? <a className="secondary-button no-underline" href={emailUrl}><Mail size={17} /> Email</a> : null}
      <a className="secondary-button no-underline" href={whatsappUrl} rel="noreferrer"><MessageCircle size={17} /> WhatsApp</a>
    </div>
  );
}
