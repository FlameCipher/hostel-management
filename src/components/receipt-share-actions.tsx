"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Download, LoaderCircle, Mail, MessageCircle, Share2 } from "lucide-react";

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
  pdfUrl,
  receiptNumber,
}: {
  autoOpenWhatsApp: boolean;
  email: string | null;
  message: string;
  phone: string;
  pdfUrl: string;
  receiptNumber: string;
}) {
  const [copied, setCopied] = useState(false);
  const [busyAction, setBusyAction] = useState<"share" | "whatsapp" | "download" | "email" | null>(null);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const whatsappUrl = useMemo(() => `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(message)}`, [message, phone]);

  useEffect(() => {
    if (!autoOpenWhatsApp) return;
    const key = `receipt-whatsapp-opened:${receiptNumber}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    window.location.assign(whatsappUrl);
  }, [autoOpenWhatsApp, receiptNumber, whatsappUrl]);

  async function getPdfFile() {
    const response = await fetch(pdfUrl, { credentials: "same-origin" });
    if (!response.ok) throw new Error("The receipt PDF could not be generated.");
    return new File([await response.blob()], `receipt-${receiptNumber}.pdf`, { type: "application/pdf" });
  }

  function downloadFile(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function shareReceipt(preferred: "share" | "whatsapp" = "share") {
    setError("");
    setBusyAction(preferred);
    try {
      const file = await getPdfFile();
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Receipt ${receiptNumber}`, text: message });
        return;
      }

      downloadFile(file);
      if (preferred === "whatsapp") {
        window.location.assign(whatsappUrl);
        return;
      }

      if (navigator.share) {
        await navigator.share({ title: `Receipt ${receiptNumber}`, text: `${message}\nPDF downloaded to this device.` });
        return;
      }
      await navigator.clipboard.writeText(`${message}\nPDF downloaded to this device.`);
      setCopied(true);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "The receipt could not be shared.");
    } finally {
      setBusyAction(null);
    }
  }

  async function downloadReceipt() {
    setError("");
    setBusyAction("download");
    try {
      downloadFile(await getPdfFile());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The receipt could not be downloaded.");
    } finally {
      setBusyAction(null);
    }
  }

  async function emailReceipt() {
    setError("");
    setEmailSent(false);
    setBusyAction("email");
    try {
      const response = await fetch(`${pdfUrl.replace(/\/pdf$/, "")}/email`, {
        method: "POST",
        credentials: "same-origin",
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The PDF receipt could not be emailed.");
      setEmailSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The PDF receipt could not be emailed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div>
      <div className="heading-actions">
        <button className="secondary-button" disabled={busyAction !== null} onClick={() => shareReceipt()} type="button">{busyAction === "share" ? <LoaderCircle className="animate-spin" size={17} /> : copied ? <Check size={17} /> : <Share2 size={17} />} {copied ? "Downloaded" : "Share PDF"}</button>
        <button className="secondary-button" disabled={busyAction !== null} onClick={downloadReceipt} type="button">{busyAction === "download" ? <LoaderCircle className="animate-spin" size={17} /> : <Download size={17} />} Download PDF</button>
        {email ? <button className="secondary-button" disabled={busyAction !== null} onClick={emailReceipt} type="button">{busyAction === "email" ? <LoaderCircle className="animate-spin" size={17} /> : emailSent ? <Check size={17} /> : <Mail size={17} />} {emailSent ? "PDF emailed" : "Email PDF"}</button> : null}
        <button className="secondary-button" disabled={busyAction !== null} onClick={() => shareReceipt("whatsapp")} type="button">{busyAction === "whatsapp" ? <LoaderCircle className="animate-spin" size={17} /> : <MessageCircle size={17} />} WhatsApp PDF</button>
      </div>
      {emailSent ? <p className="form-success mt-2">PDF receipt sent to {email}.</p> : null}
      {error ? <p className="form-error mt-2">{error}</p> : null}
    </div>
  );
}
