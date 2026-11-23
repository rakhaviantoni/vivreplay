'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '@/components/ui/localized-link';
import {
  ArrowSquareOutIcon as ArrowSquareOut,
  CalendarBlankIcon as Calendar,
  CheckCircleIcon as CheckCircle,
  ClockIcon as Clock,
  FacebookLogoIcon as FacebookLogo,
  GlobeIcon as Globe,
  InstagramLogoIcon as InstagramLogo,
  LinkSimpleIcon as LinkSimple,
  PaperPlaneTiltIcon as PaperPlaneTilt,
  PlusIcon as Plus,
  SealCheckIcon as SealCheck,
  SparkleIcon as Sparkle,
  ThreadsLogoIcon as ThreadsLogo,
  TrashIcon as Trash,
} from '@phosphor-icons/react';
import { formatMoney } from '@/packages/domain';

type ConnectedAccountItem = {
  id: string;
  platform: string;
  platformAccountId?: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

type SellerSocialPostItem = {
  id: string;
  listingId: string | null;
  listingTitle: string | null;
  listingHref: string | null;
  listingType: string | null;
  listingStatus: string | null;
  listingAmount: number | null;
  listingCurrency: string | null;
  createdAt: string | null;
  platform: string;
  status: string;
  postId: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  caption: string | null;
  username: string | null;
  permalink: string | null;
  mediaUrl: string | null;
  canRemoteDelete: boolean;
};

type TesterRequestItem = {
  id: string;
  instagramHandle: string | null;
  facebookProfile: string | null;
  threadsHandle: string | null;
  platforms: string[];
  notes: string | null;
  status: 'PENDING' | 'INVITED' | 'APPROVED' | 'DECLINED';
  createdAt: string;
  updatedAt: string;
};

const PLATFORM_META: Record<string, { label: string }> = {
  instagram: { label: 'Instagram' },
  facebook: { label: 'Facebook' },
  threads: { label: 'Threads' },
};

function PlatformIcon({ platform, size = 15 }: { platform: string; size?: number }) {
  const key = platform.toLowerCase();
  if (key === 'instagram') return <InstagramLogo size={size} weight="fill" />;
  if (key === 'facebook') return <FacebookLogo size={size} weight="fill" />;
  if (key === 'threads') return <ThreadsLogo size={size} weight="fill" />;
  return <Globe size={size} />;
}

function formatDateLabel(raw: string | null, lang: 'EN' | 'ID'): string {
  if (!raw) return '';
  const date = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString(lang === 'ID' ? 'id-ID' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProfileSocialsPanel({
  language,
  onNotice,
  onError,
}: {
  language: 'EN' | 'ID';
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const t = useCallback((en: string, id: string) => (language === 'ID' ? id : en), [language]);

  const [accounts, setAccounts] = useState<ConnectedAccountItem[]>([]);
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>(['instagram', 'facebook', 'threads']);
  const [posts, setPosts] = useState<SellerSocialPostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [removingPostId, setRemovingPostId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'SCHEDULED'>('ALL');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [quota, setQuota] = useState<{
    tier: 'free' | 'pro';
    usedThisMonth: number;
    monthlyLimit: number | null;
    remainingThisMonth: number | null;
    canSchedule: boolean;
  } | null>(null);

  // Tester access form state
  const [testerRequest, setTesterRequest] = useState<TesterRequestItem | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [reqPlatforms, setReqPlatforms] = useState<string[]>(['instagram']);
  const [reqInstagram, setReqInstagram] = useState('');
  const [reqFacebook, setReqFacebook] = useState('');
  const [reqThreads, setReqThreads] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [savingRequest, setSavingRequest] = useState(false);

  const loadAll = useCallback(async () => {
    setLoadingAccounts(true);
    setLoadingPosts(true);
    setLoadingRequest(true);

    const [accRes, platRes, postRes, reqRes] = await Promise.all([
      fetch('/api/market/social/accounts', { cache: 'no-store' })
        .then((r) => r.json() as Promise<{ accounts?: ConnectedAccountItem[] }>)
        .catch(() => null),
      fetch('/api/market/social/available-platforms', { cache: 'no-store' })
        .then((r) => r.json() as Promise<{ platforms?: string[] }>)
        .catch(() => null),
      fetch('/api/market/social/publish?all=1', { cache: 'no-store' })
        .then((r) => r.json() as Promise<{ logs?: SellerSocialPostItem[]; quota?: typeof quota }>)
        .catch(() => null),
      fetch('/api/market/social/tester-request', { cache: 'no-store' })
        .then((r) => r.json() as Promise<{ request?: TesterRequestItem | null }>)
        .catch(() => null),
    ]);

    if (Array.isArray(accRes?.accounts)) {
      setAccounts(accRes.accounts);
    }
    if (Array.isArray(platRes?.platforms) && platRes.platforms.length > 0) {
      setAvailablePlatforms(platRes.platforms);
    }
    if (Array.isArray(postRes?.logs)) {
      setPosts(postRes.logs);
    }
    if (postRes?.quota) {
      setQuota(postRes.quota);
    }
    if (reqRes?.request) {
      const r = reqRes.request as TesterRequestItem;
      setTesterRequest(r);
      setReqPlatforms(r.platforms.length > 0 ? r.platforms : ['instagram']);
      setReqInstagram(r.instagramHandle ? `@${r.instagramHandle}` : '');
      setReqFacebook(r.facebookProfile ?? '');
      setReqThreads(r.threadsHandle ? `@${r.threadsHandle}` : '');
      setReqNotes(r.notes ?? '');
    }

    setLoadingAccounts(false);
    setLoadingPosts(false);
    setLoadingRequest(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleConnect(platform: string) {
    setConnectingPlatform(platform);
    try {
      const res = await fetch('/api/market/social/auth-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        onError(data?.error || t('Unable to start social connection', 'Gagal memulai koneksi media sosial'));
        return;
      }
      window.location.href = data.url;
    } catch {
      onError(t('Network error while connecting account', 'Terjadi kesalahan jaringan saat menghubungkan akun'));
    } finally {
      setConnectingPlatform(null);
    }
  }

  async function handleDisconnect(accountId: string) {
    try {
      const res = await fetch(`/api/market/social/accounts?id=${encodeURIComponent(accountId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        onError(t('Unable to disconnect account', 'Gagal memutuskan akun'));
        return;
      }
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      onNotice(t('Social account disconnected.', 'Akun media sosial diputuskan.'));
    } catch {
      onError(t('Unable to disconnect account', 'Gagal memutuskan akun'));
    }
  }

  async function handleRemovePost(logId: string) {
    setRemovingPostId(logId);
    try {
      const res = await fetch(`/api/market/social/publish?logId=${encodeURIComponent(logId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        onError(t('Unable to remove post record', 'Gagal menghapus catatan postingan'));
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== logId));
      onNotice(t('Post removed from your history.', 'Postingan dihapus dari riwayat Anda.'));
    } catch {
      onError(t('Unable to remove post record', 'Gagal menghapus catatan postingan'));
    } finally {
      setRemovingPostId(null);
    }
  }

  function toggleReqPlatform(platform: string) {
    setReqPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  }

  async function handleSubmitTesterRequest(e: React.FormEvent) {
    e.preventDefault();
    setSavingRequest(true);
    try {
      const res = await fetch('/api/market/social/tester-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: reqPlatforms,
          instagramHandle: reqInstagram.trim() || null,
          facebookProfile: reqFacebook.trim() || null,
          threadsHandle: reqThreads.trim() || null,
          notes: reqNotes.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { request?: TesterRequestItem; error?: string } | null;
      if (!res.ok || !data?.request) {
        onError(data?.error || t('Unable to submit early access request', 'Gagal mengirim permintaan akses awal'));
        return;
      }
      setTesterRequest(data.request);
      onNotice(
        t(
          'Early access request saved. Once invited, accept the tester invite in your Instagram or Facebook app settings.',
          'Permintaan akses awal tersimpan. Setelah diundang, terima undangan tester di pengaturan aplikasi Instagram atau Facebook Anda.'
        )
      );
    } catch {
      onError(t('Unable to submit early access request', 'Gagal mengirim permintaan akses awal'));
    } finally {
      setSavingRequest(false);
    }
  }

  const visiblePosts = useMemo(() => {
    return posts.filter((post) => {
      if (statusFilter !== 'ALL' && post.status !== statusFilter) return false;
      if (platformFilter !== 'ALL') {
        const plat = post.platform.split(',')[0]?.trim().toLowerCase() ?? post.platform.toLowerCase();
        if (plat !== platformFilter) return false;
      }
      return true;
    });
  }, [platformFilter, posts, statusFilter]);

  const presentPlatforms = useMemo(() => {
    const set = new Set<string>();
    for (const p of posts) {
      const key = p.platform.split(',')[0]?.trim().toLowerCase() ?? p.platform.toLowerCase();
      if (key) set.add(key);
    }
    return Array.from(set);
  }, [posts]);

  return (
    <div className="profile-socials-stack">
      {/* 1. Connected Social Accounts */}
      <section className="profile-socials-section">
        <div className="profile-socials-head">
          <div>
            <h2>{t('Connected Social Accounts', 'Akun Media Sosial Terhubung')}</h2>
            <p>
              {t(
                'Verified social handles appear on your public storefront and Market listings, and can receive listing auto-posts.',
                'Akun terverifikasi tampil di etalase publik dan listing Market Anda, serta dapat menerima auto-post listing.'
              )}
            </p>
          </div>
        </div>

        {loadingAccounts ? (
          <p className="profile-socials-muted">{t('Loading connected accounts...', 'Memuat akun terhubung...')}</p>
        ) : (
          <div className="profile-socials-accounts">
            {accounts.length > 0 ? (
              <div className="profile-socials-connected-list">
                {accounts.map((acc) => {
                  const pKey = acc.platform.toLowerCase();
                  return (
                    <div key={acc.id} className="profile-social-account-row">
                      <div className="profile-social-account-main">
                        <span className={`profile-social-badge is-${pKey}`}>
                          <PlatformIcon platform={pKey} size={16} />
                        </span>
                        <div className="profile-social-account-copy">
                          <strong>
                            {acc.username ? `@${acc.username.replace(/^@/, '')}` : acc.displayName || PLATFORM_META[pKey]?.label || acc.platform}
                            <SealCheck size={14} weight="fill" className="player-social-verified" aria-hidden="true" />
                          </strong>
                          <span>{PLATFORM_META[pKey]?.label ?? acc.platform}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="profile-social-disconnect-btn"
                        onClick={() => void handleDisconnect(acc.id)}
                      >
                        {t('Disconnect', 'Putuskan')}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="profile-socials-muted">
                {t('No social accounts connected yet.', 'Belum ada akun media sosial yang terhubung.')}
              </p>
            )}

            {(() => {
              const connectedSet = new Set(accounts.map((acc) => acc.platform.toLowerCase()));
              const remainingPlatforms = availablePlatforms.filter((plat) => !connectedSet.has(plat.toLowerCase()));
              if (!remainingPlatforms.length) return null;
              return (
                <div className="profile-social-connect-row">
                  {remainingPlatforms.map((plat) => (
                    <button
                      key={plat}
                      type="button"
                      className="profile-social-connect-btn"
                      disabled={connectingPlatform === plat}
                      onClick={() => void handleConnect(plat)}
                    >
                      <PlatformIcon platform={plat} size={15} />
                      <span>
                        {connectingPlatform === plat
                          ? t('Connecting...', 'Menghubungkan...')
                          : t(`Connect ${PLATFORM_META[plat]?.label ?? plat}`, `Hubungkan ${PLATFORM_META[plat]?.label ?? plat}`)}
                      </span>
                      <Plus size={13} />
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {/* 2. Early Access / Tester Request Form */}
      <section className="profile-socials-section">
        <div className="profile-socials-head">
          <div>
            <h2>
              <Sparkle size={16} weight="fill" />
              {t('Social Auto-Post Early Access', 'Akses Awal Auto-Post Media Sosial')}
            </h2>
            <p>
              {t(
                'Auto-publishing is currently open to invited tester accounts while platform review is completed. Submit your social handle below so we can add your account to the tester list.',
                'Fitur auto-post saat ini tersedia untuk akun tester sambil menunggu peninjauan platform selesai. Kirim username media sosial Anda agar dapat kami tambahkan ke daftar tester.'
              )}
            </p>
          </div>
          {testerRequest && (
            <span className={`profile-tester-status is-${testerRequest.status.toLowerCase()}`}>
              {testerRequest.status === 'PENDING' && t('Pending Review', 'Menunggu Tinjauan')}
              {testerRequest.status === 'INVITED' && t('Tester Invite Sent', 'Undangan Dikirim')}
              {testerRequest.status === 'APPROVED' && t('Approved', 'Disetujui')}
              {testerRequest.status === 'DECLINED' && t('Needs Update', 'Perlu Pembaruan')}
            </span>
          )}
        </div>

        {testerRequest?.status === 'INVITED' && (
          <div className="profile-tester-callout" role="status">
            <CheckCircle size={17} weight="fill" />
            <div>
              <strong>{t('Action needed on Instagram / Facebook', 'Tindakan diperlukan di Instagram / Facebook')}</strong>
              <p>
                {t(
                  'Your tester invite has been sent. Open Instagram or Facebook -> Settings -> Apps and Websites -> Tester Invites and accept the invite, then click Connect above.',
                  'Undangan tester telah dikirim. Buka Instagram atau Facebook -> Pengaturan -> Aplikasi dan Situs Web -> Undangan Penguji lalu terima undangan, kemudian klik Hubungkan di atas.'
                )}
              </p>
            </div>
          </div>
        )}

        {loadingRequest ? (
          <p className="profile-socials-muted">{t('Loading access status...', 'Memuat status akses...')}</p>
        ) : (
          <form className="profile-tester-form" onSubmit={(e) => void handleSubmitTesterRequest(e)}>
            <div className="profile-tester-platforms">
              <span className="profile-tester-field-label">
                {t('Platforms you want to test', 'Platform yang ingin dicoba')}
              </span>
              <div className="profile-tester-platform-chips">
                {(['instagram', 'facebook', 'threads'] as const).map((plat) => {
                  const selected = reqPlatforms.includes(plat);
                  return (
                    <button
                      key={plat}
                      type="button"
                      className={`profile-tester-platform-chip ${selected ? 'is-active' : ''}`}
                      onClick={() => toggleReqPlatform(plat)}
                      aria-pressed={selected}
                    >
                      <PlatformIcon platform={plat} size={14} />
                      <span>{PLATFORM_META[plat].label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="profile-tester-grid">
              <label>
                <span>{t('Instagram handle', 'Username Instagram')}</span>
                <input
                  type="text"
                  value={reqInstagram}
                  onChange={(e) => setReqInstagram(e.target.value)}
                  placeholder="@yourstore"
                />
              </label>
              <label>
                <span>{t('Facebook profile link or Meta email', 'Link profil Facebook atau email Meta')}</span>
                <input
                  type="text"
                  value={reqFacebook}
                  onChange={(e) => setReqFacebook(e.target.value)}
                  placeholder="facebook.com/username or email@domain.com"
                />
              </label>
              <label>
                <span>{t('Threads handle (optional)', 'Username Threads (opsional)')}</span>
                <input
                  type="text"
                  value={reqThreads}
                  onChange={(e) => setReqThreads(e.target.value)}
                  placeholder="@yourstore"
                />
              </label>
              <label>
                <span>{t('Store or collector note (optional)', 'Catatan toko atau kolektor (opsional)')}</span>
                <input
                  type="text"
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  placeholder={t('e.g. One Piece & figures storefront', 'mis. Etalase One Piece & figure')}
                />
              </label>
            </div>

            <div className="profile-tester-actions">
              <button type="submit" className="button" disabled={savingRequest}>
                <PaperPlaneTilt size={15} />
                {savingRequest
                  ? t('Submitting...', 'Mengirim...')
                  : testerRequest
                    ? t('Update Tester Request', 'Perbarui Permintaan Tester')
                    : t('Request Tester Access', 'Minta Akses Tester')}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 3. Published & Scheduled Posts Across Listings */}
      <section className="profile-socials-section">
        <div className="profile-socials-head">
          <div>
            <h2>{t('Published & Scheduled Posts', 'Postingan Terbit & Terjadwal')}</h2>
            <p>
              {t(
                'Every social post created from your listings, with direct links to both the social post and the Market listing.',
                'Setiap postingan media sosial dari listing Anda, lengkap dengan tautan ke postingan dan listing Market.'
              )}
            </p>
            {quota && (
              <div className="profile-social-quota-row">
                <span className={`profile-tester-status ${quota.tier === 'pro' ? 'is-approved' : 'is-pending'}`}>
                  {quota.tier === 'pro'
                    ? t('Market Pro: Unlimited auto-posts & scheduling', 'Market Pro: Auto-post & jadwal tanpa batas')
                    : t(
                        `Free plan: ${quota.remainingThisMonth ?? 0} of ${quota.monthlyLimit ?? 3} auto-posts remaining this month`,
                        `Paket Gratis: ${quota.remainingThisMonth ?? 0} dari ${quota.monthlyLimit ?? 3} auto-post tersisa bulan ini`
                      )}
                </span>
                {quota.tier === 'free' && (
                  <Link href="/checkout/pro" className="market-listing-social-manage-link">
                    {t('Upgrade to Market Pro', 'Upgrade ke Market Pro')}
                  </Link>
                )}
              </div>
            )}
          </div>
          {posts.length > 0 && (
            <div className="profile-socials-filters">
              <div className="player-trade-filters" role="group" aria-label={t('Filter by status', 'Filter status')}>
                {(['ALL', 'PUBLISHED', 'SCHEDULED'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={statusFilter === s ? 'is-active' : ''}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === 'ALL' ? t('All', 'Semua') : s === 'PUBLISHED' ? t('Published', 'Terbit') : t('Scheduled', 'Terjadwal')}
                  </button>
                ))}
              </div>
              {presentPlatforms.length > 1 && (
                <div className="player-trade-filters" role="group" aria-label={t('Filter by platform', 'Filter platform')}>
                  <button
                    type="button"
                    className={platformFilter === 'ALL' ? 'is-active' : ''}
                    onClick={() => setPlatformFilter('ALL')}
                  >
                    {t('All platforms', 'Semua')}
                  </button>
                  {presentPlatforms.map((plat) => (
                    <button
                      key={plat}
                      type="button"
                      className={platformFilter === plat ? 'is-active' : ''}
                      onClick={() => setPlatformFilter(plat)}
                    >
                      {PLATFORM_META[plat]?.label ?? plat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {loadingPosts ? (
          <p className="profile-socials-muted">{t('Loading your social posts...', 'Memuat postingan media sosial Anda...')}</p>
        ) : visiblePosts.length === 0 ? (
          <div className="profile-socials-empty">
            <LinkSimple size={28} />
            <strong>{t('No social posts yet', 'Belum ada postingan media sosial')}</strong>
            <p>
              {t(
                'Open any of your Market listings and click Share -> Auto-Publish to post directly to your connected accounts.',
                'Buka salah satu listing Market Anda lalu klik Bagikan -> Auto-Publish untuk memposting langsung ke akun terhubung.'
              )}
            </p>
          </div>
        ) : (
          <div className="profile-socials-posts-list">
            {visiblePosts.map((post) => {
              const platKey = post.platform.split(',')[0]?.trim().toLowerCase() ?? post.platform.toLowerCase();
              const dateText = formatDateLabel(
                post.status === 'SCHEDULED' ? post.scheduledAt : post.publishedAt || post.createdAt,
                language
              );
              return (
                <article key={post.id} className="profile-social-post-card">
                  <div className="profile-social-post-thumb">
                    {post.mediaUrl ? (
                      <img src={post.mediaUrl} alt={post.listingTitle || 'Social post preview'} loading="lazy" />
                    ) : (
                      <div className={`profile-social-post-thumb-fallback is-${platKey}`}>
                        <PlatformIcon platform={platKey} size={24} />
                      </div>
                    )}
                  </div>

                  <div className="profile-social-post-body">
                    <div className="profile-social-post-top">
                      <span className={`profile-social-badge is-${platKey}`}>
                        <PlatformIcon platform={platKey} size={13} />
                        <span>{PLATFORM_META[platKey]?.label ?? post.platform}</span>
                      </span>
                      {post.username && (
                        <span className="profile-social-post-handle">@{post.username.replace(/^@/, '')}</span>
                      )}
                      <span className={`profile-social-post-status is-${post.status.toLowerCase()}`}>
                        {post.status === 'SCHEDULED' ? <Clock size={12} /> : <CheckCircle size={12} weight="fill" />}
                        <span>{post.status === 'SCHEDULED' ? t('Scheduled', 'Terjadwal') : t('Published', 'Terbit')}</span>
                      </span>
                      {dateText && (
                        <span className="profile-social-post-date">
                          <Calendar size={12} />
                          {dateText}
                        </span>
                      )}
                    </div>

                    {post.listingHref && (
                      <Link href={post.listingHref} className="profile-social-linked-listing">
                        <span className={post.listingType === 'WTB' ? 'is-wtb' : 'is-wts'}>
                          {post.listingType === 'WTB' ? 'WTB' : 'WTS'}
                        </span>
                        <strong>{post.listingTitle || t('Market Listing', 'Listing Market')}</strong>
                        {typeof post.listingAmount === 'number' && post.listingCurrency && (
                          <b>{formatMoney(post.listingAmount, post.listingCurrency)}</b>
                        )}
                        {post.listingStatus && post.listingStatus !== 'ACTIVE' && (
                          <small>{post.listingStatus}</small>
                        )}
                      </Link>
                    )}

                    {post.caption && (
                      <p className="profile-social-post-caption">{post.caption}</p>
                    )}

                    <div className="profile-social-post-actions">
                      {post.permalink && (
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="profile-social-action-link"
                        >
                          <ArrowSquareOut size={14} />
                          {t('View Post', 'Lihat Postingan')}
                        </a>
                      )}
                      {post.listingHref && (
                        <Link href={post.listingHref} className="profile-social-action-link">
                          <LinkSimple size={14} />
                          {t('Open Listing', 'Buka Listing')}
                        </Link>
                      )}
                      <button
                        type="button"
                        className="profile-social-action-remove"
                        disabled={removingPostId === post.id}
                        onClick={() => void handleRemovePost(post.id)}
                      >
                        <Trash size={14} />
                        {removingPostId === post.id
                          ? t('Removing...', 'Menghapus...')
                          : post.canRemoteDelete
                            ? t('Delete Post', 'Hapus Postingan')
                            : t('Unlink', 'Lepas Tautan')}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
