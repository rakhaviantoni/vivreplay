"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { CheckCircleIcon as CheckCircle, WarningCircleIcon as WarningCircle } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { VivreMark } from "@/components/tcg/brand-assets";
import {TurnstileField,turnstileEnabled,turnstileHeaders} from '@/components/tcg/turnstile-field';

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

function nameSuggestions(email:string){
  const local=email.trim().split('@')[0]?.split('+')[0]??'';
  const words=local.replace(/([a-z])([A-Z])/g,'$1 $2').split(/[._-]+/).map(word=>word.trim()).filter(Boolean);
  const title=(value:string)=>value.slice(0,1).toUpperCase()+value.slice(1).toLowerCase();
  const options=[words.map(title).join(' ')];
  if(words.length>1){
    options.push(title(words.join('')));
    options.push(title(words[0]));
  }
  return [...new Map(options.filter(Boolean).map(value=>[value.toLowerCase(),value])).values()];
}

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [turnstileToken,setTurnstileToken]=useState('');
  const [turnstileResetKey,setTurnstileResetKey]=useState(0);
  const [googleTurnstileToken,setGoogleTurnstileToken]=useState('');
  const [googleTurnstileResetKey,setGoogleTurnstileResetKey]=useState(0);
  const [step,setStep]=useState<'email'|'details'>('email');
  const [email,setEmail]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [suggestions,setSuggestions]=useState<string[]>([]);
  const emailRef=useRef<HTMLInputElement>(null);
  const nameRef=useRef<HTMLInputElement>(null);
  const previousStep=useRef<'email'|'details'>('email');
  const returnTo = safeReturnTo(searchParams.get("return_to"));
  useEffect(()=>{if(step!==previousStep.current){if(step==='details')nameRef.current?.focus();else emailRef.current?.focus();previousStep.current=step}},[step]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if(step==='email'){
      const nextSuggestions=nameSuggestions(email);
      setSuggestions(nextSuggestions);
      setDisplayName(nextSuggestions[0]??'');
      setStep('details');
      return;
    }
    setBusy(true);
    if(turnstileEnabled&&!turnstileToken){setError('Complete the security check first.');setBusy(false);return;}
    const { error: signUpError } = await authClient.signUp.email({
      name: displayName.trim(),
      email: email.trim(),
      password: String(new FormData(event.currentTarget).get("password")),
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
    if(turnstileEnabled&&!googleTurnstileToken){setError('Complete the security check first.');setBusy(false);return;}
    const { error: googleError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}${returnTo}`,
      fetchOptions:{headers:turnstileHeaders(googleTurnstileToken)},
    });
    setGoogleTurnstileToken('');setGoogleTurnstileResetKey(value=>value+1);
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
          <h1>{step==='email'?'Create your account':'Add your details'}</h1>
          <p className="auth-description">{step==='email'?'Save your collection, decks, and listings in one place.':'Choose how your name appears on your profile.'}</p>
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

              <form className="auth-form" onSubmit={submit}>
                {step==='email'?<>
                  <label>
                    Email
                    <input ref={emailRef} name="email" type="email" autoComplete="email" placeholder="name@domain.com" value={email} onChange={event=>setEmail(event.target.value)} required />
                  </label>
                  <button className="button" type="submit">Continue</button>
                </>:<>
                  <div className="auth-email-confirm"><div><span>Email</span><strong>{email}</strong></div><button type="button" onClick={()=>setStep('email')}>Change</button></div>
                  <label>
                    Name
                    <input ref={nameRef} name="name" autoComplete="name" minLength={2} maxLength={80} placeholder="Your name" value={displayName} onChange={event=>setDisplayName(event.target.value)} required />
                  </label>
                  <p className="auth-name-note">Shown on your profile. You can edit your display name and username in Profile later.</p>
                  {suggestions.length>0&&<div className="auth-name-suggestion-group" role="group" aria-label="Name suggestions"><span>{suggestions.length>1?'Choose a suggestion or edit your name':'Suggested from your email'}</span><div>{suggestions.map(suggestion=><button key={suggestion} type="button" className={displayName===suggestion?'is-selected':''} aria-pressed={displayName===suggestion} onClick={()=>setDisplayName(suggestion)}>{suggestion}</button>)}</div></div>}
                  <label>
                    Password
                    <input name="password" type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" required />
                  </label>
                  <TurnstileField onToken={setTurnstileToken} resetKey={turnstileResetKey}/>
                  <button className="button" disabled={busy}>
                    {busy ? "Creating account…" : "Create account"}
                  </button>
                </>}
              </form>

              {step==='email'&&<>
                <p className="auth-divider"><span>or</span></p>
                <div className="auth-action-security"><TurnstileField onToken={setGoogleTurnstileToken} resetKey={googleTurnstileResetKey}/></div>
                <button className="auth-google" type="button" disabled={busy} onClick={signUpWithGoogle}>
                  <img src="/brand/google-g.svg" alt="" width="18" height="18" />
                  Continue with Google
                </button>
              </>}

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
