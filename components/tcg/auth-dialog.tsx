'use client';

import { FormEvent, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRightIcon as ArrowRight,
  EyeIcon as Eye,
  EyeSlashIcon as EyeSlash,
  UserIcon as UserRound,
} from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { authClient } from '@/lib/auth-client';
import { VivreMark } from './brand-assets';

type Mode = 'sign-in' | 'sign-up';

export function AuthDialog({ language }: { language: 'EN' | 'ID' }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('sign-in');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isId = language === 'ID';
  const returnTo = path.startsWith('/') && !path.startsWith('//') ? path : '/profile';

  const copy = isId
    ? {
        join: 'Masuk',
        signIn: 'Masuk',
        signUp: 'Daftar',
        welcomeTitle: 'Masuk ke VivrePlay',
        welcomeSub: 'Kelola deck, koleksi vault, dan aktivitas market Anda.',
        createTitle: 'Buat akun VivrePlay',
        createSub: 'Daftar gratis untuk menyimpan deck dan melacak koleksi kartu.',
        returning: 'Sudah punya akun?',
        newHere: 'Belum punya akun?',
        name: 'Nama',
        namePlaceholder: 'Nama atau panggilan',
        email: 'Email',
        emailPlaceholder: 'nama@email.com',
        password: 'Kata sandi',
        passwordPlaceholder: 'Minimal 8 karakter',
        forgot: 'Lupa kata sandi?',
        google: 'Lanjutkan dengan Google',
        working: 'Memproses…',
        verification: 'Tautan verifikasi telah dikirim. Silakan periksa kotak masuk atau spam email Anda.',
        errorSignIn: 'Email atau kata sandi tidak cocok.',
        errorSignUp: 'Gagal membuat akun. Silakan coba lagi.',
        errorGoogle: 'Gagal melanjutkan dengan Google.',
      }
    : {
        join: 'Sign in',
        signIn: 'Sign in',
        signUp: 'Sign up',
        welcomeTitle: 'Sign in to VivrePlay',
        welcomeSub: 'Access your saved decks, vault collection, and market listings.',
        createTitle: 'Create an account',
        createSub: 'Free account to sync your decks and track your collection.',
        returning: 'Already have an account?',
        newHere: "Don't have an account?",
        name: 'Name',
        namePlaceholder: 'Your name or handle',
        email: 'Email',
        emailPlaceholder: 'name@email.com',
        password: 'Password',
        passwordPlaceholder: 'At least 8 characters',
        forgot: 'Forgot password?',
        google: 'Continue with Google',
        working: 'Please wait…',
        verification: 'Verification email sent. Check your inbox to confirm your account.',
        errorSignIn: 'Invalid email or password.',
        errorSignUp: 'Could not create account. Please try again.',
        errorGoogle: 'Could not continue with Google.',
      };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setNotice('');
    setShowPassword(false);
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setError('');
      setNotice('');
      setShowPassword(false);
    }
  };

  useEffect(() => {
    const openFromAnywhere = (event: Event) => {
      const requested = (event as CustomEvent<Mode | undefined>).detail;
      setMode(requested === 'sign-in' ? 'sign-in' : 'sign-up');
      setError('');
      setNotice('');
      setShowPassword(false);
      setOpen(true);
    };
    window.addEventListener('vivreplay:open-auth', openFromAnywhere);
    return () => window.removeEventListener('vivreplay:open-auth', openFromAnywhere);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    if (mode === 'sign-in') {
      const { error: authError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: returnTo,
      });

      if (authError) {
        setError(authError.message ?? copy.errorSignIn);
        setBusy(false);
        return;
      }

      setOpen(false);
      router.replace(returnTo);
      router.refresh();
      return;
    }

    const name = String(form.get('name') ?? '').trim();
    const { error: authError } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: `${window.location.origin}/sign-in?verified=1&return_to=${encodeURIComponent(returnTo)}`,
    });

    if (authError) {
      setError(authError.message ?? copy.errorSignUp);
    } else {
      setNotice(copy.verification);
    }
    setBusy(false);
  }

  async function google() {
    setBusy(true);
    setError('');
    const { error: authError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.origin}${returnTo}`,
    });

    if (authError) {
      setError(authError.message ?? copy.errorGoogle);
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <button
        type="button"
        aria-label={copy.join}
        onClick={() => setOpen(true)}
        className="join-link"
      >
        <UserRound size={15} aria-hidden="true" />
        <span>{copy.join}</span>
      </button>

      <DialogContent className="auth-dialog">
        <DialogHeader className="auth-dialog-heading">
          <div className="dialog-mark-wrap">
            <span className="dialog-mark">
              <VivreMark size={24} />
            </span>
          </div>
          <DialogTitle>
            {mode === 'sign-in' ? copy.welcomeTitle : copy.createTitle}
          </DialogTitle>
          <DialogDescription>
            {mode === 'sign-in' ? copy.welcomeSub : copy.createSub}
          </DialogDescription>
        </DialogHeader>

        <div className="auth-dialog-body">
          {notice ? (
            <div className="auth-success" role="status">
              <p>{notice}</p>
              <button type="button" onClick={() => switchMode('sign-in')}>
                <span>{copy.signIn}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <>
              <button
                className="auth-google"
                type="button"
                disabled={busy}
                onClick={google}
              >
                <img
                  src="/brand/google-g.svg"
                  alt=""
                  width="18"
                  height="18"
                  aria-hidden="true"
                />
                <span>{copy.google}</span>
              </button>

              <div className="auth-divider">
                <span>{isId ? 'atau' : 'or'}</span>
              </div>

              <form onSubmit={submit} className="auth-form">
                {mode === 'sign-up' && (
                  <label>
                    <span>{copy.name}</span>
                    <input
                      name="name"
                      autoComplete="name"
                      placeholder={copy.namePlaceholder}
                      minLength={2}
                      maxLength={80}
                      required
                    />
                  </label>
                )}

                <label>
                  <span>{copy.email}</span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder={copy.emailPlaceholder}
                    required
                  />
                </label>

                <label>
                  <div className="auth-label-row">
                    <span>{copy.password}</span>
                    {mode === 'sign-in' && (
                      <a href="/forgot-password" className="auth-forgot-link">
                        {copy.forgot}
                      </a>
                    )}
                  </div>
                  <div className="auth-password-wrap">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                      placeholder={copy.passwordPlaceholder}
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                {error && (
                  <p className="auth-error" role="alert">
                    {error}
                  </p>
                )}

                <button className="button auth-submit-btn" disabled={busy}>
                  {busy ? copy.working : mode === 'sign-in' ? copy.signIn : copy.signUp}
                </button>
              </form>

              <p className="auth-mode-switch">
                <span>{mode === 'sign-in' ? copy.newHere : copy.returning}</span>{' '}
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
                >
                  {mode === 'sign-in' ? copy.signUp : copy.signIn}
                </button>
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
