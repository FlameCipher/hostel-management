"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

export function CopyStudentUpdateLink() {
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/update-details`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }
  return <button className="secondary-button" onClick={copyLink} type="button">{copied ? <Check size={17} /> : <Link2 size={17} />}{copied ? "Link copied" : "Copy student link"}</button>;
}
