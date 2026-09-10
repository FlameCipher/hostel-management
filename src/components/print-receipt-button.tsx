"use client";

import { Printer } from "lucide-react";

export function PrintReceiptButton({ label = "Print receipt" }: { label?: string }) {
  return <button className="primary-button print-hidden" onClick={() => window.print()} type="button"><Printer size={17} /> {label}</button>;
}
