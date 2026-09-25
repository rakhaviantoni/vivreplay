"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

export default function SignUpPage() {
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
    const { error: signUpError } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL: returnTo,
    });
    if (signUpError) {
      setError(signUpError.message ?? "We could not create your account.");
      setBusy(false);
      return;
    }
    router.replace(returnTo);
    router.refresh();
  }

  return <main className="page"><section className="form-panel"><p className="eyebrow">VIVREPLAY ACCOUNT</p><h1>Create your account</h1><p>Save your collection, decks, and listings in one place.</p><form className="form-stack" onSubmit={submit}><label>Name<input name="name" autoComplete="name" minLength={2} maxLength={80} required /></label><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>{error && <p className="error-text" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button></form><p className="muted">Already have an account? <Link href={`/sign-in?return_to=${encodeURIComponent(returnTo)}`}>Sign in</Link></p></section></main>;
}
