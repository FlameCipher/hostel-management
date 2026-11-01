"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
export function RentCheckoutButton({ action }: { action: (state: { error: string }) => Promise<{ error: string }> }) {
  const [state, submit, pending] = useActionState(action, { error: "" });
  return <form action={submit}>{state.error && <p role="alert">{state.error}</p>}<button className="primary-button" disabled={pending}>{pending ? "Opening secure checkout…" : "Open checkout — M-Pesa or card"}</button></form>;
}
export function RentPaymentRefresh() {
  const router = useRouter();
  useEffect(() => { let count = 0; const timer = setInterval(() => { if (++count <= 20) router.refresh(); else clearInterval(timer); }, 6000); return () => clearInterval(timer); }, [router]);
  return <p role="status">This page checks for updates automatically for two minutes. You can also use Check payment status below.</p>;
}
