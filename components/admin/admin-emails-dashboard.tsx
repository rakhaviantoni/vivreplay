'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  EnvelopeSimpleIcon as EnvelopeSimple,
  DeviceMobileIcon as DeviceMobile,
  DesktopIcon as Desktop,
  CheckCircleIcon as CheckCircle,
  WarningCircleIcon as WarningCircle,
  PaperPlaneTiltIcon as PaperPlaneTilt,
  CodeIcon as Code,
  EyeIcon as Eye,
  TextTIcon as TextT,
  CopyIcon as Copy,
  ShieldCheckIcon as ShieldCheck,
  KeyIcon as Key,
  LockKeyOpenIcon as LockKeyOpen,
  SparkleIcon as Sparkle,
  ArrowLeftIcon as ArrowLeft,
  ArrowClockwiseIcon as Refresh,
} from '@phosphor-icons/react';
import type { AuthEmailAction, RenderedEmail } from '@/lib/auth-email';
import {marketEmailEvents,marketEmailLabels,type MarketEmailEvent} from '@/lib/market/email-template-types';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';

type AdminEmailAction=AuthEmailAction|`market:${MarketEmailEvent}`;
const authEmailActions:AuthEmailAction[]=['verify','reset','password-changed','welcome'];
const adminEmailActions:AdminEmailAction[]=[...authEmailActions,...marketEmailEvents.map(event=>`market:${event}` as const)];
const adminEmailThemeStyles=`
.admin-emails-page{color:var(--mail-admin-ink)!important}
.admin-emails-page>header{border-color:var(--mail-admin-border)!important}
.admin-emails-page>header h1{color:var(--mail-admin-ink)!important}
.admin-emails-page>header p,.admin-emails-page>header a{color:var(--mail-admin-muted)!important}
.admin-emails-page>header>div:last-child,.admin-emails-page .admin-email-panel{background:var(--mail-admin-panel)!important;border-color:var(--mail-admin-border)!important;color:var(--mail-admin-ink)!important;box-shadow:var(--mail-admin-shadow)!important}
.admin-emails-page>header>div:last-child div,.admin-emails-page .admin-email-panel h3{color:var(--mail-admin-ink)!important}
.admin-emails-page .admin-email-sender{background:var(--mail-admin-panel)!important;border-color:var(--mail-admin-border)!important;box-shadow:var(--mail-admin-shadow)!important}
.admin-emails-page .admin-email-sender div{color:var(--mail-admin-ink)!important}
.admin-emails-page .admin-email-verified{background:var(--mail-admin-selected)!important;border-color:var(--mail-admin-border)!important;color:var(--mail-admin-accent-ink)!important}
.admin-emails-page .admin-email-toolbar,.admin-emails-page .admin-email-control-segment,.admin-emails-page .admin-email-mode-segment,.admin-emails-page .admin-email-viewport-segment{background:var(--mail-admin-soft)!important;border-color:var(--mail-admin-border)!important;box-shadow:var(--mail-admin-shadow)!important}
.admin-emails-page .admin-email-mode-option[aria-pressed=true],.admin-emails-page .admin-email-viewport-option[aria-pressed=true]{background:var(--mail-admin-selected)!important;color:var(--mail-admin-accent-ink)!important}
.admin-emails-page .admin-email-template-option{color:var(--mail-admin-muted)!important}
.admin-emails-page .admin-email-template-option[aria-pressed=true]{background:var(--mail-admin-selected)!important;border-color:var(--mail-admin-accent)!important;color:var(--mail-admin-accent-ink)!important}
.admin-emails-page .admin-email-segment{background:var(--mail-admin-soft)!important;border-color:var(--mail-admin-border)!important}
.admin-emails-page .admin-email-segment-option,.admin-emails-page .admin-email-mode-option{background:transparent!important;color:var(--mail-admin-muted)!important}
.admin-emails-page .admin-email-segment-option[aria-pressed=true],.admin-emails-page .admin-email-mode-option[aria-pressed=true]{background:var(--mail-admin-selected)!important;color:var(--mail-admin-accent-ink)!important}
.admin-emails-page .admin-email-preview-canvas{background:var(--mail-admin-canvas)!important;border-color:var(--mail-admin-border)!important;box-shadow:none!important}
.admin-emails-page .admin-email-preview-topbar{background:var(--mail-admin-soft)!important;border-color:var(--mail-admin-border)!important;color:var(--mail-admin-muted)!important}
.admin-emails-page .admin-email-preview-topbar span{color:var(--mail-admin-ink)!important}
.admin-emails-page .admin-email-preview-stage{background:var(--mail-admin-canvas)!important}
.admin-emails-page .admin-email-panel h3,.admin-emails-page .admin-email-panel h3+ p,.admin-emails-page .admin-email-panel label,.admin-emails-page .admin-email-panel span{color:var(--mail-admin-ink)!important}
.admin-emails-page .admin-email-panel label{color:var(--mail-admin-muted)!important}
.admin-emails-page .admin-email-panel input{background:var(--mail-admin-input)!important;border-color:var(--mail-admin-border)!important;color:var(--mail-admin-ink)!important}
.admin-emails-page .admin-email-panel input::placeholder{color:var(--mail-admin-muted)!important}
.admin-emails-page .admin-email-category{background:var(--mail-admin-soft)!important;color:var(--mail-admin-accent-ink)!important}
.admin-emails-page .admin-email-submit{background:var(--mail-admin-accent)!important;color:var(--mail-admin-accent-ink)!important}
.admin-emails-page .admin-email-result[data-success=true]{background:var(--mail-admin-success-bg)!important;border-color:var(--mail-admin-success-border)!important;color:var(--mail-admin-success-ink)!important}
.admin-emails-page .admin-email-result[data-success=false]{background:var(--mail-admin-error-bg)!important;border-color:var(--mail-admin-error-border)!important;color:var(--mail-admin-error-ink)!important}
.admin-emails-page .admin-email-result span{color:inherit!important}
.admin-emails-page .admin-email-pre{background:var(--mail-admin-code)!important;border-color:var(--mail-admin-border)!important;color:var(--mail-admin-code-ink)!important}
.admin-emails-page .admin-sent-email-dialog{width:min(1100px,calc(100vw - 32px));max-width:1100px;max-height:88vh;overflow:auto;background:var(--mail-admin-panel);border-color:var(--mail-admin-border);color:var(--mail-admin-ink)}
.admin-emails-page .admin-sent-email-row{width:100%;display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,1.5fr) minmax(130px,.8fr) auto;gap:16px;align-items:center;padding:14px 16px;text-align:left;border:0;border-bottom:1px solid var(--mail-admin-border);background:transparent;color:var(--mail-admin-ink);cursor:pointer}
.admin-emails-page .admin-sent-email-row:hover{background:var(--mail-admin-soft)}
.admin-emails-page .admin-sent-email-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 20px;padding:16px 0;border-bottom:1px solid var(--mail-admin-border)}
@media(max-width:640px){.admin-emails-page .admin-sent-email-row{grid-template-columns:minmax(0,1fr) auto;gap:4px 12px}.admin-emails-page .admin-sent-email-meta{grid-template-columns:minmax(0,1fr)}}
html[data-theme=light] .admin-emails-page{--mail-admin-ink:#292b27;--mail-admin-muted:#6f7169;--mail-admin-panel:#fffdf8;--mail-admin-soft:#f4f0e7;--mail-admin-canvas:#e9e5dc;--mail-admin-input:#fff;--mail-admin-code:#f7f4ec;--mail-admin-code-ink:#40443e;--mail-admin-border:#ded8cb;--mail-admin-selected:#f4ead1;--mail-admin-accent:#b28731;--mail-admin-accent-ink:#4f3c14;--mail-admin-success-bg:#e8f2e8;--mail-admin-success-border:#b9d0bb;--mail-admin-success-ink:#31563a;--mail-admin-error-bg:#f7e9e7;--mail-admin-error-border:#e0bfbb;--mail-admin-error-ink:#8c3631;--mail-admin-shadow:0 8px 24px rgba(52,45,30,.06)}
html[data-theme=dark] .admin-emails-page{--mail-admin-ink:#e7ecee;--mail-admin-muted:#a5b2b8;--mail-admin-panel:#101d2b;--mail-admin-soft:#0a1723;--mail-admin-canvas:#0b1520;--mail-admin-input:#07101a;--mail-admin-code:#060d15;--mail-admin-code-ink:#d5e2e8;--mail-admin-border:#284158;--mail-admin-selected:#2c3440;--mail-admin-accent:#d8a63b;--mail-admin-accent-ink:#1b1b17;--mail-admin-success-bg:#16271c;--mail-admin-success-border:#315b3a;--mail-admin-success-ink:#a8d6ae;--mail-admin-error-bg:#2b1c1b;--mail-admin-error-border:#67403d;--mail-admin-error-ink:#efaaa3;--mail-admin-shadow:0 14px 32px rgba(0,0,0,.16)}
@media(max-width:980px){.admin-emails-page .admin-emails-layout{grid-template-columns:minmax(0,1fr)!important}}
@media(max-width:640px){.admin-emails-page{padding:24px 12px 56px!important}.admin-emails-page .admin-email-toolbar{padding:10px!important}.admin-emails-page .admin-emails-header>div:last-child{width:100%;min-width:0!important}.admin-emails-page .admin-email-preview-stage{padding:20px 8px!important;min-height:420px!important}}
`;

