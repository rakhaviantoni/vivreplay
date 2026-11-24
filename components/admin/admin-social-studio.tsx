'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarBlankIcon as CalendarBlank,
  CheckIcon as Check,
  ClockIcon as Clock,
  CopyIcon as Copy,
  DownloadSimpleIcon as DownloadSimple,
  FacebookLogoIcon as FacebookLogo,
  GlobeIcon as Globe,
  ImageIcon,
  InstagramLogoIcon as InstagramLogo,
  MoonIcon as Moon,
  PaperPlaneTiltIcon as PaperPlaneTilt,
  PencilSimpleIcon as PencilSimple,
  PlusIcon as Plus,
  SparkleIcon as Sparkle,
  SunIcon as Sun,
  ThreadsLogoIcon as ThreadsLogo,
  TiktokLogoIcon as TiktokLogo,
  TrashIcon as Trash,
  UploadSimpleIcon as UploadSimple,
  WhatsappLogoIcon as WhatsappLogo,
  XLogoIcon as XLogo,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { renderBrandSocialCanvas } from '@/lib/social-brand-canvas';
import {
  SOCIAL_ASSET_DIMENSIONS,
  SOCIAL_BIOS_AND_DESCRIPTIONS,
  SOCIAL_CAMPAIGN_PRESETS,
  type SocialAssetConfig,
  type SocialAssetFormat,
  type SocialAssetLocale,
  type SocialAssetTheme,
  type SocialCampaignPreset,
  type SocialPlatformKey,
} from '@/lib/social-brand-kit';
import type { AdminSocialPostRecord } from '@/lib/server/admin-social';

type ConnectedAccount = {
  id: string;
  platform: string;
  username: string;
  displayName?: string | null;
};

function SocialPlatformIcon({ platform, size = 15 }: { platform: SocialPlatformKey | string; size?: number }) {
  const key = platform.toLowerCase();
  if (key === 'instagram') return <InstagramLogo size={size} weight="fill" />;
  if (key === 'facebook') return <FacebookLogo size={size} weight="fill" />;
  if (key === 'threads') return <ThreadsLogo size={size} weight="fill" />;
  if (key === 'tiktok') return <TiktokLogo size={size} weight="fill" />;
  if (key === 'whatsapp') return <WhatsappLogo size={size} weight="fill" />;
  return <XLogo size={size} weight="fill" />;
}

