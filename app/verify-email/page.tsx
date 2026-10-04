"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CheckCircleIcon as CheckCircle, WarningCircleIcon as WarningCircle } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { VivreMark } from "@/components/tcg/brand-assets";
import {TurnstileField,turnstileEnabled,turnstileHeaders} from '@/components/tcg/turnstile-field';

export default function VerifyEmailPage() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turnstileToken,setTurnstileToken]=useState('');
  const [turnstileResetKey,setTurnstileResetKey]=useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    if(turnstileEnabled&&!turnstileToken){setError('Complete the security check first.');setBusy(false);return;}
    const email = String(new FormData(event.currentTarget).get("email"));
    const { error: verificationError } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}/sign-in?verified=1`,
      fetchOptions:{headers:turnstileHeaders(turnstileToken)},
    });
    setTurnstileToken('');setTurnstileResetKey(value=>value+1);
    if (verificationError) {
      setError(verificationError.message ?? "We could not send the verification email. Please try again.");
    } else {
      setSent(true);
    }
    setBusy(false);
  }

  return (
    <main className="page auth-page">
      <section className="auth-card">
        <header className="auth-card-heading">
          <span className="dialog-mark">
            <VivreMark size={28} />
          </span>
          <p className="eyebrow">VIVREPLAY ACCOUNT</p>
          <h1>Verify your email</h1>
          <p className="auth-description">Enter your email and we will send a fresh verification link to activate your account.</p>
        </header>

        <div className="auth-card-body">
          {sent ? (
            <div className="auth-success" role="status">
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 800 }}>
                <CheckCircle size={17} weight="fill" /> Verification email sent
              </div>
              <span>Check your inbox for the verification link. It will expire in one hour.</span>
              <Link
                href="/sign-in"
                className="button"
                style={{ marginTop: 6, display: "inline-flex", width: "100%", justifyContent: "center" }}
              >
                Back to Sign in
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="auth-error-banner" role="alert">
                  <WarningCircle size={18} weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              <form className="auth-form" onSubmit={submit}>
                <label>
                  Email
                  <input name="email" type="email" autoComplete="email" placeholder="name@domain.com" required />
                </label>

                <TurnstileField onToken={setTurnstileToken} resetKey={turnstileResetKey}/>

                <button className="button" disabled={busy}>
                  {busy ? "Sending…" : "Send verification link"}
                </button>
              </form>

              <p className="auth-mode-switch">
                Ready to sign in? <Link href="/sign-in">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
