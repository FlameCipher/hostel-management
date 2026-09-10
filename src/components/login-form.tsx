"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { loginAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="form-label">Email address</label>
        <div className="input-shell">
          <Mail aria-hidden="true" size={18} />
          <input id="email" name="email" type="email" autoComplete="email" placeholder="owner@example.com" required />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="form-label">Password</label>
        <div className="input-shell">
          <LockKeyhole aria-hidden="true" size={18} />
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" minLength={8} required />
        </div>
      </div>
      {state.error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{state.error}</p>
      ) : null}
      <button className="primary-button w-full" disabled={pending} type="submit">
        {pending ? <LoaderCircle className="animate-spin" size={18} /> : null}
        Sign in
        {!pending ? <ArrowRight size={18} /> : null}
      </button>
    </form>
  );
}
