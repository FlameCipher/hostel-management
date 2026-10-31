"use client";

import { useState } from "react";
import { MMAMBUGUA_RENT_GUIDE_URL, MMAMBUGUA_RENT_URL } from "@/lib/rent-collection";

export function RentPaymentLink({ share = false }: { share?: boolean }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(MMAMBUGUA_RENT_GUIDE_URL);
      setStatus("Rent payment link copied.");
    } catch {
      setStatus("Select and hold the link below, then choose Copy.");
    }
  }
  return <div>
    <div className="portal-access-actions">
      <a className="primary-button" href={MMAMBUGUA_RENT_URL} target="_blank" rel="noopener noreferrer">Pay rent with Pesapal ↗</a>
      {share && <button className="secondary-button" type="button" onClick={() => void copy()}>Copy rent payment link</button>}
    </div>
    {share && <p style={{ overflowWrap: "anywhere" }}><a href={MMAMBUGUA_RENT_GUIDE_URL}>{MMAMBUGUA_RENT_GUIDE_URL}</a></p>}
    {status && <p role="status">{status}</p>}
  </div>;
}
