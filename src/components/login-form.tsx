"use client";
import Link from "next/link";
import { PasswordInput } from "@/components/password-input";


import { useActionState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { loginAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: "" };

export function LoginForm({ staff = false, phoneLogin = false }: { staff?: boolean; phoneLogin?: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="form-label">{phoneLogin ? "Email or registered phone number" : "Email address"}</label>
        <div className="input-shell">
          <Mail aria-hidden="true" size={18} />
          <input id="email" name="email" type={phoneLogin ? "text" : "email"} autoComplete="username" placeholder={phoneLogin ? "Email or registered +254 phone number" : "Your registered email address"} maxLength={254} required />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="form-label">Password</label>
        <div className="input-shell">
          <LockKeyhole aria-hidden="true" size={18} />
          <PasswordInput id="password" name="password" autoComplete="current-password" placeholder="Enter your password" minLength={8} required />
        </div>
      </div>
      <p><Link href="/forgot-password">Forgot password?</Link></p>
      <p className="muted-note">{staff
        ? "Your hostel owner or authorised administrator must create and activate your staff account first. Use the sign-in details they registered for you."
        : "Owners and authorised administrators sign in with their registered email and password."}</p>
      {phoneLogin && <p className="muted-note">Caretakers without email can use the phone number enrolled by management. For password recovery without email, contact your hostel owner.</p>}
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
