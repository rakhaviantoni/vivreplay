import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/store';
import { cardFor, printings } from '@/packages/card-data/catalog';
import { formatCompactMoney, formatMoney, GRADING_PROVIDERS } from '@/packages/domain';
import { CardArt } from '@/components/tcg/card-art';
import { SlabPhotos } from '@/components/tcg/slab-photos';
import { ShareButton } from '@/components/tcg/share';
import { ArrowLeftIcon as ArrowLeft, ShieldCheckIcon as ShieldCheck, CheckCircleIcon as CheckCircle, StorefrontIcon as Store } from '@phosphor-icons/react/dist/ssr';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Slab Collection', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getCurrentUser();

  const row = await db().prepare(`
    SELECT c.printing_id, c.visibility, c.acquisition_amount, c.currency, c.acquired_at, c.notes,
           g.grade, g.certification, g.subgrades, g.verification_status, g.verification_source,
           pr.name AS provider, p.auth_subject, p.username
    FROM collectible_instances c
    JOIN graded_cards g ON g.instance_id=c.id
    JOIN grading_providers pr ON pr.id=g.provider_id
    JOIN profiles p ON p.id=c.owner_id
    WHERE c.id=? AND c.deleted_at IS NULL
  `).bind(id).first<{
    printing_id: string;
    visibility: string;
    acquisition_amount: number;
    currency: string;
    acquired_at: string | null;
    notes: string | null;
    grade: string;
    certification: string;
    subgrades: string | null;
    verification_status: string;
    verification_source: string;
    provider: string;
    auth_subject: string;
    username: string;
  }>();

  if (!row || (row.visibility !== 'public' && row.auth_subject !== auth?.id)) {
    notFound();
  }

  const isOwner = row.auth_subject === auth?.id;
  const c = cardFor(row.printing_id)!;
  const printing = printings.find(p => p.id === row.printing_id);
  const lang = printing?.language || 'EN';

  const photos = (await db().prepare('SELECT id,role FROM collectible_photos WHERE instance_id=?').bind(id).all<{ id: string; role: string }>()).results;

  let subgradesObj: Record<string, number | string> | null = null;
  if (row.subgrades) {
    try {
      subgradesObj = typeof row.subgrades === 'string' ? JSON.parse(row.subgrades) : row.subgrades;
    } catch {}
  }

  const isVerified = row.verification_status === 'provider_verified' || row.verification_status === 'platform_verified';

  return (
    <main className="page" style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px 20px 80px' }}>
      <div style={{ marginBottom: '18px' }}>
        <Link href="/vault" className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--vault-ink-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
          <ArrowLeft size={16} /> Back to Vault
        </Link>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 420px) 1fr',
        gap: '40px',
        background: 'var(--vault-panel)',
        borderRadius: '20px',
        border: '1px solid var(--vault-border)',
        padding: '34px',
        boxShadow: '0 12px 36px rgba(35, 28, 16, 0.06)',
      }}>
        {/* Left: Large Slab Display */}
        <div>
          <div style={{
            borderRadius: '16px',
            background: 'linear-gradient(155deg, #1b1e25, #13151b)',
            border: '2px solid #363d4a',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)',
            padding: '16px',
            color: '#fff',
          }}>
            {/* Slab Archival Plate */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '14px',
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--vault-gold)' }}>
                  {row.provider}
                </span>
                <div style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '20px', fontWeight: 700 }}>
                  {row.grade}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '9px', color: '#9ba4b2', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Cert Number
                </span>
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>
                  #{row.certification}
                </div>
              </div>
            </div>

            {/* Artwork */}
            <div style={{ borderRadius: '10px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)' }}>
              <CardArt card={c} />
            </div>

            <p style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', margin: '12px 0 0' }}>
              Authenticated Slab Visual · Inspection Photos Below
            </p>
          </div>

          {/* Slab Photos Component */}
          <div style={{ marginTop: '24px' }}>
            <SlabPhotos id={id} photos={photos} owner={isOwner} />
          </div>
        </div>

        {/* Right: Slab Metadata & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--vault-gold)', textTransform: 'uppercase' }}>
              {row.provider} {row.grade} · {row.visibility.toUpperCase()}
            </span>
            {isVerified ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '10px',
                fontWeight: 700,
                color: '#2e8b57',
                background: '#e8f5e9',
                padding: '2px 8px',
                borderRadius: '10px',
                border: '1px solid #c8e6c9',
              }}>
                <CheckCircle size={12} weight="fill" />
                {row.verification_status.replace('_', ' ').toUpperCase()}
              </span>
            ) : (
              <span style={{ fontSize: '10.5px', color: 'var(--vault-ink-muted)' }}>
                User Entered
              </span>
            )}
          </div>

          <h1 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '34px', fontWeight: 600, margin: '0 0 4px', color: 'var(--vault-ink)' }}>
            {c.name}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--vault-ink-secondary)', margin: '0 0 20px' }}>
            {c.code} · {lang} · {printing?.variant || 'Standard'} · Curated by @{row.username}
          </p>

          {/* Key Slab Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '14px',
            padding: '16px',
            borderRadius: '12px',
            background: 'var(--vault-slot-bg)',
            border: '1px solid var(--vault-border)',
            marginBottom: '20px',
          }}>
            <div>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-muted)', display: 'block' }}>
                Grader & Grade
              </span>
              <strong style={{ fontSize: '15px', color: 'var(--vault-ink)' }}>
                {row.provider} {row.grade}
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-muted)', display: 'block' }}>
                Certification
              </span>
              <strong style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', color: 'var(--vault-ink)' }}>
                {row.certification}
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-muted)', display: 'block' }}>
                Est. Market Value
              </span>
              <strong style={{ fontSize: '15px', color: 'var(--vault-gold)' }}>
                {isOwner && row.acquisition_amount ? formatCompactMoney(Math.round(row.acquisition_amount * 1.3), 'IDR') : 'Market Benchmark'}
              </strong>
            </div>
          </div>

          {/* Subgrades if Present */}
          {subgradesObj && Object.keys(subgradesObj).length > 0 && (
            <div style={{
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'var(--vault-slot-bg)',
              border: '1px solid var(--vault-border)',
              marginBottom: '20px',
            }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-muted)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                Subgrades Breakdown
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {Object.entries(subgradesObj).map(([key, val]) => (
                  <div key={key} style={{ padding: '6px', background: 'var(--vault-panel)', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--vault-border-light)' }}>
                    <small style={{ fontSize: '9px', color: 'var(--vault-ink-muted)', textTransform: 'uppercase' }}>{key}</small>
                    <div style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '15px', fontWeight: 700, color: 'var(--vault-ink)' }}>
                      {String(val)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card Effect */}
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            background: 'var(--vault-panel)',
            border: '1px solid var(--vault-border)',
            marginBottom: '24px',
            fontSize: '12.5px',
            lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--vault-ink)' }}>Card Effect:</strong>
            <p style={{ margin: '4px 0 0', color: 'var(--vault-ink-secondary)' }}>
              {c.effect}
            </p>
            {row.notes && (
              <p style={{ margin: '8px 0 0', fontStyle: 'italic', color: 'var(--vault-ink-muted)' }}>
                <strong>Provenance notes:</strong> &ldquo;{row.notes}&rdquo;
              </p>
            )}
          </div>

          {/* Share & Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', flexWrap: 'wrap' }}>
            <ShareButton
              title={`${c.name} · ${row.provider} ${row.grade}`}
              path={`/slabs/${id}`}
              privateEntity={row.visibility !== 'public'}
            />
            {isOwner && (
              <Link href={`/market?sell=${row.printing_id}`} className="vault-btn vault-btn-secondary" style={{ textDecoration: 'none' }}>
                <Store size={15} />
                List for Sale
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
