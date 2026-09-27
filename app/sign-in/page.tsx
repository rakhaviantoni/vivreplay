"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { CheckCircleIcon as CheckCircle, WarningCircleIcon as WarningCircle } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { VivreMark } from "@/components/tcg/brand-assets";

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

function getFriendlyError(code: string | null): string {
  if (!code) return "";
  switch (code) {
    case "USER_NOT_FOUND":
      return "No account found with this email. Please check your address or create an account.";
    case "INVALID_CREDENTIALS":
    case "INVALID_PASSWORD":
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Incorrect email or password. Please try again.";
    case "EMAIL_NOT_VERIFIED":
      return "Please verify your email before signing in. Check your inbox or request a fresh verification link below.";
    case "ACCOUNT_LOCKED":
      return "This account is temporarily locked for security. Please contact support.";
    case "SESSION_EXPIRED":
      return "Your session has expired. Please sign in again.";
    case "OAUTH_FAILED":
    case "GOOGLE_OAUTH_FAILED":
      return "Could not continue with Google. Please try again or sign in with email.";
    default:
      return code.replace(/_/g, " ");
  }
}

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlErrorCode = searchParams.get("error");
  const [error, setError] = useState(getFriendlyError(urlErrorCode));
  const [busy, setBusy] = useState(false);
  const returnTo = safeReturnTo(searchParams.get("return_to"));
  const verified = searchParams.get("verified") === "1";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const { error: signInError } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL: returnTo,
    });
    if (signInError) {
      setError(signInError.message ?? "We could not sign you in. Please check your credentials.");
      setBusy(false);
      return;
    }
    router.replace(returnTo);
    router.refresh();
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    const { error: googleError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}${returnTo}`,
    });
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
          <h1>Welcome back</h1>
          <p className="auth-description">Sign in to keep your collection, decks, and listings together.</p>
        </header>

        <div className="auth-card-body">
          {verified && (
            <div className="auth-success" role="status">
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 800 }}>
                <CheckCircle size={17} weight="fill" /> Email verified
              </div>
              <span>Your email is confirmed. You can now sign in with your credentials.</span>
            </div>
          )}

          {error && (
            <div className="auth-error-banner" role="alert">
              <WarningCircle size={18} weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <button className="auth-google" type="button" disabled={busy} onClick={signInWithGoogle}>
            <img src="/brand/google-g.svg" alt="" width="18" height="18" />
            Continue with Google
          </button>

          <p className="auth-divider">
            <span>or</span>
          </p>

          <form className="auth-form" onSubmit={submit}>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" placeholder="name@domain.com" required />
            </label>

            <label>
              Password
              <input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
            </label>

            <div className="auth-form-links">
              <Link href="/forgot-password">Forgot password?</Link>
              <Link href="/verify-email">Resend verification</Link>
            </div>

            <button className="button" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="auth-mode-switch">
            New to VivrePlay? <Link href={`/sign-up?return_to=${encodeURIComponent(returnTo)}`}>Create an account</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
