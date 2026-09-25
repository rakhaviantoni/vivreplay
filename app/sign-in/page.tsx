"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const returnTo = safeReturnTo(searchParams.get("return_to"));

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
      setError(signInError.message ?? "We could not sign you in.");
      setBusy(false);
      return;
    }
    router.replace(returnTo);
    router.refresh();
  }

  return <main className="page"><section className="form-panel"><p className="eyebrow">VIVREPLAY ACCOUNT</p><h1>Welcome back</h1><p>Sign in to keep your collection, decks, and listings together.</p><form className="form-stack" onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="error-text" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form><p className="muted">New to VivrePlay? <Link href={`/sign-up?return_to=${encodeURIComponent(returnTo)}`}>Create an account</Link></p></section></main>;
}
