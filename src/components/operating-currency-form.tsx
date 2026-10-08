"use client";
import { useActionState } from "react";
import { currencyOptions } from "@/lib/currency";
import { updateOperatingCurrency } from "@/app/(app)/setup/actions";
export function OperatingCurrencyForm({ currency, locked, owner }: { currency: string; locked: boolean; owner: boolean }) {
  const [state, action, pending] = useActionState(updateOperatingCurrency, { error: "", message: "" });
  return <section className="panel entity-form"><h2>Operating currency</h2><p>Rent, expenses, receipts and reports in this workspace use <strong>{currency}</strong>. Properties using a different currency need a separate workspace.</p>{locked ? <p>Currency is fixed because pricing or financial records already exist. Existing amounts are preserved.</p> : owner ? <form action={action}><input type="hidden" name="previousCurrency" value={currency}/><label>Choose before setting prices<select name="currency" defaultValue={currency} required>{currencyOptions.map(c => <option value={c.code} key={c.code}>{c.code} — {c.name}</option>)}</select></label><p>The currency becomes fixed when you create your first rate or financial record. This does not convert money or change the US$40 platform setup fee.</p>{state.error && <p role="alert">{state.error}</p>}{state.message && <p role="status">{state.message}</p>}<button className="primary-button" disabled={pending}>{pending ? "Saving…" : "Save operating currency"}</button></form> : <p>Only the owner can choose the operating currency.</p>}</section>;
}
