"use client";

import { useEffect, useState } from "react";
import { Check, Download, LoaderCircle, Mail, MessageCircle, Share2 } from "lucide-react";

export function ReceiptShareActions({
  email,
  phone,
  pdfUrl,
  receiptNumber,
}: {
  email: string | null;
  phone: string;
  pdfUrl: string;
  receiptNumber: string;
}) {
  const [copied, setCopied] = useState(false);
  const [busyAction, setBusyAction] = useState<"share" | "whatsapp" | "download" | "email" | null>(null);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [prepared, setPrepared] = useState<{ url: string; file: File } | null>(null);
  const [notice, setNotice] = useState("");
  const [chatReady, setChatReady] = useState(false);
  const digits = phone.replace(/[^0-9]/g, "");
  const internationalPhone = digits.startsWith("00") ? digits.slice(2)
    : /^0[17]\d{8}$/.test(digits) ? `254${digits.slice(1)}`
    : /^[17]\d{8}$/.test(digits) ? `254${digits}` : digits;
  const whatsappUrl = /^[1-9]\d{7,14}$/.test(internationalPhone) ? `https://wa.me/${internationalPhone}` : null;
  const file = prepared?.url === pdfUrl ? prepared.file : null;

  useEffect(() => {
    const controller = new AbortController();
    fetch(pdfUrl, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) {
          throw new Error("The receipt PDF could not be generated. Reload the page to retry.");
        }
        const blob = await response.blob();
        if (!controller.signal.aborted) {
          setPrepared({ url: pdfUrl, file: new File([blob], `receipt-${receiptNumber}.pdf`, { type: "application/pdf" }) });
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The receipt could not be loaded.");
      });
    return () => controller.abort();
  }, [pdfUrl, receiptNumber]);

  function downloadFile(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function shareReceipt(preferred: "share" | "whatsapp" = "share") {
    setError("");
    setBusyAction(preferred);
    try {
      if (!file) throw new Error("Please wait for the PDF to finish loading.");
      if (preferred === "whatsapp") {
        if (!whatsappUrl) throw new Error("Update the student’s phone number with a valid country code before opening WhatsApp.");
        downloadFile(file);
        setChatReady(true);
        setNotice(`PDF downloaded as ${file.name}. Open the chat for ${phone} below, then choose Attach → Document and select this PDF from Downloads. No contact needs to be saved.`);
        return;
      }
      // Call share directly from the click, before any fetch can consume user activation.
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      downloadFile(file);
      setCopied(true);
      setNotice("PDF downloaded. Attach this file in the app you want to share it with.");
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
      if (!file) throw new Error("Please wait for the PDF to finish loading.");
      downloadFile(file);
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
        <button className="secondary-button" disabled={busyAction !== null || !file} onClick={() => shareReceipt()} type="button">{busyAction === "share" ? <LoaderCircle className="animate-spin" size={17} /> : copied ? <Check size={17} /> : <Share2 size={17} />} {copied ? "Downloaded" : "Share PDF"}</button>
        <button className="secondary-button" disabled={busyAction !== null || !file} onClick={downloadReceipt} type="button">{busyAction === "download" ? <LoaderCircle className="animate-spin" size={17} /> : <Download size={17} />} Download PDF</button>
        {email ? <button className="secondary-button" disabled={busyAction !== null} onClick={emailReceipt} type="button">{busyAction === "email" ? <LoaderCircle className="animate-spin" size={17} /> : emailSent ? <Check size={17} /> : <Mail size={17} />} {emailSent ? "PDF emailed" : "Email PDF"}</button> : null}
        <button className="secondary-button" disabled={busyAction !== null || !file} onClick={() => shareReceipt("whatsapp")} type="button">{busyAction === "whatsapp" ? <LoaderCircle className="animate-spin" size={17} /> : <MessageCircle size={17} />} WhatsApp PDF</button>
      </div>
      {chatReady && whatsappUrl ? <a className="primary-button no-underline mt-2" href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> Open WhatsApp chat · {phone}</a> : null}
      <p className="mt-2" role="status">{notice || (file ? "WhatsApp PDF downloads the receipt, then lets you open the recorded number’s chat without saving a contact. Attach the PDF as a document. Share PDF opens the device sharing menu." : error ? "" : "Preparing receipt PDF…")}</p>
      {emailSent ? <p className="form-success mt-2">PDF receipt sent to {email}.</p> : null}
      {error ? <p className="form-error mt-2">{error}</p> : null}
    </div>
  );
}
