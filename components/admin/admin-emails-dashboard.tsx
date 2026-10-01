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
  ArrowSquareOutIcon as ArrowSquareOut,
  ShieldCheckIcon as ShieldCheck,
  KeyIcon as Key,
  LockKeyOpenIcon as LockKeyOpen,
  SparkleIcon as Sparkle,
  ArrowLeftIcon as ArrowLeft,
} from '@phosphor-icons/react';
import type { AuthEmailAction, RenderedEmail } from '@/lib/auth-email';

type EmailData = RenderedEmail & {
  action: AuthEmailAction;
  to: string;
  name: string;
  url: string;
};

export function AdminEmailsDashboard() {
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [selectedAction, setSelectedAction] = useState<AuthEmailAction>('verify');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [viewMode, setViewMode] = useState<'preview' | 'code' | 'text'>('preview');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Test send state
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/emails/preview')
      .then((res) => res.json() as Promise<{ emails: EmailData[] }>)
      .then((data) => {
        if (data?.emails) {
          setEmails(data.emails);
        }
      })
      .catch((err) => console.error('Failed to load email previews:', err))
      .finally(() => setLoading(false));
  }, []);

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

  const getActionIcon = (action: AuthEmailAction) => {
    switch (action) {
      case 'verify':
        return <ShieldCheck size={16} />;
      case 'reset':
        return <Key size={16} />;
      case 'password-changed':
        return <LockKeyOpen size={16} />;
      case 'welcome':
        return <Sparkle size={16} />;
    }
  };

  const getActionLabel = (action: AuthEmailAction) => {
    switch (action) {
      case 'verify':
        return 'Verify Email';
      case 'reset':
        return 'Reset Password';
      case 'password-changed':
        return 'Password Changed';
      case 'welcome':
        return 'Welcome';
    }
  };

  return (
    <main className="page" style={{ maxWidth: 1320, margin: '0 auto', padding: '40px 20px 80px' }}>
      {/* Top Header Navigation */}
      <header
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
                color: '#8fa7b7',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={14} /> Back to Catalog Admin
            </Link>
            <span style={{ color: '#29435b' }}>&middot;</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(34, 197, 94, 0.12)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.3)',
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
              color: '#f3f6f8',
              letterSpacing: '-0.04em',
            }}
          >
            Email Views &amp; Delivery
          </h1>
          <p style={{ margin: 0, color: '#9cb1c0', fontSize: 14, fontFamily: "'Manrope', sans-serif" }}>
            Production email templates styled with maritime oceanic palette, brass accents, and bulletproof client support.
          </p>
        </div>

        {/* Sender Info Badge */}
        <div
          style={{
            background: '#0e1b2a',
            border: '1px solid #284158',
            borderRadius: 12,
            padding: '14px 18px',
            minWidth: 260,
          }}
        >
          <div style={{ color: '#d8a63b', fontSize: 10, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
            SENDER CONFIGURATION
          </div>
          <div style={{ color: '#f3f6f8', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
            VivrePlay &lt;noreply@vivreplay.com&gt;
          </div>
          <div style={{ color: '#8fa7b7', fontSize: 11, marginTop: 4 }}>
            Reply-To: support@vivreplay.com
          </div>
        </div>
      </header>

      {/* Template Tabs & Viewport Controls */}
      <section
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
          {(['verify', 'reset', 'password-changed', 'welcome'] as AuthEmailAction[]).map((action) => (
            <button
              key={action}
              type="button"
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
          {/* Mode toggle */}
          <div
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
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* Left: Email Preview Canvas */}
        <div
          style={{
            background: '#040910',
            border: '1px solid #1c3044',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Top Bar of Canvas */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid #152536',
              background: '#09131e',
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
                style={{
                  width: viewport === 'mobile' ? 380 : 600,
                  maxWidth: '100%',
                  transition: 'width 0.2s ease',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  background: '#060d15',
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
                    background: '#060d15',
                  }}
                />
              </div>
            ) : viewMode === 'code' ? (
              <pre
                style={{
                  width: '100%',
                  margin: 0,
                  padding: 20,
                  background: '#060d15',
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
                style={{
                  width: '100%',
                  maxWidth: 600,
                  margin: 0,
                  padding: 24,
                  background: '#0a1724',
                  border: '1px solid #1e3347',
                  color: '#d5e2e8',
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
        <aside style={{ display: 'grid', gap: 20 }}>
          {/* Metadata Card */}
          <div
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
                  auth-{selectedAction}
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

            <form onSubmit={handleSendTest} style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#c2d3df', fontWeight: 700 }}>
                Recipient Email
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your-name@example.com"
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
              </label>

              <button
                type="submit"
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
