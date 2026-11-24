'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarBlankIcon as CalendarBlank,
  CheckIcon as Check,
  CopyIcon as Copy,
  DownloadSimpleIcon as DownloadSimple,
  FacebookLogoIcon as FacebookLogo,
  ImageIcon,
  InstagramLogoIcon as InstagramLogo,
  PaperPlaneTiltIcon as PaperPlaneTilt,
  PlusIcon as Plus,
  SparkleIcon as Sparkle,
  ThreadsLogoIcon as ThreadsLogo,
  TrashIcon as Trash,
  UploadSimpleIcon as UploadSimple,
  XLogoIcon as XLogo,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from '@/lib/social-brand-kit';
import type { AdminSocialPostRecord } from '@/lib/server/admin-social';

type ConnectedAccount = {
  id: string;
  platform: string;
  username: string;
  displayName?: string | null;
};

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
      toast.success('Brand graphic uploaded & attached to post');
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
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start social connection');
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
            ? 'Published to selected social accounts'
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
    <div className="space-y-6">
      {/* 1. Brand Asset Studio + Post Composer */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Live Brand Canvas */}
        <section className="lg:col-span-6 rounded-xl border border-border/70 bg-card p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Brand Asset Studio</h2>
              <p className="text-xs text-muted-foreground">
                Rendered with VivrePlay&apos;s exact compass mark, palette, and typography.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {(['EN', 'ID'] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    setAssetLocale(loc);
                    const match = SOCIAL_CAMPAIGN_PRESETS.find((p) => p.template === assetTemplate);
                    if (match) applyPreset(match, loc);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                    assetLocale === loc
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {loc}
                </button>
              ))}
              {(['dark', 'light'] as const).map((th) => (
                <button
                  key={th}
                  type="button"
                  onClick={() => setAssetTheme(th)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border capitalize ${
                    assetTheme === th
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {th}
                </button>
              ))}
            </div>
          </div>

          {/* Format selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(SOCIAL_ASSET_DIMENSIONS) as SocialAssetFormat[]).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setAssetFormat(fmt)}
                className={`px-2.5 py-1.5 rounded-lg border text-left text-xs ${
                  assetFormat === fmt
                    ? 'border-primary bg-primary/10 font-semibold'
                    : 'border-border/70 text-muted-foreground'
                }`}
              >
                <div className="capitalize">{fmt}</div>
                <div className="text-[11px] opacity-75">
                  {SOCIAL_ASSET_DIMENSIONS[fmt].width}×{SOCIAL_ASSET_DIMENSIONS[fmt].height}
                </div>
              </button>
            ))}
          </div>

          {/* Live Canvas Preview */}
          <div className="rounded-xl border border-border/70 bg-black/40 p-3 flex items-center justify-center overflow-hidden">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[380px] w-auto h-auto rounded-lg shadow-lg"
            />
          </div>

          {/* Editable Brand Copy */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Eyebrow</span>
              <input
                value={eyebrow}
                onChange={(e) => setEyebrow(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Footer URL</span>
              <input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs space-y-1 sm:col-span-2">
              <span className="text-muted-foreground">Headline</span>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs space-y-1 sm:col-span-2">
              <span className="text-muted-foreground">Subheadline</span>
              <input
                value={subheadline}
                onChange={(e) => setSubheadline(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs space-y-1 sm:col-span-2">
              <span className="text-muted-foreground">Feature Chips (comma-separated, up to 4)</span>
              <input
                value={chipsText}
                onChange={(e) => setChipsText(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showMarketBadge}
                onChange={(e) => setShowMarketBadge(e.target.checked)}
              />
              Show &quot;| Market&quot; lockup
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleDownloadAsset}>
                <DownloadSimple size={15} className="mr-1.5" />
                Download PNG
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={uploadingAsset}
                onClick={handleAttachRenderedAsset}
              >
                <UploadSimple size={15} className="mr-1.5" />
                {uploadingAsset ? 'Uploading…' : 'Attach to Post'}
              </Button>
            </div>
          </div>
        </section>

        {/* Right: Official Post Composer & Scheduler */}
        <section className="lg:col-span-6 rounded-xl border border-border/70 bg-card p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Official Post Composer & Scheduler</h2>
              <p className="text-xs text-muted-foreground">
                Publish immediately or schedule posts to VivrePlay&apos;s connected social channels.
              </p>
            </div>
            {editingId && (
              <Badge variant="outline" className="text-xs">
                Editing saved post
              </Badge>
            )}
          </div>

          {/* Connected Accounts */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Connected Accounts</span>
              <div className="flex flex-wrap gap-1.5">
                {(['instagram', 'facebook', 'threads', 'twitter'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleConnectPlatform(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-accent"
                  >
                    <Plus size={11} />
                    {p === 'twitter' ? 'X' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {accounts.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border p-2.5">
                No official accounts connected yet. Connect Instagram, Facebook, Threads, or X above to enable direct publishing.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
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
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                        selected
                          ? 'border-primary bg-primary/15 font-semibold'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {acc.platform === 'instagram' ? (
                        <InstagramLogo size={14} />
                      ) : acc.platform === 'facebook' ? (
                        <FacebookLogo size={14} />
                      ) : acc.platform === 'threads' ? (
                        <ThreadsLogo size={14} />
                      ) : (
                        <XLogo size={14} />
                      )}
                      <span>@{acc.username}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Campaign Title</span>
              <input
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Content Pillar</span>
              <input
                value={postPillar}
                onChange={(e) => setPostPillar(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </label>
          </div>

          <label className="block text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Caption ({assetLocale})</span>
              <span className="text-[11px] text-muted-foreground">{caption.length} chars</span>
            </div>
            <textarea
              rows={7}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full rounded-md border border-border bg-background p-2.5 text-xs leading-relaxed"
            />
          </label>

          {/* Attached Media */}
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Attached Media ({mediaUrls.length})</span>
            {mediaUrls.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-md border border-dashed border-border p-2.5">
                <ImageIcon size={15} />
                <span>Click &quot;Attach to Post&quot; in the Brand Asset Studio to attach the rendered graphic.</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {mediaUrls.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative group rounded-lg border border-border overflow-hidden w-20 h-20">
                    <img src={url} alt="Attached social asset" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setMediaUrls((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 rounded-full bg-black/75 text-white p-1 text-[10px]"
                      aria-label="Remove media"
                    >
                      <Trash size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Schedule Date & Time */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Schedule Date</span>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Schedule Time (WIB)</span>
              <div className="flex gap-1.5">
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                />
                {(['09:00', '12:15', '19:00', '20:30'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setScheduleTime(t)}
                    className={`px-2 py-1 rounded border text-[11px] ${
                      scheduleTime === t ? 'border-primary bg-primary/10 font-semibold' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingMode !== null}
              onClick={() => handleSubmitPost('draft')}
            >
              {savingMode === 'draft' ? 'Saving…' : 'Save Draft'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={savingMode !== null}
              onClick={() => handleSubmitPost('schedule')}
            >
              <CalendarBlank size={15} className="mr-1.5" />
              {savingMode === 'schedule' ? 'Scheduling…' : 'Schedule Post'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingMode !== null || selectedAccountIds.length === 0}
              onClick={() => handleSubmitPost('publish')}
            >
              <PaperPlaneTilt size={15} className="mr-1.5" />
              {savingMode === 'publish' ? 'Publishing…' : 'Publish Now'}
            </Button>
          </div>
        </section>
      </div>

      {/* 2. Weekly Strategy Presets */}
      <section className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
        <div>
          <h2 className="text-base font-bold">Weekly Content Strategy & Ready Campaigns ({assetLocale})</h2>
          <p className="text-xs text-muted-foreground">
            Load any campaign into the Studio to render its matching graphic, edit copy, and schedule it.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SOCIAL_CAMPAIGN_PRESETS.map((preset) => {
            const title = assetLocale === 'ID' ? preset.titleID : preset.titleEN;
            const text = assetLocale === 'ID' ? preset.captionID : preset.captionEN;
            return (
              <article
                key={preset.id}
                className="rounded-lg border border-border/70 bg-background/50 p-3 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <Badge variant="outline">{preset.dayLabel}</Badge>
                    <span className="text-muted-foreground">{preset.recommendedTime} WIB</span>
                  </div>
                  <h3 className="text-sm font-bold">{title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-line">{text}</p>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(preset.id, text)}
                  >
                    {copiedId === preset.id ? <Check size={13} className="mr-1" /> : <Copy size={13} className="mr-1" />}
                    Copy
                  </Button>
                  <Button type="button" size="sm" onClick={() => applyPreset(preset, assetLocale)}>
                    <Sparkle size={13} className="mr-1" />
                    Load into Studio
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. Scheduled & Published Queue */}
      <section className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
        <h2 className="text-base font-bold">Scheduled & Published Queue ({posts.length})</h2>
        {posts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No scheduled or saved posts yet. Load a campaign above and click Schedule Post or Save Draft.
          </p>
        ) : (
          <div className="space-y-2">
            {posts.map((post) => (
              <div
                key={post.id}
                className="rounded-lg border border-border/70 bg-background/50 p-3 flex flex-wrap items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        post.status === 'PUBLISHED'
                          ? 'default'
                          : post.status === 'FAILED'
                            ? 'destructive'
                            : 'outline'
                      }
                    >
                      {post.status}
                    </Badge>
                    <strong className="text-sm">{post.title}</strong>
                    <span className="text-xs text-muted-foreground">
                      {post.pillar} · {post.locale}
                    </span>
                    {post.scheduledAt && (
                      <span className="text-xs text-muted-foreground">
                        Scheduled: {new Date(post.scheduledAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
                    {post.caption}
                  </p>
                  {post.errorMessage && (
                    <p className="text-xs text-destructive">{post.errorMessage}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
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
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeletePost(post.id)}
                  >
                    <Trash size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Official Bios & WhatsApp Copy Kit */}
      <section className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">Official Bios, WhatsApp & Profile Descriptions</h2>
            <p className="text-xs text-muted-foreground">
              Clean collector-focused copy for Instagram, Threads, X, TikTok, WhatsApp Business, and Community groups.
            </p>
          </div>
          <div className="flex gap-1.5">
            {(['EN', 'ID'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setBioLocale(loc)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                  bioLocale === loc
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {SOCIAL_BIOS_AND_DESCRIPTIONS.map((item) => {
            const text = bioLocale === 'ID' ? item.textID : item.textEN;
            return (
              <div key={item.id} className="rounded-lg border border-border/70 bg-background/50 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold">{item.channel}</h3>
                    <span className="text-[11px] text-muted-foreground">{item.limitNote}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(`bio-${item.id}-${bioLocale}`, text)}
                  >
                    {copiedId === `bio-${item.id}-${bioLocale}` ? (
                      <Check size={13} className="mr-1" />
                    ) : (
                      <Copy size={13} className="mr-1" />
                    )}
                    Copy
                  </Button>
                </div>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {text}
                </pre>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
