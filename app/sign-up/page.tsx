"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { CheckCircleIcon as CheckCircle, WarningCircleIcon as WarningCircle } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { VivreMark } from "@/components/tcg/brand-assets";
import {TurnstileField,turnstileEnabled,turnstileHeaders} from '@/components/tcg/turnstile-field';

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [turnstileToken,setTurnstileToken]=useState('');
  const [turnstileResetKey,setTurnstileResetKey]=useState(0);
  const returnTo = safeReturnTo(searchParams.get("return_to"));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    if(turnstileEnabled&&!turnstileToken){setError('Complete the security check first.');setBusy(false);return;}
    const form = new FormData(event.currentTarget);
    const { error: signUpError } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL: `${window.location.origin}/sign-in?verified=1&return_to=${encodeURIComponent(returnTo)}`,
      fetchOptions:{headers:turnstileHeaders(turnstileToken)},
    });
    setTurnstileToken('');setTurnstileResetKey(value=>value+1);
    if (signUpError) {
      setError(signUpError.message ?? "We could not create your account. Please try again.");
      setBusy(false);
      return;
    }
    setNotice("Check your inbox to verify your email before signing in.");
    setBusy(false);
  }

  async function signUpWithGoogle() {
    setBusy(true);
    setError("");
    if(turnstileEnabled&&!turnstileToken){setError('Complete the security check first.');setBusy(false);return;}
    const { error: googleError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}${returnTo}`,
      fetchOptions:{headers:turnstileHeaders(turnstileToken)},
    });
    setTurnstileToken('');setTurnstileResetKey(value=>value+1);
    if (googleError) {
      setError(googleError.message ?? "We could not continue with Google.");
      setBusy(false);
    }
  }

  return (
    <main className="page auth-page">
      <section className="auth-card">
        <header className="auth-card-heading">
          <span className="dialog-mark">
            <VivreMark size={28} />
          </span>
          <p className="eyebrow">VIVREPLAY ACCOUNT</p>
          <h1>Create account</h1>
          <p className="auth-description">Save your collection, decks, and listings in one place.</p>
        </header>

        <div className="auth-card-body">
          {notice ? (
            <div className="auth-success" role="status">
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 800 }}>
                <CheckCircle size={17} weight="fill" /> Verification email sent
              </div>
              <span>{notice}</span>
              <Link
                href={`/sign-in?return_to=${encodeURIComponent(returnTo)}`}
                className="button"
                style={{ marginTop: 6, display: "inline-flex", width: "100%", justifyContent: "center" }}
              >
                Sign in
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

              <TurnstileField onToken={setTurnstileToken} resetKey={turnstileResetKey}/>

              <button className="auth-google" type="button" disabled={busy} onClick={signUpWithGoogle}>
                <img src="/brand/google-g.svg" alt="" width="18" height="18" />
                Continue with Google
              </button>

              <p className="auth-divider">
                <span>or</span>
              </p>

              <form className="auth-form" onSubmit={submit}>
                <label>
                  Name
                  <input name="name" autoComplete="name" minLength={2} maxLength={80} placeholder="Your name or handle" required />
                </label>

                <label>
                  Email
                  <input name="email" type="email" autoComplete="email" placeholder="name@domain.com" required />
                </label>

                <label>
                  Password
                  <input name="password" type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" required />
                </label>

                <button className="button" disabled={busy}>
                  {busy ? "Creating account…" : "Create account"}
                </button>
              </form>

              <p className="auth-mode-switch">
                Already have an account? <Link href={`/sign-in?return_to=${encodeURIComponent(returnTo)}`}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
