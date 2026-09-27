'use client';

import {FormEvent, useEffect, useState} from 'react';
import {usePathname, useRouter} from 'next/navigation';
import {ArrowRightIcon as ArrowRight} from '@phosphor-icons/react';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {authClient} from '@/lib/auth-client';
import {VivreMark} from './brand-assets';

type Mode = 'sign-in' | 'sign-up';

export function AuthDialog({language}:{language:'EN'|'ID'}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('sign-up');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const id = language === 'ID';
  const returnTo = path.startsWith('/') && !path.startsWith('//') ? path : '/profile';
  const copy = id ? {join:'Gabung',signIn:'Masuk',signUp:'Buat akun',welcome:'Selamat datang kembali',create:'Simpan deck dan koleksi Anda.',returning:'Sudah punya akun?',newHere:'Baru di VivrePlay?',name:'Nama',email:'Email',password:'Kata sandi',forgot:'Lupa kata sandi?',google:'Lanjutkan dengan Google',working:'Memproses…',account:'AKUN VIVREPLAY',verification:'Cek inbox Anda untuk memverifikasi email sebelum masuk.',errorSignIn:'Kami tidak dapat memasukkan Anda.',errorSignUp:'Kami tidak dapat membuat akun Anda.',errorGoogle:'Kami tidak dapat melanjutkan dengan Google.'} : {join:'Join',signIn:'Sign in',signUp:'Create account',welcome:'Welcome back',create:'Save your decks and collection.',returning:'Already have an account?',newHere:'New to VivrePlay?',name:'Name',email:'Email',password:'Password',forgot:'Forgot password?',google:'Continue with Google',working:'Working…',account:'VIVREPLAY ACCOUNT',verification:'Check your inbox to verify your email before signing in.',errorSignIn:'We could not sign you in.',errorSignUp:'We could not create your account.',errorGoogle:'We could not continue with Google.'};
  const switchMode=(next:Mode)=>{setMode(next);setError('');setNotice('')};
  const close=(next:boolean)=>{setOpen(next);if(!next){setError('');setNotice('')}};
  useEffect(()=>{const openFromAnywhere=(event:Event)=>{const requested=(event as CustomEvent<Mode|undefined>).detail;setMode(requested==='sign-in'?'sign-in':'sign-up');setError('');setNotice('');setOpen(true)};window.addEventListener('vivreplay:open-auth',openFromAnywhere);return()=>window.removeEventListener('vivreplay:open-auth',openFromAnywhere)},[]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');setNotice('');const form=new FormData(event.currentTarget);if(mode==='sign-in'){const {error:authError}=await authClient.signIn.email({email:String(form.get('email')),password:String(form.get('password')),callbackURL:returnTo});if(authError){setError(authError.message??copy.errorSignIn);setBusy(false);return}setOpen(false);router.replace(returnTo);router.refresh();return}const {error:authError}=await authClient.signUp.email({name:String(form.get('name')),email:String(form.get('email')),password:String(form.get('password')),callbackURL:`${window.location.origin}/sign-in?verified=1&return_to=${encodeURIComponent(returnTo)}`});if(authError)setError(authError.message??copy.errorSignUp);else setNotice(copy.verification);setBusy(false)}
  async function google(){setBusy(true);setError('');const {error:authError}=await authClient.signIn.social({provider:'google',callbackURL:`${window.location.origin}${returnTo}`});if(authError){setError(authError.message??copy.errorGoogle);setBusy(false)}}
  return <Dialog open={open} onOpenChange={close}><button type="button" aria-label={copy.join} onClick={()=>setOpen(true)} className="join-link"><span>{copy.join}</span><ArrowRight size={15}/></button><DialogContent className="auth-dialog"><DialogHeader className="auth-dialog-heading"><span className="dialog-mark"><VivreMark size={28}/></span><p>{copy.account}</p><DialogTitle>{mode==='sign-in'?copy.welcome:copy.signUp}</DialogTitle><DialogDescription>{mode==='sign-in'?'Sign in to continue where you left off.':copy.create}</DialogDescription></DialogHeader><div className="auth-dialog-body">{notice?<div className="auth-success" role="status"><b>{copy.verification}</b><button type="button" onClick={()=>switchMode('sign-in')}>{copy.signIn} <ArrowRight size={14}/></button></div>:<><button className="auth-google" type="button" disabled={busy} onClick={google}><img src="/brand/google-g.svg" alt="" width="18" height="18"/>{copy.google}</button><p className="auth-divider"><span>or</span></p><form onSubmit={submit} className="auth-form">{mode==='sign-up'&&<label>{copy.name}<input name="name" autoComplete="name" minLength={2} maxLength={80} required/></label>}<label>{copy.email}<input name="email" type="email" autoComplete="email" required/></label><label>{copy.password}<input name="password" type="password" autoComplete={mode==='sign-in'?'current-password':'new-password'} minLength={8} required/></label>{mode==='sign-in'&&<a href="/forgot-password">{copy.forgot}</a>}{error&&<p className="auth-error" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy?copy.working:(mode==='sign-in'?copy.signIn:copy.signUp)}</button></form><p className="auth-mode-switch">{mode==='sign-in'?copy.newHere:copy.returning} <button type="button" onClick={()=>switchMode(mode==='sign-in'?'sign-up':'sign-in')}>{mode==='sign-in'?copy.signUp:copy.signIn}</button></p></>}</div></DialogContent></Dialog>;
}