type EmailData = RenderedEmail & {
  action: AdminEmailAction;
  to: string;
  name: string;
  url: string;
};

type SentEmail={id:string;to:string[];from:string;subject:string;created_at:string;last_event?:string;html?:string|null;text?:string|null;reply_to?:string[]|null;cc?:string[]|null;bcc?:string[]|null;message_id?:string|null};

export function AdminEmailsDashboard() {
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [selectedAction, setSelectedAction] = useState<AdminEmailAction>('verify');
  const [previewLanguage,setPreviewLanguage]=useState<'en'|'id'>('en');
  const [previewTheme,setPreviewTheme]=useState<'light'|'dark'>('light');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [viewMode, setViewMode] = useState<'preview' | 'code' | 'text'>('preview');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Test send state
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sentDialogOpen,setSentDialogOpen]=useState(false);
  const [sentEmails,setSentEmails]=useState<SentEmail[]>([]);
  const [sentHasMore,setSentHasMore]=useState(false);
  const [sentCursor,setSentCursor]=useState<string|undefined>();
  const [sentLoading,setSentLoading]=useState(false);
  const [sentError,setSentError]=useState('');
  const [selectedSentEmail,setSelectedSentEmail]=useState<SentEmail|null>(null);
  const [sentDetailLoading,setSentDetailLoading]=useState(false);
  const [sentDetailError,setSentDetailError]=useState('');
  const [sentDetailMode,setSentDetailMode]=useState<'preview'|'text'|'html'>('preview');

  useEffect(() => {
    fetch(`/api/admin/emails/preview?locale=${previewLanguage}&theme=${previewTheme}`)
      .then((res) => res.json() as Promise<{ emails: EmailData[] }>)
      .then((data) => {
        if (data?.emails) {
          setEmails(data.emails);
        }
      })
      .catch((err) => console.error('Failed to load email previews:', err))
      .finally(() => setLoading(false));
  }, [previewLanguage,previewTheme]);

  const currentEmail = emails.find((e) => e.action === selectedAction) || emails[0];

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) return;

    setSending(true);
    setSendResult(null);

    try {
      const res = await fetch('/api/admin/emails/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail,
          action: selectedAction,
          name: 'Navigator',
          locale:previewLanguage,
          theme:previewTheme,
        }),
      });

      const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
      if (!res.ok) {
        setSendResult({ success: false, message: data.error || 'Failed to send test email.' });
      } else {
        setSendResult({
          success: true,
          message: data.message || `Test email successfully sent to ${testEmail} via Resend.`,
        });
      }
    } catch (err) {
      setSendResult({
        success: false,
        message: err instanceof Error ? err.message : 'Network error while delivering email.',
      });
    } finally {
      setSending(false);
    }
  };

  const loadSentEmails=async(after?:string,append=false)=>{
    setSentLoading(true);setSentError('');
    try{
      const response=await fetch(`/api/admin/emails/sent?limit=100${after?`&after=${encodeURIComponent(after)}`:''}`,{cache:'no-store'});
      const data=await response.json() as {data?:SentEmail[];has_more?:boolean;next_cursor?:string;error?:string};
      if(!response.ok)throw new Error(data.error||'Could not load sent emails.');
      setSentEmails(current=>append?[...current,...(data.data??[])]:data.data??[]);setSentHasMore(Boolean(data.has_more));setSentCursor(data.next_cursor);
    }catch(error){setSentError(error instanceof Error?error.message:'Could not load sent emails.')}finally{setSentLoading(false)}
  };

  const openSentEmail=async(email:SentEmail)=>{
    setSelectedSentEmail(email);setSentDetailLoading(true);setSentDetailError('');setSentDetailMode('preview');
    try{
      const response=await fetch(`/api/admin/emails/sent/${encodeURIComponent(email.id)}`,{cache:'no-store'});
      const data=await response.json() as SentEmail&{error?:string};
      if(!response.ok)throw new Error(data.error||'Could not load this email.');
      setSelectedSentEmail({...email,...data});
    }catch(error){setSentDetailError(error instanceof Error?error.message:'Could not load this email.')}finally{setSentDetailLoading(false)}
  };

  const getActionIcon = (action: AdminEmailAction) => {
    if(action.startsWith('market:'))return <EnvelopeSimple size={16}/>;
    switch (action) {
      case 'verify':
        return <ShieldCheck size={16} />;
      case 'reset':
        return <Key size={16} />;
      case 'password-changed':
        return <LockKeyOpen size={16} />;
      case 'welcome':
        return <Sparkle size={16} />;
      default:return <EnvelopeSimple size={16}/>;
    }
  };

  const getActionLabel = (action: AdminEmailAction) => {
    if(action.startsWith('market:'))return `Market: ${marketEmailLabels[action.slice('market:'.length) as MarketEmailEvent]}`;
    switch (action) {
      case 'verify':
        return 'Verify Email';
      case 'reset':
        return 'Reset Password';
      case 'password-changed':
        return 'Password Changed';
      case 'welcome':
        return 'Welcome';
      default:return action;
    }
  };

  return (
    <main className="page admin-emails-page" style={{ maxWidth: 1320, margin: '0 auto', padding: '40px 20px 80px' }}>
      <style>{adminEmailThemeStyles}</style>
      {/* Top Header Navigation */}
      <header
        className="admin-emails-header"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
          paddingBottom: 24,
          borderBottom: '1px solid #22384e',
          marginBottom: 28,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Link
              href="/admin"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--mail-admin-muted)',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={14} /> Back to Catalog Admin
            </Link>
            <span aria-hidden="true" style={{ color: 'var(--mail-admin-muted)' }}>|</span>
            <span
              className="admin-email-verified"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#f4ead1',
                color: '#6a511b',
                border: '1px solid #ded8cb',
                borderRadius: 9999,
                padding: '2px 10px',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.04em',
              }}
            >
              <CheckCircle size={13} weight="fill" /> Domain @vivreplay.com Verified
            </span>
          </div>

          <h1
            style={{
              margin: '0 0 8px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 'clamp(28px, 3.5vw, 42px)',
              fontWeight: 800,
              color: 'var(--mail-admin-ink)',
              letterSpacing: '-0.04em',
            }}
          >
            Email Views &amp; Delivery
          </h1>
          <p style={{ margin: 0, color: 'var(--mail-admin-muted)', fontSize: 14, fontFamily: "'Manrope', sans-serif" }}>
            Preview account and Market emails, compare desktop and mobile layouts, and send test messages.
          </p>
        </div>

        {/* Sender Info Badge */}
        <div
          className="admin-email-sender"
          style={{
            background: '#0e1b2a',
            border: '1px solid #284158',
            borderRadius: 12,
            padding: '14px 18px',
            minWidth: 260,
          }}
        >
          <div style={{ color: 'var(--mail-admin-accent)', fontSize: 10, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
            SENDER CONFIGURATION
          </div>
          <div style={{ color: 'var(--mail-admin-ink)', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
            VivrePlay &lt;noreply@vivreplay.com&gt;
          </div>
          <div style={{ color: 'var(--mail-admin-muted)', fontSize: 11, marginTop: 4 }}>
            Reply-To: support@vivreplay.com
          </div>
        </div>
      </header>

      <section className="admin-email-panel" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',margin:'0 0 24px',padding:'16px 20px',border:'1px solid #22384e',borderRadius:12,background:'#0d1b2a'}}>
        <div><strong style={{display:'block',fontSize:15}}>Sent emails</strong><span style={{color:'var(--mail-admin-muted)',fontSize:13}}>Check delivery status and open the message that was sent.</span></div>
        <button type="button" className="admin-email-submit" onClick={()=>{setSentDialogOpen(true);void loadSentEmails()}} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'9px 14px',border:0,borderRadius:8,fontWeight:700,cursor:'pointer'}}><EnvelopeSimple size={16}/>Recent emails</button>
      </section>

      <Dialog open={sentDialogOpen} onOpenChange={open=>{setSentDialogOpen(open);if(!open){setSelectedSentEmail(null);setSentDetailError('')}}}>
        <DialogContent className="admin-sent-email-dialog">
          <DialogHeader><DialogTitle>{selectedSentEmail?.subject||'Recent sent emails'}</DialogTitle></DialogHeader>
          {selectedSentEmail? <div>
            <button type="button" onClick={()=>setSelectedSentEmail(null)} style={{margin:'0 0 12px',padding:0,border:0,background:'transparent',color:'var(--mail-admin-accent-ink)',fontWeight:700,cursor:'pointer'}}>← All sent emails</button>
            {sentDetailLoading?<p>Loading email…</p>:sentDetailError?<p role="alert">{sentDetailError}</p>:<>
              <div className="admin-sent-email-meta">
                {([['From',selectedSentEmail.from],['Subject',selectedSentEmail.subject],['To',selectedSentEmail.to?.join(', ')],['ID',selectedSentEmail.id],['Sent',selectedSentEmail.created_at],['Status',selectedSentEmail.last_event??'Sent']] as const).map(([label,value])=><div key={label}><small style={{display:'block',color:'var(--mail-admin-muted)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</small><span style={{overflowWrap:'anywhere'}}>{value||'—'}</span></div>)}
              </div>
              <div style={{display:'flex',gap:6,padding:'14px 0'}}>{(['preview','text','html'] as const).map(mode=><button key={mode} type="button" aria-pressed={sentDetailMode===mode} onClick={()=>setSentDetailMode(mode)} style={{padding:'7px 12px',border:'1px solid var(--mail-admin-border)',borderRadius:7,background:sentDetailMode===mode?'var(--mail-admin-selected)':'var(--mail-admin-soft)',color:'var(--mail-admin-ink)',fontWeight:700,cursor:'pointer',textTransform:'capitalize'}}>{mode}</button>)}</div>
              {sentDetailMode==='preview'?<iframe title="Sent email preview" sandbox="" srcDoc={selectedSentEmail.html||'<p>No HTML body was saved for this email.</p>'} style={{width:'100%',height:'min(58vh,680px)',border:'1px solid var(--mail-admin-border)',borderRadius:8,background:'#fff'}}/>:<pre className="admin-email-pre" style={{maxHeight:'58vh',overflow:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:16,border:'1px solid var(--mail-admin-border)',borderRadius:8}}>{sentDetailMode==='html'?selectedSentEmail.html||'No HTML body was saved for this email.':selectedSentEmail.text||'No plain-text body was saved for this email.'}</pre>}
            </>}
          </div>:<div>
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}><button type="button" onClick={()=>void loadSentEmails()} disabled={sentLoading} aria-label="Refresh sent emails" title="Refresh" style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 10px',border:'1px solid var(--mail-admin-border)',borderRadius:7,background:'var(--mail-admin-soft)',color:'var(--mail-admin-ink)',cursor:'pointer'}}><Refresh size={15}/>Refresh</button></div>
            {sentError?<p role="alert">{sentError}</p>:sentEmails.length===0&&!sentLoading?<p style={{color:'var(--mail-admin-muted)'}}>No sent emails found.</p>:null}
            <div>{sentEmails.map(email=><button className="admin-sent-email-row" key={email.id} type="button" onClick={()=>void openSentEmail(email)}><strong style={{overflowWrap:'anywhere'}}>{email.to?.join(', ')||'Unknown recipient'}</strong><span style={{overflowWrap:'anywhere'}}>{email.subject}</span><small style={{color:'var(--mail-admin-muted)'}}>{email.created_at?new Date(email.created_at).toLocaleString():''}</small><span className="admin-email-category">{email.last_event||'sent'}</span></button>)}</div>
            {sentLoading&&<p style={{padding:'12px 16px',color:'var(--mail-admin-muted)'}}>Loading emails…</p>}
            {sentHasMore&&sentCursor&&<button type="button" onClick={()=>void loadSentEmails(sentCursor,true)} disabled={sentLoading} style={{marginTop:12,padding:'8px 12px',border:'1px solid var(--mail-admin-border)',borderRadius:7,background:'var(--mail-admin-soft)',color:'var(--mail-admin-ink)',fontWeight:700,cursor:'pointer'}}>Load more</button>}
          </div>}
        </DialogContent>
      </Dialog>

      {/* Template Tabs & Viewport Controls */}
      <section
        className="admin-email-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          background: '#0d1b2a',
          border: '1px solid #22384e',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 24,
        }}
      >
        {/* Email Template Switcher */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {adminEmailActions.map((action) => (
            <button
              key={action}
              type="button"
              className="admin-email-template-option"
              aria-pressed={selectedAction===action}
              onClick={() => setSelectedAction(action)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 8,
                border: selectedAction === action ? '1px solid #d8a63b' : '1px solid transparent',
                background: selectedAction === action ? 'rgba(216, 166, 59, 0.15)' : 'transparent',
                color: selectedAction === action ? '#f5da92' : '#9cb1c0',
                fontWeight: selectedAction === action ? 800 : 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {getActionIcon(action)}
              <span>{getActionLabel(action)}</span>
            </button>
          ))}
        </div>

        {/* Viewport and Code Mode Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="admin-email-segment admin-email-control-segment" style={{display:'inline-flex',gap:3,padding:3,border:'1px solid #1c3044',borderRadius:8,background:'#08121d'}} aria-label="Market email language">
            {(['en','id'] as const).map(locale=><button key={locale} type="button" className="admin-email-segment-option" aria-pressed={previewLanguage===locale} onClick={()=>setPreviewLanguage(locale)} style={{padding:'6px 10px',border:0,borderRadius:6,background:previewLanguage===locale?'#1c3349':'transparent',color:previewLanguage===locale?'#f5da92':'#8fa7b7',fontSize:11,fontWeight:700,cursor:'pointer'}}>{locale.toUpperCase()}</button>)}
          </div>
          <div className="admin-email-segment admin-email-control-segment" style={{display:'inline-flex',gap:3,padding:3,border:'1px solid #1c3044',borderRadius:8,background:'#08121d'}} aria-label="Email appearance">
            {(['light','dark'] as const).map(theme=><button key={theme} type="button" className="admin-email-segment-option" onClick={()=>setPreviewTheme(theme)} aria-pressed={previewTheme===theme} style={{padding:'6px 10px',border:0,borderRadius:6,background:previewTheme===theme?'#1c3349':'transparent',color:previewTheme===theme?'#f5da92':'#8fa7b7',fontSize:11,fontWeight:700,cursor:'pointer'}}>{theme==='light'?'Light':'Dark'}</button>)}
          </div>
          {/* Mode toggle */}
          <div
            className="admin-email-mode-segment"
            style={{
              display: 'inline-flex',
              background: '#08121d',
              border: '1px solid #1c3044',
              borderRadius: 8,
              padding: 3,
            }}
          >
            <button
              type="button"
              className="admin-email-mode-option"
              aria-pressed={viewMode==='preview'}
              onClick={() => setViewMode('preview')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                border: 0,
                background: viewMode === 'preview' ? '#1c3349' : 'transparent',
                color: viewMode === 'preview' ? '#f3f6f8' : '#8fa7b7',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Eye size={14} /> Preview
            </button>
            <button
              type="button"
              className="admin-email-mode-option"
              aria-pressed={viewMode==='code'}
              onClick={() => setViewMode('code')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                border: 0,
                background: viewMode === 'code' ? '#1c3349' : 'transparent',
                color: viewMode === 'code' ? '#f3f6f8' : '#8fa7b7',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Code size={14} /> HTML
            </button>
            <button
              type="button"
              className="admin-email-mode-option"
              aria-pressed={viewMode==='text'}
              onClick={() => setViewMode('text')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                border: 0,
                background: viewMode === 'text' ? '#1c3349' : 'transparent',
                color: viewMode === 'text' ? '#f3f6f8' : '#8fa7b7',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <TextT size={14} /> Plain text
            </button>
          </div>

          {/* Viewport Width (only in preview mode) */}
          {viewMode === 'preview' && (
            <div
              className="admin-email-viewport-segment"
              style={{
                display: 'inline-flex',
                background: '#08121d',
                border: '1px solid #1c3044',
                borderRadius: 8,
                padding: 3,
              }}
            >
              <button
                type="button"
                className="admin-email-viewport-option"
                aria-pressed={viewport==='desktop'}
                onClick={() => setViewport('desktop')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 0,
                  background: viewport === 'desktop' ? '#1c3349' : 'transparent',
                  color: viewport === 'desktop' ? '#d8a63b' : '#8fa7b7',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Desktop viewport (600px)"
              >
                <Desktop size={15} /> Desktop
              </button>
              <button
                type="button"
                className="admin-email-viewport-option"
                aria-pressed={viewport==='mobile'}
                onClick={() => setViewport('mobile')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 0,
                  background: viewport === 'mobile' ? '#1c3349' : 'transparent',
                  color: viewport === 'mobile' ? '#d8a63b' : '#8fa7b7',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Mobile viewport (380px)"
              >
                <DeviceMobile size={15} /> Mobile
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Main Grid: Preview on Left, Metadata & Live Test on Right */}
      <div
        className="admin-emails-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* Left: Email Preview Canvas */}
        <div
          className="admin-email-preview-canvas"
          style={{
            background: previewTheme==='dark'?'#10171d':'#e9e5dc',
            border: '1px solid #1c3044',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: 'none',
          }}
        >
          {/* Top Bar of Canvas */}
          <div
            className="admin-email-preview-topbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid #152536',
              background: previewTheme==='dark'?'#0a1723':'#f4f0e7',
              fontSize: 12,
              color: '#8fa7b7',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: '#d8a63b',
                }}
              />
              <span style={{ fontWeight: 700, color: '#c2d3df' }}>
                Subject: {currentEmail?.subject || 'Loading…'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {viewMode !== 'preview' && (
                <button
                  type="button"
                  onClick={() => handleCopy(viewMode === 'code' ? currentEmail.html : currentEmail.text)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid #284158',
                    background: '#112233',
                    color: '#c2d3df',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
              <span style={{ fontSize: 11, color: '#627a8c' }}>
                {viewport === 'desktop' ? '600px width' : '380px width'}
              </span>
            </div>
          </div>

          {/* Canvas Area */}
          <div
            className="admin-email-preview-stage"
            style={{
              padding: viewport === 'mobile' ? '32px 16px' : '40px 24px',
              display: 'flex',
              justifyContent: 'center',
              minHeight: 620,
              overflowX: 'auto',
            }}
          >
            {loading ? (
              <div style={{ display: 'grid', placeItems: 'center', color: '#8fa7b7', fontSize: 14 }}>
                Rendering template…
              </div>
            ) : viewMode === 'preview' ? (
            <div
              className="admin-email-viewport-segment"
              style={{
                  width: viewport === 'mobile' ? 380 : 600,
                  maxWidth: '100%',
                  transition: 'width 0.2s ease',
                  boxShadow: previewTheme==='dark'?'0 12px 32px rgba(0,0,0,.3)':'0 10px 28px rgba(52,45,30,.12)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  background: previewTheme==='dark'?'#10171d':'#f1eee6',
                }}
              >
                <iframe
                  title="Email Preview"
                  srcDoc={currentEmail?.html}
                  style={{
                    width: '100%',
                    height: 680,
                    border: 0,
                    display: 'block',
                    background: previewTheme==='dark'?'#10171d':'#f1eee6',
                  }}
                />
              </div>
            ) : viewMode === 'code' ? (
              <pre
                className="admin-email-pre"
                style={{
                  width: '100%',
                  margin: 0,
                  padding: 20,
                  background: previewTheme==='dark'?'#060d15':'#f7f4ec',
                  color: '#9cc2db',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  lineHeight: 1.5,
                  overflowX: 'auto',
                  borderRadius: 8,
                }}
              >
                {currentEmail?.html}
              </pre>
            ) : (
              <pre
                className="admin-email-pre"
                style={{
                  width: '100%',
                  maxWidth: 600,
                  margin: 0,
                  padding: 24,
                  background: previewTheme==='dark'?'#0a1724':'#f7f4ec',
                  border: '1px solid #1e3347',
                  color: previewTheme==='dark'?'#d5e2e8':'#303831',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  borderRadius: 10,
                }}
              >
                {currentEmail?.text}
              </pre>
            )}
          </div>
        </div>

        {/* Right Sidebar: Details & Live Test Sender */}
        <aside className="admin-email-sidebar" style={{ display: 'grid', gap: 20 }}>
          {/* Metadata Card */}
          <div
            className="admin-email-panel"
            style={{
              background: '#0d1b2a',
              border: '1px solid #22384e',
              borderRadius: 12,
              padding: 20,
            }}
          >
            <h3
              style={{
                margin: '0 0 14px',
                color: '#f3f6f8',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 15,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <EnvelopeSimple size={18} color="#d8a63b" /> Email Specifications
            </h3>

            <div style={{ display: 'grid', gap: 12, fontSize: 12 }}>
              <div>
                <span style={{ display: 'block', color: '#7b93a4', fontWeight: 700, marginBottom: 2 }}>From:</span>
                <span style={{ color: '#d5e2e8', fontFamily: 'monospace' }}>{currentEmail?.from || 'VivrePlay <noreply@vivreplay.com>'}</span>
              </div>
              <div>
                <span style={{ display: 'block', color: '#7b93a4', fontWeight: 700, marginBottom: 2 }}>Reply-To:</span>
                <span style={{ color: '#d5e2e8', fontFamily: 'monospace' }}>{currentEmail?.replyTo || 'support@vivreplay.com'}</span>
              </div>
              <div>
                <span style={{ display: 'block', color: '#7b93a4', fontWeight: 700, marginBottom: 2 }}>Action Category:</span>
                <span
                  className="admin-email-category"
                  style={{
                    display: 'inline-block',
                    background: '#152638',
                    color: '#f5da92',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    fontSize: 11,
                  }}
                >
                  {selectedAction.startsWith('market:')?selectedAction.replace(':','-'):`auth-${selectedAction}`}
                </span>
              </div>
              <div>
                <span style={{ display: 'block', color: '#7b93a4', fontWeight: 700, marginBottom: 2 }}>Subject Line:</span>
                <span style={{ color: '#f3f6f8', fontWeight: 600 }}>{currentEmail?.subject}</span>
              </div>
              <div>
                <span style={{ display: 'block', color: '#7b93a4', fontWeight: 700, marginBottom: 2 }}>Font Stack:</span>
                <span style={{ color: '#9cb1c0' }}>Plus Jakarta Sans (Headings), Manrope (Body)</span>
              </div>
            </div>
          </div>

          {/* Live Test Sender Tool */}
          <div
            className="admin-email-panel"
            style={{
              background: '#0d1b2a',
              border: '1px solid #284158',
              borderRadius: 12,
              padding: 20,
            }}
          >
            <h3
              style={{
                margin: '0 0 8px',
                color: '#f3f6f8',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 15,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <PaperPlaneTilt size={18} color="#d8a63b" /> Send Live Test Email
            </h3>
            <p style={{ margin: '0 0 16px', color: '#8fa7b7', fontSize: 12, lineHeight: 1.5 }}>
              Dispatch the currently selected <b>{getActionLabel(selectedAction)}</b> email through your verified Resend domain to any real inbox.
            </p>

            <form onSubmit={handleSendTest} data-lpignore="true" data-form-type="other" style={{ display: 'grid', gap: 12 }}>
              <label htmlFor="admin-test-email" style={{ display: 'grid', gap: 6, fontSize: 12, color: '#c2d3df', fontWeight: 700 }}>
                Recipient Email
              </label>
              <input
                  id="admin-test-email"
                  className="admin-email-input"
                  type="email"
                  name="admin-test-email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your-name@example.com"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  required
                  style={{
                    padding: '10px 12px',
                    background: '#07101a',
                    border: '1px solid #284158',
                    borderRadius: 8,
                    color: '#f3f6f8',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />

              <button
                type="submit"
                className="admin-email-submit"
                disabled={sending || !testEmail}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '11px 16px',
                  background: '#d8a63b',
                  color: '#08101a',
                  border: 0,
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: sending || !testEmail ? 'not-allowed' : 'pointer',
                  opacity: sending || !testEmail ? 0.6 : 1,
                  boxShadow: '0 2px 8px rgba(216, 166, 59, 0.25)',
                }}
              >
                <PaperPlaneTilt size={15} />
                {sending ? 'Delivering via Resend…' : `Send ${getActionLabel(selectedAction)}`}
              </button>

              {sendResult && (
                <div
                  className="admin-email-result"
                  data-success={sendResult.success}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    background: sendResult.success ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: sendResult.success ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    color: sendResult.success ? '#4ade80' : '#f87171',
                  }}
                >
                  {sendResult.success ? <CheckCircle size={16} /> : <WarningCircle size={16} />}
                  <span>{sendResult.message}</span>
                </div>
              )}
            </form>
          </div>

          {/* Helpful Tips Card */}
          <div
            className="admin-email-panel"
            style={{
              background: '#09131e',
              border: '1px solid #1a2c3f',
              borderRadius: 12,
              padding: 18,
              fontSize: 12,
              color: '#7b93a4',
              lineHeight: 1.6,
            }}
          >
            <div style={{ color: '#d8a63b', fontWeight: 800, marginBottom: 6 }}>
              BEST PRACTICES
            </div>
            All email templates use inline styles for maximum compatibility across Apple Mail, Gmail (Web &amp; Mobile), and Outlook desktop clients.
          </div>
        </aside>
      </div>
    </main>
  );
}