function defaultDateInput(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function AdminSocialStudio() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const firstPreset = SOCIAL_CAMPAIGN_PRESETS[0];

  const [assetLocale, setAssetLocale] = useState<SocialAssetLocale>('EN');
  const [assetFormat, setAssetFormat] = useState<SocialAssetFormat>(firstPreset.defaultFormat);
  const [assetTheme, setAssetTheme] = useState<SocialAssetTheme>('dark');
  const [assetTemplate, setAssetTemplate] = useState(firstPreset.template);
  const [eyebrow, setEyebrow] = useState(firstPreset.assetEN.eyebrow);
  const [headline, setHeadline] = useState(firstPreset.assetEN.headline);
  const [subheadline, setSubheadline] = useState(firstPreset.assetEN.subheadline);
  const [chipsText, setChipsText] = useState(firstPreset.assetEN.chips.join(', '));
  const [ctaUrl, setCtaUrl] = useState(firstPreset.assetEN.ctaUrl);
  const [showMarketBadge, setShowMarketBadge] = useState(firstPreset.assetEN.showMarketBadge);

  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [postTitle, setPostTitle] = useState(firstPreset.titleEN);
  const [postPillar, setPostPillar] = useState(firstPreset.pillar);
  const [caption, setCaption] = useState(firstPreset.captionEN);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState(defaultDateInput);
  const [scheduleTime, setScheduleTime] = useState(firstPreset.recommendedTime);

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [posts, setPosts] = useState<AdminSocialPostRecord[]>([]);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [savingMode, setSavingMode] = useState<'draft' | 'schedule' | 'publish' | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bioLocale, setBioLocale] = useState<'EN' | 'ID'>('EN');

  const assetConfig: SocialAssetConfig = {
    template: assetTemplate,
    format: assetFormat,
    theme: assetTheme,
    locale: assetLocale,
    eyebrow,
    headline,
    subheadline,
    chips: chipsText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 4),
    ctaUrl,
    showMarketBadge,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void renderBrandSocialCanvas(canvas, assetConfig);
  });

  const loadData = useCallback(async () => {
    const [accRes, postsRes] = await Promise.all([
      fetch('/api/market/social/accounts', { cache: 'no-store' }),
      fetch('/api/admin/social-posts', { cache: 'no-store' }),
    ]);
    if (accRes.ok) {
      const data = (await accRes.json()) as { accounts?: ConnectedAccount[] };
      const list = data.accounts ?? [];
      setAccounts(list);
      setSelectedAccountIds((prev) => (prev.length ? prev : list.map((a) => a.id)));
    }
    if (postsRes.ok) {
      const data = (await postsRes.json()) as { posts?: AdminSocialPostRecord[] };
      setPosts(data.posts ?? []);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const applyPreset = (preset: SocialCampaignPreset, nextLocale: SocialAssetLocale = assetLocale) => {
    const asset = nextLocale === 'ID' ? preset.assetID : preset.assetEN;
    setEditingId(undefined);
    setAssetLocale(nextLocale);
    setAssetTemplate(preset.template);
    setAssetFormat(preset.defaultFormat);
    setEyebrow(asset.eyebrow);
    setHeadline(asset.headline);
    setSubheadline(asset.subheadline);
    setChipsText(asset.chips.join(', '));
    setCtaUrl(asset.ctaUrl);
    setShowMarketBadge(asset.showMarketBadge);
    setPostTitle(nextLocale === 'ID' ? preset.titleID : preset.titleEN);
    setPostPillar(preset.pillar);
    setCaption(nextLocale === 'ID' ? preset.captionID : preset.captionEN);
    setScheduleTime(preset.recommendedTime);
    toast.success(`Loaded "${nextLocale === 'ID' ? preset.titleID : preset.titleEN}"`);
  };

  const handleDownloadAsset = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `vivreplay-${assetTemplate}-${assetFormat}-${assetTheme}-${assetLocale.toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleAttachRenderedAsset = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setUploadingAsset(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not export PNG from canvas.');
      const form = new FormData();
      form.append(
        'file',
        new File([blob], `vivreplay-${assetTemplate}-${assetFormat}.png`, { type: 'image/png' }),
      );
      const res = await fetch('/api/market/social/media', { method: 'POST', body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
      setMediaUrls((prev) => [...prev, data.url!]);
      toast.success('Graphic uploaded and attached');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to attach graphic');
    } finally {
      setUploadingAsset(false);
    }
  };

  const handleConnectPlatform = async (platform: 'instagram' | 'facebook' | 'threads' | 'twitter') => {
    try {
      const res = await fetch(`/api/market/social/auth-url?platform=${platform}`);
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start connection');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handleSubmitPost = async (mode: 'draft' | 'schedule' | 'publish') => {
    if (!caption.trim()) {
      toast.error('Caption is required.');
      return;
    }
    setSavingMode(mode);
    try {
      const scheduledAt =
        mode === 'schedule' ? new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString() : null;
      const selectedPlatforms = accounts
        .filter((a) => selectedAccountIds.includes(a.id))
        .map((a) => a.platform);

      const res = await fetch('/api/admin/social-posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          title: postTitle,
          pillar: postPillar,
          locale: assetLocale,
          platforms: selectedPlatforms,
          accountIds: selectedAccountIds,
          caption,
          mediaUrls,
          assetConfig,
          mode,
          scheduledAt,
        }),
      });
      const data = (await res.json()) as { post?: AdminSocialPostRecord; error?: string };
      if (!res.ok || !data.post) throw new Error(data.error || 'Failed to save post');
      if (data.post.status === 'FAILED') {
        toast.error(data.post.errorMessage || 'Publish failed');
      } else {
        toast.success(
          mode === 'publish'
            ? 'Published to selected accounts'
            : mode === 'schedule'
              ? 'Post scheduled'
              : 'Draft saved',
        );
      }
      setEditingId(undefined);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSavingMode(null);
    }
  };

  const handleDeletePost = async (id: string) => {
    const res = await fetch(`/api/admin/social-posts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      toast.success('Post removed');
    }
  };

  const handleCopy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1800);
  };

  return (
    <div className="admin-social-studio">
      <div className="admin-social-split">
        {/* Left: Brand Asset Studio */}
        <section className="admin-social-panel">
          <header className="admin-social-panel-head">
            <div>
              <h2>Brand Asset Studio</h2>
              <p>Rendered with VivrePlay&apos;s compass mark, palette, card showcase, and game logos.</p>
            </div>
            <div className="admin-social-toggle-group">
              {(['EN', 'ID'] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    setAssetLocale(loc);
                    const match = SOCIAL_CAMPAIGN_PRESETS.find((p) => p.template === assetTemplate);
                    if (match) applyPreset(match, loc);
                  }}
                  className={`admin-social-chip${assetLocale === loc ? ' is-active' : ''}`}
                >
                  <Globe size={13} />
                  <span>{loc}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAssetTheme('dark')}
                className={`admin-social-chip${assetTheme === 'dark' ? ' is-active' : ''}`}
              >
                <Moon size={13} weight="fill" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setAssetTheme('light')}
                className={`admin-social-chip${assetTheme === 'light' ? ' is-active' : ''}`}
              >
                <Sun size={13} weight="fill" />
                <span>Light</span>
              </button>
            </div>
          </header>

          <div className="admin-social-format-grid">
            {(Object.keys(SOCIAL_ASSET_DIMENSIONS) as SocialAssetFormat[]).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setAssetFormat(fmt)}
                className={`admin-social-format-btn${assetFormat === fmt ? ' is-active' : ''}`}
              >
                <strong>{fmt}</strong>
                <span>
                  {SOCIAL_ASSET_DIMENSIONS[fmt].width}×{SOCIAL_ASSET_DIMENSIONS[fmt].height}
                </span>
              </button>
            ))}
          </div>

          <div className="admin-social-canvas-stage">
            <canvas ref={canvasRef} />
          </div>

          <div className="admin-social-form-grid">
            <label className="admin-social-field">
              <span>Eyebrow</span>
              <input value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} />
            </label>
            <label className="admin-social-field">
              <span>Footer URL</span>
              <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
            </label>
            <label className="admin-social-field is-full">
              <span>Headline</span>
              <input value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </label>
            <label className="admin-social-field is-full">
              <span>Subheadline</span>
              <input value={subheadline} onChange={(e) => setSubheadline(e.target.value)} />
            </label>
            <label className="admin-social-field is-full">
              <span>Feature Chips (comma-separated, max 4)</span>
              <input value={chipsText} onChange={(e) => setChipsText(e.target.value)} />
            </label>
          </div>

          <div className="admin-social-actions">
            <label className="admin-social-check">
              <input
                type="checkbox"
                checked={showMarketBadge}
                onChange={(e) => setShowMarketBadge(e.target.checked)}
              />
              <span>Show &quot;| Market&quot; lockup</span>
            </label>
            <div className="admin-social-btn-row">
              <button type="button" className="button secondary" onClick={handleDownloadAsset}>
                <DownloadSimple size={15} />
                <span>Download PNG</span>
              </button>
              <button
                type="button"
                className="button"
                disabled={uploadingAsset}
                onClick={handleAttachRenderedAsset}
              >
                <UploadSimple size={15} />
                <span>{uploadingAsset ? 'Uploading...' : 'Attach to Post'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right: Post Composer & Scheduler */}
        <section className="admin-social-panel">
          <header className="admin-social-panel-head">
            <div>
              <h2>Official Post Composer & Scheduler</h2>
              <p>Publish now or schedule posts to VivrePlay&apos;s connected social channels.</p>
            </div>
            {editingId && <span className="admin-social-status is-scheduled">Editing post</span>}
          </header>

          <div className="admin-social-accounts-box">
            <div className="admin-social-accounts-head">
              <span>Connected Accounts</span>
              <div className="admin-social-btn-row">
                {(['instagram', 'facebook', 'threads', 'twitter'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleConnectPlatform(p)}
                    className="admin-copy-chip"
                  >
                    <Plus size={12} />
                    <SocialPlatformIcon platform={p} size={13} />
                    <span>{p === 'twitter' ? 'X' : p.charAt(0).toUpperCase() + p.slice(1)}</span>
                  </button>
                ))}
              </div>
            </div>
            {accounts.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                No official accounts connected yet. Connect a channel above to publish directly.
              </p>
            ) : (
              <div className="admin-social-toggle-group">
                {accounts.map((acc) => {
                  const selected = selectedAccountIds.includes(acc.id);
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() =>
                        setSelectedAccountIds((prev) =>
                          prev.includes(acc.id) ? prev.filter((id) => id !== acc.id) : [...prev, acc.id],
                        )
                      }
                      className={`admin-social-chip${selected ? ' is-active' : ''}`}
                    >
                      <SocialPlatformIcon platform={acc.platform} size={14} />
                      <span>@{acc.username}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="admin-social-form-grid">
            <label className="admin-social-field">
              <span>Campaign Title</span>
              <input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} />
            </label>
            <label className="admin-social-field">
              <span>Content Pillar</span>
              <input value={postPillar} onChange={(e) => setPostPillar(e.target.value)} />
            </label>
            <label className="admin-social-field is-full">
              <span>
                <span>Caption ({assetLocale})</span>
                <small>{caption.length} chars</small>
              </span>
              <textarea rows={7} value={caption} onChange={(e) => setCaption(e.target.value)} />
            </label>
          </div>

          <div className="admin-social-field">
            <span>Attached Media ({mediaUrls.length})</span>
            {mediaUrls.length === 0 ? (
              <div className="admin-social-media-empty">
                <ImageIcon size={16} />
                <span>Click &quot;Attach to Post&quot; in the Brand Asset Studio to attach the rendered PNG.</span>
              </div>
            ) : (
              <div className="admin-social-media-strip">
                {mediaUrls.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="admin-social-media-thumb">
                    <img src={url} alt="Attached social graphic" />
                    <button
                      type="button"
                      onClick={() => setMediaUrls((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove media"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-social-form-grid">
            <label className="admin-social-field">
              <span>Schedule Date</span>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </label>
            <label className="admin-social-field">
              <span>Schedule Time (WIB)</span>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </label>
          </div>

          <div className="admin-social-toggle-group">
            {(['09:00', '12:15', '19:00', '20:30'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setScheduleTime(t)}
                className={`admin-social-chip${scheduleTime === t ? ' is-active' : ''}`}
              >
                <Clock size={12} />
                <span>{t} WIB</span>
              </button>
            ))}
          </div>

          <div className="admin-social-btn-row">
            <button
              type="button"
              className="button secondary"
              disabled={savingMode !== null}
              onClick={() => handleSubmitPost('draft')}
            >
              <PencilSimple size={15} />
              <span>{savingMode === 'draft' ? 'Saving...' : 'Save Draft'}</span>
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={savingMode !== null}
              onClick={() => handleSubmitPost('schedule')}
            >
              <CalendarBlank size={15} />
              <span>{savingMode === 'schedule' ? 'Scheduling...' : 'Schedule Post'}</span>
            </button>
            <button
              type="button"
              className="button"
              disabled={savingMode !== null || selectedAccountIds.length === 0}
              onClick={() => handleSubmitPost('publish')}
            >
              <PaperPlaneTilt size={15} />
              <span>{savingMode === 'publish' ? 'Publishing...' : 'Publish Now'}</span>
            </button>
          </div>
        </section>
      </div>

      {/* Weekly Strategy Presets */}
      <section className="admin-social-panel">
        <header className="admin-social-panel-head">
          <div>
            <h2>Weekly Content Strategy & Ready Campaigns ({assetLocale})</h2>
            <p>Load any campaign into the Studio to render its matching graphic and schedule it.</p>
          </div>
        </header>
        <div className="admin-social-presets-grid">
          {SOCIAL_CAMPAIGN_PRESETS.map((preset) => {
            const title = assetLocale === 'ID' ? preset.titleID : preset.titleEN;
            const text = assetLocale === 'ID' ? preset.captionID : preset.captionEN;
            return (
              <article key={preset.id} className="admin-social-preset-card">
                <div className="admin-social-preset-top">
                  <span className="admin-social-status">{preset.dayLabel}</span>
                  <div className="admin-social-platform-row">
                    {preset.platforms.map((p) => (
                      <SocialPlatformIcon key={p} platform={p} size={14} />
                    ))}
                    <span style={{ fontSize: 11 }}>{preset.recommendedTime} WIB</span>
                  </div>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <div className="admin-social-btn-row">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => handleCopy(preset.id, text)}
                  >
                    {copiedId === preset.id ? <Check size={14} /> : <Copy size={14} />}
                    <span>Copy</span>
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => applyPreset(preset, assetLocale)}
                  >
                    <Sparkle size={14} />
                    <span>Load into Studio</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Scheduled & Published Queue */}
      <section className="admin-social-panel">
        <header className="admin-social-panel-head">
          <div>
            <h2>Scheduled & Published Queue ({posts.length})</h2>
            <p>Manage queued, draft, and published posts for VivrePlay.</p>
          </div>
        </header>
        {posts.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
            No scheduled or saved posts yet. Load a campaign above and click Schedule Post or Save Draft.
          </p>
        ) : (
          <div className="admin-social-queue">
            {posts.map((post) => (
              <div key={post.id} className="admin-social-queue-row">
                <div className="admin-social-queue-meta">
                  <div className="admin-social-queue-head">
                    <span className={`admin-social-status is-${post.status.toLowerCase()}`}>
                      {post.status}
                    </span>
                    <strong>{post.title}</strong>
                    <span>
                      {post.pillar} ({post.locale})
                    </span>
                    {post.scheduledAt && (
                      <span>{new Date(post.scheduledAt).toLocaleString()}</span>
                    )}
                  </div>
                  <p className="admin-social-queue-caption">{post.caption}</p>
                  {post.errorMessage && (
                    <p style={{ margin: 0, fontSize: 12, color: '#c93d3d' }}>{post.errorMessage}</p>
                  )}
                </div>
                <div className="admin-social-btn-row">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setEditingId(post.id);
                      setPostTitle(post.title);
                      setPostPillar(post.pillar);
                      setAssetLocale(post.locale);
                      setCaption(post.caption);
                      setMediaUrls(post.mediaUrls);
                      if (post.scheduledAt) {
                        const dt = new Date(post.scheduledAt);
                        setScheduleDate(dt.toISOString().slice(0, 10));
                        setScheduleTime(dt.toISOString().slice(11, 16));
                      }
                      toast.success('Loaded into composer');
                    }}
                  >
                    <PencilSimple size={14} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => handleDeletePost(post.id)}
                    aria-label="Delete post"
                  >
                    <Trash size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Official Bios & WhatsApp Copy Kit */}
      <section className="admin-social-panel">
        <header className="admin-social-panel-head">
          <div>
            <h2>Official Bios, WhatsApp & Profile Descriptions</h2>
            <p>Collector-focused copy for Instagram, Threads, X, TikTok, WhatsApp Business, and Community groups.</p>
          </div>
          <div className="admin-social-toggle-group">
            {(['EN', 'ID'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setBioLocale(loc)}
                className={`admin-social-chip${bioLocale === loc ? ' is-active' : ''}`}
              >
                <Globe size={13} />
                <span>{loc}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="admin-social-bios-grid">
          {SOCIAL_BIOS_AND_DESCRIPTIONS.map((item) => {
            const text = bioLocale === 'ID' ? item.textID : item.textEN;
            return (
              <div key={item.id} className="admin-social-bio-card">
                <div className="admin-social-bio-head">
                  <div className="admin-social-bio-title">
                    <SocialPlatformIcon platform={item.platform} size={18} />
                    <div>
                      <strong>{item.channel}</strong>
                      <small>{item.limitNote}</small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button secondary"
                    style={{ minHeight: 32, padding: '0 10px', fontSize: 12 }}
                    onClick={() => handleCopy(`bio-${item.id}-${bioLocale}`, text)}
                  >
                    {copiedId === `bio-${item.id}-${bioLocale}` ? <Check size={13} /> : <Copy size={13} />}
                    <span>Copy</span>
                  </button>
                </div>
                <pre>{text}</pre>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
