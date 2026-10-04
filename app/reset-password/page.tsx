"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircleIcon as CheckCircle, WarningCircleIcon as WarningCircle } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { VivreMark } from "@/components/tcg/brand-assets";
import {TurnstileField,turnstileEnabled,turnstileHeaders} from '@/components/tcg/turnstile-field';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState(searchParams.get("error") ? "This reset link is invalid or has expired." : "");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turnstileToken,setTurnstileToken]=useState('');
  const [turnstileResetKey,setTurnstileResetKey]=useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return setError("This reset link is invalid or has expired.");
    if(turnstileEnabled&&!turnstileToken)return setError('Complete the security check first.');
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmPassword"))) return setError("Passwords do not match.");
    setBusy(true);
    setError("");
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token,fetchOptions:{headers:turnstileHeaders(turnstileToken)} });
    setTurnstileToken('');setTurnstileResetKey(value=>value+1);
    if (resetError) {
      setError(resetError.message ?? "We could not reset your password.");
    } else {
      setDone(true);
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
          <h1>Set new password</h1>
          <p className="auth-description">Choose a new, secure password for your VivrePlay account.</p>
        </header>

        <div className="auth-card-body">
          {done ? (
            <div className="auth-success" role="status">
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 800 }}>
                <CheckCircle size={17} weight="fill" /> Password updated!
              </div>
              <span>Your password has been changed. You can now sign in with your new password.</span>
              <Link
                href="/sign-in"
                className="button"
                style={{ marginTop: 6, display: "inline-flex", width: "100%", justifyContent: "center" }}
              >
                Sign in now
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
                  New password
                  <input name="password" type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" required />
                </label>

                <label>
                  Confirm password
                  <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} placeholder="Re-enter password" required />
                </label>

                <TurnstileField onToken={setTurnstileToken} resetKey={turnstileResetKey}/>

                <button className="button" disabled={busy || !token}>
                  {busy ? "Updating…" : "Update password"}
                </button>
              </form>

              <p className="auth-mode-switch">
                <Link href="/forgot-password">Request another reset link</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
