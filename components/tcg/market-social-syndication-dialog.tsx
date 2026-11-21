'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  ArrowsClockwiseIcon as ArrowsClockwise,
  BookmarkSimpleIcon as BookmarkSimple,
  CalendarBlankIcon as CalendarBlank,
  CardsIcon as Cards,
  CaretLeftIcon as CaretLeft,
  CaretRightIcon as CaretRight,
  CheckCircleIcon as CheckCircle,
  CheckIcon as Check,
  ClockIcon as Clock,
  CoffeeIcon as Coffee,
  EyeIcon as Eye,
  FacebookLogoIcon as FacebookLogo,
  FlameIcon as Flame,
  ImageIcon,
  InstagramLogoIcon as InstagramLogo,
  LightningIcon as Lightning,
  MoonIcon as Moon,
  PlusIcon as Plus,
  ShareNetworkIcon as ShareNetwork,
  SparkleIcon as Sparkle,
  StarIcon as Star,
  SunIcon as Sun,
  ThreadsLogoIcon as ThreadsLogo,
  TrashIcon as Trash,
  WarningCircleIcon as WarningCircle,
  XIcon as X,
  XLogoIcon as XLogo,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DEFAULT_CAPTION_TEMPLATES,
  renderCaptionTemplate,
  type CaptionVariables,
  type SavedCaptionTemplate,
} from '@/lib/social-captions';

export type SocialListingMedia = {
  url: string;
  label?: string;
  kind?: 'share-graphic' | 'seller-photo' | 'card-art' | 'custom';
};

type ConnectedAccount = {
  id: string;
  platform: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

function getPlatformIcon(platform: string, size = 15) {
  const p = platform.toLowerCase();
  if (p === 'instagram') return <InstagramLogo size={size} weight="fill" className="text-[#E1306C]" />;
  if (p === 'twitter' || p === 'x') return <XLogo size={size} weight="fill" />;
  if (p === 'facebook') return <FacebookLogo size={size} weight="fill" className="text-[#1877F2]" />;
  if (p === 'threads') return <ThreadsLogo size={size} weight="fill" />;
  return <ShareNetwork size={size} weight="fill" />;
}

const AI_STYLES = [
  {
    key: 'consign',
    labelEN: 'Consign Drop',
    labelID: 'Format Consign',
    icon: <Cards size={13} weight="bold" />,
  },
  {
    key: 'hype',
    labelEN: 'Grail Hype',
    labelID: 'Gaya Grail',
    icon: <Flame size={13} weight="fill" />,
  },
  {
    key: 'minimal',
    labelEN: 'Minimalist',
    labelID: 'Minimalis',
    icon: <Sparkle size={13} weight="bold" />,
  },
] as const;

const TIME_PRESETS = [
  { labelEN: 'Morning 09:00', labelID: 'Pagi 09.00', value: '09:00', icon: <Coffee size={13} /> },
  { labelEN: 'Lunch 12:15', labelID: 'Siang 12.15', value: '12:15', icon: <Sun size={13} /> },
  { labelEN: 'Evening 19:00', labelID: 'Sore 19.00', value: '19:00', icon: <Moon size={13} /> },
  { labelEN: 'Prime 20:30', labelID: 'Malam 20.30', value: '20:30', icon: <Lightning size={13} /> },
];

type Step = 'compose' | 'schedule' | 'preview';

export function MarketSocialSyndicationDialog({
  open,
  onOpenChange,
  listing,
  language = 'ID',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: {
    id: string;
    title: string;
    amount: number;
    currency?: string;
    condition?: string;
    seller?: string;
    city?: string;
    game?: string;
    photoUrls?: string[];
    availableMedias?: SocialListingMedia[];
  };
  language?: 'EN' | 'ID';
}) {
  const isId = language === 'ID';
  const t = (en: string, id: string) => (isId ? id : en);

  // Data
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [templates, setTemplates] = useState<SavedCaptionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('consign-drop');
  const [caption, setCaption] = useState('');

  // Medias
  const [medias, setMedias] = useState<SocialListingMedia[]>([]);
  const [selectedMediaUrls, setSelectedMediaUrls] = useState<string[]>([]);
  const [showAddUrlInput, setShowAddUrlInput] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  // Scheduling
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState('19:00');

  // Actions
  const [publishing, setPublishing] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [activeAiStyle, setActiveAiStyle] = useState<string | null>(null);

  // Template saving
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // Step
  const [step, setStep] = useState<Step>('compose');
  
  // Available platforms (fetched from server)
  const [availablePlatforms, setAvailablePlatforms] = useState<Record<string, boolean>>({
    instagram: true,
    facebook: false,
    threads: false,
  });

  useEffect(() => {
    setMounted(true);
    
    // Fetch available platforms
    void fetch('/api/market/social/available-platforms')
      .then((res) => res.json())
      .then((data: unknown) => {
        const platformsData = data as { platforms: Record<string, boolean> };
        setAvailablePlatforms(platformsData.platforms);
      })
      .catch(() => {
        setAvailablePlatforms({ instagram: true, facebook: false, threads: false });
      });
    
    // Listen for OAuth popup messages
    const handleMessage = (event: MessageEvent) => {
      // Security: verify message origin in production
      if (event.data?.type === 'vivreplay:social:connected') {
        const { platform, username } = event.data;
        console.log(`[Social] Connected ${platform}: @${username}`);
        
        // Show success toast
        toast.success(
          isId 
            ? `✅ Tersambung ke ${platform}: @${username}`
            : `✅ Connected to ${platform}: @${username}`
        );
        
        // Refresh accounts list
        setLoadingAccounts(true);
        void fetch('/api/market/social/accounts')
          .then((res) => res.json())
          .then((data: unknown) => {
            const accountsData = data as { accounts?: typeof accounts };
            const list = accountsData.accounts ?? [];
            setAccounts(list);
            // Auto-select the newly connected account
            const newAccount = list.find((acc) => acc.username === username);
            if (newAccount && !selectedAccountIds.includes(newAccount.id)) {
              setSelectedAccountIds([...selectedAccountIds, newAccount.id]);
            }
          })
          .finally(() => setLoadingAccounts(false));
      } else if (event.data?.type === 'vivreplay:social:error') {
        const { error } = event.data;
        console.error('[Social] OAuth error:', error);
        toast.error(
          isId 
            ? `❌ Gagal menyambungkan: ${error}`
            : `❌ Connection failed: ${error}`
        );
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const cardLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/market/${listing.id}`
      : `https://vivreplay.com/market/${listing.id}`;

  const formatPrice = (val: number, cur: string = 'IDR') =>
    new Intl.NumberFormat(isId ? 'id-ID' : 'en-US', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(val);

  const captionVars: CaptionVariables = {
    title: listing.title,
    price: formatPrice(listing.amount, listing.currency || 'IDR'),
    condition: listing.condition || 'Near Mint',
    seller: listing.seller || 'Seller',
    city: listing.city || 'Jakarta',
    link: cardLink,
    game: listing.game,
  };

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch('/api/market/social/accounts');
      const data = (await res.json()) as { accounts?: ConnectedAccount[] };
      const list = data.accounts ?? [];
      setAccounts(list);
      if (list.length > 0) {
        setSelectedAccountIds((prev) => (prev.length > 0 ? prev : [list[0].id]));
      }
    } catch {
      // ignore
    } finally {
      setLoadingAccounts(false);
    }
  };

  // Listen for OAuth completion message from popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'vivreplay:social:connected') {
        const platformName = event.data.platform === 'instagram' ? 'Instagram' : 'Social';
        const user = event.data.username ? `@${event.data.username}` : '';
        toast.success(
          t(
            `Connected ${platformName} ${user} successfully!`,
            `Akun ${platformName} ${user} berhasil terhubung!`
          )
        );
        void loadAccounts();
      } else if (event.data?.type === 'vivreplay:social:error') {
        toast.error(event.data.error || t('Failed to connect', 'Gagal menyambungkan'));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isId]);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : medias.length - 1));
      }
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev !== null && prev < medias.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, medias.length]);

  useEffect(() => {
    if (!open) return;
    setStep('compose');

    // Build initial media pool
    const pool: SocialListingMedia[] = [
      ...(listing.availableMedias ?? []),
      ...(!listing.availableMedias
        ? (listing.photoUrls ?? []).map((url, i) => ({
            url,
            label: isId ? `Foto ${i + 1}` : `Photo ${i + 1}`,
            kind: 'seller-photo' as const,
          }))
        : []),
    ];

    const seen = new Set<string>();
    const unique = pool.filter((m) => {
      if (!m.url || seen.has(m.url)) return false;
      seen.add(m.url);
      return true;
    });

    setMedias(unique);
    setSelectedMediaUrls(unique.length > 0 ? [unique[0].url] : []);
    setShowAddUrlInput(false);
    setCustomUrlInput('');

    void loadAccounts();

    void fetch('/api/market/social/templates')
      .then(async (res) => (await res.json()) as { templates?: SavedCaptionTemplate[] })
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => {});
  }, [open, isId, listing.availableMedias, listing.photoUrls]);

  useEffect(() => {
    const custom = templates.find((tmpl) => tmpl.id === selectedTemplateId);
    if (custom) {
      setCaption(renderCaptionTemplate(custom.body, captionVars));
      return;
    }
    const def = DEFAULT_CAPTION_TEMPLATES.find((tmpl) => tmpl.id === selectedTemplateId);
    if (def) setCaption(renderCaptionTemplate(def.body, captionVars));
  }, [selectedTemplateId, templates]);

  const connectAccount = async (platform: string) => {
    try {
      const res = await fetch('/api/market/social/auth-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, redirectUrl: window.location.href }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || 'Connection URL failed');
      
      const w = 640;
      const h = 740;
      const left = typeof window !== 'undefined' ? Math.max(0, (window.screen.width - w) / 2) : 100;
      const top = typeof window !== 'undefined' ? Math.max(0, (window.screen.height - h) / 2) : 100;
      window.open(
        data.url,
        'vivreplay_oauth',
        `width=${w},height=${h},top=${top},left=${left},status=no,resizable=yes`
      );
      toast.info(
        t(
          'Log into your Instagram/Meta account in the popup window.',
          'Masuk ke akun Instagram/Meta Anda di jendela popup.'
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to connect', 'Gagal menyambungkan'));
    }
  };

  const improveWithAi = async (style: 'consign' | 'hype' | 'minimal') => {
    setAiBusy(true);
    setActiveAiStyle(style);
    try {
      const res = await fetch('/api/market/social/ai-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, style, locale: language, cardDetails: captionVars }),
      });
      const data = (await res.json()) as { caption?: string; error?: string };
      if (!res.ok || !data.caption) throw new Error(data.error || 'AI improvement failed');
      setCaption(data.caption);
      toast.success(t('Caption enhanced with AI', 'Caption diperbarui dengan AI'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('AI improvement failed', 'Gagal mengoptimasi'));
    } finally {
      setAiBusy(false);
      setActiveAiStyle(null);
    }
  };

  const saveCustomTemplate = async () => {
    if (!templateName.trim() || !caption.trim()) {
      toast.error(t('Provide a template name', 'Beri nama template'));
      return;
    }
    setSavingTemplate(true);
    try {
      const res = await fetch('/api/market/social/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: templateName.trim(), body: caption, isDefault: false }),
      });
      const data = (await res.json()) as { templates?: SavedCaptionTemplate[]; error?: string };
      if (!res.ok || !data.templates) throw new Error(data.error || 'Failed to save');
      setTemplates(data.templates);
      setShowSaveTemplate(false);
      setTemplateName('');
      toast.success(t('Template saved successfully', 'Template berhasil disimpan'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save template', 'Gagal menyimpan template'));
    } finally {
      setSavingTemplate(false);
    }
  };

  const toggleMediaUrl = (url: string) => {
    setSelectedMediaUrls((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  const makeCover = (url: string) => {
    setSelectedMediaUrls((prev) => [url, ...prev.filter((u) => u !== url)]);
    toast.success(t('Set as cover image', 'Ditetapkan sebagai cover'));
  };

  const handleAddCustomUrl = () => {
    const val = customUrlInput.trim();
    if (!val) return;
    if (!val.startsWith('http://') && !val.startsWith('https://') && !val.startsWith('/')) {
      toast.error(t('Please provide a valid image URL', 'Masukkan URL gambar yang valid'));
      return;
    }
    const newMedia: SocialListingMedia = {
      url: val,
      label: t('Custom Media', 'Media Kustom'),
      kind: 'custom',
    };
    setMedias((prev) => [newMedia, ...prev]);
    setSelectedMediaUrls((prev) => [val, ...prev.filter((u) => u !== val)]);
    setCustomUrlInput('');
    setShowAddUrlInput(false);
    toast.success(t('Image added and set as cover', 'Gambar ditambahkan dan dijadikan cover'));
  };

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    );
  };

  const handlePublish = async () => {
    if (!caption.trim()) {
      toast.error(t('Caption cannot be empty', 'Caption tidak boleh kosong'));
      return;
    }
    setPublishing(true);
    let scheduledAt: string | null = null;
    if (scheduleMode === 'schedule' && scheduledDate) {
      const [h = '19', m = '00'] = scheduledTime.split(':');
      const d = new Date(scheduledDate);
      d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
      scheduledAt = d.toISOString();
    }
    try {
      const res = await fetch('/api/market/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          accountIds: selectedAccountIds,
          text: caption,
          mediaUrls: selectedMediaUrls,
          scheduledAt,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error || 'Publish failed');
      toast.success(
        scheduledAt
          ? t('Post scheduled successfully', 'Postingan berhasil dijadwalkan')
          : t('Published to social channels', 'Berhasil dipublikasikan ke media sosial')
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Publishing failed', 'Gagal mempublikasikan'));
    } finally {
      setPublishing(false);
    }
  };

  const scheduledDateLabel = scheduledDate
    ? scheduledDate.toLocaleDateString(isId ? 'id-ID' : 'en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : t('Pick a date', 'Pilih tanggal');

  const canPublish =
    caption.trim().length > 0 &&
    (scheduleMode === 'now' || (scheduleMode === 'schedule' && !!scheduledDate));

  const allTemplates = [
    ...DEFAULT_CAPTION_TEMPLATES.map((tmpl) => ({ id: tmpl.id, name: tmpl.name[language], custom: false })),
    ...templates.map((tmpl) => ({ id: tmpl.id, name: tmpl.name, custom: true })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="market-social-dialog">
        {/* ── Dialog Header ── */}
        <div className="market-social-header px-6 pt-5 pb-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base font-bold">
              <div className="size-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <ShareNetwork size={16} weight="bold" />
              </div>
              <span>{t('Publish Drop to Social Media', 'Terbitkan Drop ke Media Sosial')}</span>
              <Badge variant="secondary" className="text-[10px] px-2 py-0 font-semibold uppercase tracking-wider">
                {t('Auto-Drop', 'Auto-Drop')}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {t(
                'Syndicate and schedule your market listing to your connected seller accounts.',
                'Sindikasikan dan jadwalkan listing market Anda ke akun media sosial penjual yang terhubung.'
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Stepper Tabs */}
          <div className="flex gap-1.5 mt-4">
            {(['compose', 'schedule', 'preview'] as Step[]).map((s, i) => {
              const labels = {
                compose: t('Compose', 'Konten'),
                schedule: t('Schedule', 'Jadwal'),
                preview: t('Review', 'Tinjau'),
              };
              const isActive = step === s;
              return (
                <Button
                  key={s}
                  variant={isActive ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setStep(s)}
                  className={cn(
                    'market-social-step-btn button h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg transition-colors',
                    isActive ? 'is-active' : 'secondary'
                  )}
                >
                  <span
                    className={cn(
                      'market-social-step-num flex size-4 items-center justify-center rounded-full text-[10px] font-bold',
                      isActive && 'is-active'
                    )}
                  >
                    {i + 1}
                  </span>
                  <span>{labels[s]}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* ── Dialog Body ── */}
        <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: 'calc(90dvh - 200px)', minHeight: 320 }}>
          {/* ═══ COMPOSE STEP ═══ */}
          {step === 'compose' && (
            <div className="flex flex-col gap-6">
              {/* Target Accounts */}
              <section>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="market-social-section-title">
                    {t('Target Accounts', 'Akun Tujuan')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {availablePlatforms.instagram && (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => void connectAccount('instagram')}
                        className="market-social-connect-btn button secondary gap-1 text-xs h-7 px-2 font-semibold"
                        title={t('Connect Instagram Business account', 'Hubungkan akun Instagram Business')}
                        aria-label="Connect Instagram"
                      >
                        <Plus size={11} weight="bold" />
                        <InstagramLogo size={14} weight="fill" className="text-[#E1306C]" />
                      </Button>
                    )}
                    {availablePlatforms.facebook && (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => void connectAccount('facebook')}
                        className="market-social-connect-btn button secondary gap-1 text-xs h-7 px-2 font-semibold"
                        title={t('Connect Facebook Page', 'Hubungkan Halaman Facebook')}
                        aria-label="Connect Facebook"
                      >
                        <Plus size={11} weight="bold" />
                        <FacebookLogo size={14} weight="fill" className="text-[#1877F2]" />
                      </Button>
                    )}
                    {availablePlatforms.threads && (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => void connectAccount('threads')}
                        className="market-social-connect-btn button secondary gap-1 text-xs h-7 px-2 font-semibold"
                        title={t('Connect Threads profile', 'Hubungkan profil Threads')}
                        aria-label="Connect Threads"
                      >
                        <Plus size={11} weight="bold" />
                        <ThreadsLogo size={13} weight="fill" />
                      </Button>
                    )}
                    {availablePlatforms.twitter && (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => void connectAccount('twitter')}
                        className="market-social-connect-btn button secondary gap-1 text-xs h-7 px-2 font-semibold"
                        title={t('Connect Twitter/X account', 'Hubungkan akun Twitter/X')}
                        aria-label="Connect Twitter"
                      >
                        <Plus size={11} weight="bold" />
                        <XLogo size={13} weight="fill" />
                      </Button>
                    )}
                  </div>
                </div>

                {loadingAccounts ? (
                  <div className="flex gap-2">
                    {[1, 2].map((n) => (
                      <div key={n} className="h-9 w-32 animate-pulse rounded-xl bg-muted" />
                    ))}
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="market-social-panel p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold">
                        {t('No connected seller accounts', 'Belum ada akun terhubung')}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t(
                          'Connect your Instagram, Facebook, or Threads to syndicate drops automatically.',
                          'Sambungkan Instagram, Facebook, atau Threads untuk menerbitkan drop otomatis.'
                        )}
                      </p>
                    </div>
                    <WarningCircle size={22} className="text-muted-foreground shrink-0" />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {accounts.map((acc) => {
                      const active = selectedAccountIds.includes(acc.id);
                      return (
                        <Button
                          key={acc.id}
                          variant={active ? 'default' : 'secondary'}
                          size="sm"
                          onClick={() => toggleAccount(acc.id)}
                          className={cn(
                            'market-social-account-pill button h-8 gap-2 rounded-xl text-xs font-semibold',
                            active ? 'is-active' : 'secondary'
                          )}
                        >
                          {getPlatformIcon(acc.platform, 14)}
                          <span>@{acc.username}</span>
                          {active && <Check size={12} weight="bold" />}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Media Selection */}
              <section>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="market-social-section-title">
                      {t('Media & Artwork', 'Media & Artwork')}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                      {selectedMediaUrls.length} {t('selected', 'dipilih')}
                    </Badge>
                  </div>

                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => setShowAddUrlInput((v) => !v)}
                    className="market-social-btn-secondary button secondary gap-1.5 text-[11px] h-7 font-semibold"
                  >
                    <Plus size={11} weight="bold" />
                    <ImageIcon size={13} />
                    <span>{t('Add Image URL', 'Tambah URL Gambar')}</span>
                  </Button>
                </div>

                {showAddUrlInput && (
                  <div className="market-social-panel p-2.5 flex items-center gap-2 mb-3">
                    <ImageIcon size={14} className="text-muted-foreground shrink-0" />
                    <input
                      type="url"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      placeholder="https://... (JPG, PNG, WebP)"
                      className="market-social-input flex-1 px-3 py-1.5 text-xs outline-none"
                    />
                    <Button
                      variant="default"
                      size="xs"
                      disabled={!customUrlInput.trim()}
                      onClick={handleAddCustomUrl}
                      className="button h-7 px-3 text-xs font-bold"
                    >
                      {t('Add', 'Tambah')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        setShowAddUrlInput(false);
                        setCustomUrlInput('');
                      }}
                      className="button secondary h-7 text-xs font-medium"
                    >
                      {t('Cancel', 'Batal')}
                    </Button>
                  </div>
                )}

                {medias.length === 0 ? (
                  <div className="market-social-panel p-4 flex items-center gap-3">
                    <ImageIcon size={20} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">{t('No media attached', 'Belum ada media')}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t(
                          'Add an image URL above to enrich your drop post.',
                          'Tambahkan URL gambar di atas untuk melengkapi postingan drop.'
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                    {medias.map((item) => {
                      const selIndex = selectedMediaUrls.indexOf(item.url);
                      const isSelected = selIndex >= 0;
                      const isCover = selIndex === 0;
                      const mediaIndex = medias.findIndex((m) => m.url === item.url);

                      return (
                        <div
                          key={item.url}
                          onClick={() => toggleMediaUrl(item.url)}
                          onDoubleClick={() => setLightboxIndex(mediaIndex)}
                          className={cn(
                            'group relative aspect-[3/4] overflow-hidden rounded-xl border-2 cursor-pointer transition-all flex items-center justify-center p-1.5',
                            isSelected
                              ? 'border-primary ring-2 ring-primary/20 shadow-sm bg-muted/40'
                              : 'border-border/60 opacity-70 hover:opacity-100 hover:border-border bg-muted/20'
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.url}
                            alt={item.label ?? 'Media'}
                            className="h-full w-full object-contain drop-shadow-xs transition-transform duration-200 group-hover:scale-[1.02]"
                          />

                          {/* Selected order indicator */}
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 z-10">
                              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow">
                                {selIndex + 1}
                              </span>
                            </div>
                          )}

                          {/* Cover badge */}
                          {isCover && (
                            <div className="absolute top-1.5 left-1.5 z-10">
                              <Badge variant="secondary" className="gap-1 text-[9px] px-1.5 py-0 font-bold bg-background/90 backdrop-blur-xs shadow-xs">
                                <Star size={10} weight="fill" className="text-amber-500" />
                                {t('Cover', 'Cover')}
                              </Badge>
                            </div>
                          )}

                          {/* Lightbox / Zoom view button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxIndex(mediaIndex);
                            }}
                            title={t('View full size in lightbox', 'Lihat ukuran penuh di lightbox')}
                            aria-label={t('View full size in lightbox', 'Lihat ukuran penuh di lightbox')}
                            className="absolute bottom-1.5 right-1.5 z-10 size-6 rounded-md bg-background/90 text-foreground flex items-center justify-center shadow-xs border border-border/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                          >
                            <Eye size={12} weight="bold" />
                          </button>

                          {/* Action to set as cover if selected but not cover */}
                          {isSelected && !isCover && (
                            <div className="absolute inset-x-1.5 bottom-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 pr-7">
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  makeCover(item.url);
                                }}
                                className="market-social-cover-btn button secondary w-full text-[10px] gap-1 px-1 font-bold shadow-sm"
                              >
                                <Star size={11} weight="fill" className="text-amber-500" />
                                <span>{t('Set Cover', 'Set Cover')}</span>
                              </Button>
                            </div>
                          )}

                          {/* Kind tag if not cover */}
                          {!isCover && item.kind && (
                            <div className="absolute bottom-1.5 left-1.5 pointer-events-none z-10">
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-xs">
                                {item.kind === 'share-graphic'
                                  ? t('Graphic', 'Grafik')
                                  : item.kind === 'card-art'
                                  ? t('Art', 'Art')
                                  : item.kind === 'custom'
                                  ? t('URL', 'URL')
                                  : t('Photo', 'Foto')}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {t(
                    'Tap media to toggle inclusion. Tap eye icon or double-click to view in lightbox.',
                    'Ketuk media untuk memilih. Ketuk ikon mata atau klik ganda untuk melihat di lightbox.'
                  )}
                </p>
              </section>

              {/* Caption Template & Content */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <span className="market-social-section-title">
                    {t('Caption Template', 'Template Caption')}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {allTemplates.map((tmpl) => {
                    const isSelected = selectedTemplateId === tmpl.id;
                    return (
                      <Button
                        key={tmpl.id}
                        variant={isSelected ? 'default' : 'secondary'}
                        size="xs"
                        onClick={() => setSelectedTemplateId(tmpl.id)}
                        className={cn(
                          'market-social-template-btn button h-7 text-xs font-semibold gap-1 rounded-lg',
                          isSelected ? 'is-active' : 'secondary'
                        )}
                      >
                        {tmpl.custom && <Star size={11} weight="fill" className="text-amber-500 shrink-0" />}
                        <span>{tmpl.name}</span>
                      </Button>
                    );
                  })}
                </div>

                {/* AI Polish Tools */}
                <div className="market-social-panel p-2.5 flex flex-wrap items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 mr-1 text-xs font-bold text-muted-foreground">
                    <Sparkle size={14} weight="fill" className="text-amber-500 shrink-0" />
                    <span>{t('AI Polish', 'Optimalkan AI')}</span>
                  </div>
                  {AI_STYLES.map(({ key, labelEN, labelID, icon }) => (
                    <Button
                      key={key}
                      variant="secondary"
                      size="xs"
                      disabled={aiBusy}
                      onClick={() => void improveWithAi(key as 'consign' | 'hype' | 'minimal')}
                      className={cn(
                        'market-social-ai-btn button secondary h-7 text-xs font-semibold gap-1.5 rounded-lg',
                        activeAiStyle === key && aiBusy && 'is-active'
                      )}
                    >
                      {activeAiStyle === key && aiBusy ? (
                        <ArrowsClockwise size={12} className="animate-spin" />
                      ) : (
                        icon
                      )}
                      <span>{isId ? labelID : labelEN}</span>
                    </Button>
                  ))}
                </div>

                {/* Caption Textarea */}
                <div className="relative">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={8}
                    className="market-social-textarea w-full resize-none p-3.5 text-xs sm:text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder={t('Write your drop caption here…', 'Tulis caption drop di sini…')}
                  />
                  <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground tabular-nums bg-background/80 px-1.5 py-0.5 rounded-md">
                    {caption.length} {t('chars', 'karakter')}
                  </div>
                </div>

                {/* Save as Template */}
                <div className="mt-2 flex items-center justify-end">
                  {showSaveTemplate ? (
                    <div className="market-social-panel flex flex-1 items-center gap-2 p-2">
                      <BookmarkSimple size={14} className="shrink-0 text-muted-foreground ml-1" />
                      <input
                        type="text"
                        placeholder={t('Template name…', 'Nama template…')}
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="market-social-input flex-1 px-2.5 py-1 text-xs outline-none"
                      />
                      <Button
                        variant="default"
                        size="xs"
                        disabled={savingTemplate || !templateName.trim()}
                        onClick={() => void saveCustomTemplate()}
                        className="button h-7 px-3 text-xs font-bold"
                      >
                        {savingTemplate ? t('Saving…', 'Menyimpan…') : t('Save', 'Simpan')}
                      </Button>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => setShowSaveTemplate(false)}
                        className="button secondary h-7 text-xs"
                      >
                        <Trash size={13} />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => setShowSaveTemplate(true)}
                      className="market-social-btn-secondary button secondary h-7 gap-1.5 text-xs font-semibold"
                    >
                      <BookmarkSimple size={13} weight="bold" />
                      <span>{t('Save as template', 'Simpan sebagai template')}</span>
                    </Button>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ═══ SCHEDULE STEP ═══ */}
          {step === 'schedule' && (
            <div className="flex flex-col gap-6">
              {/* Publication Mode */}
              <section>
                <span className="market-social-section-title block mb-3">
                  {t('Publication Timing', 'Waktu Penerbitan')}
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setScheduleMode('now')}
                    className={cn(
                      'market-social-mode-card flex flex-col items-center gap-2 p-5 text-center cursor-pointer',
                      scheduleMode === 'now' && 'is-active'
                    )}
                  >
                    <div className={cn('p-2 rounded-full', scheduleMode === 'now' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      <Lightning size={22} weight="fill" />
                    </div>
                    <strong className="text-sm">{t('Publish Now', 'Terbitkan Sekarang')}</strong>
                    <span className="text-[11px] text-muted-foreground">
                      {t('Goes live immediately on selected channels', 'Langsung tayang sekarang di channel terpilih')}
                    </span>
                  </div>

                  <div
                    onClick={() => setScheduleMode('schedule')}
                    className={cn(
                      'market-social-mode-card flex flex-col items-center gap-2 p-5 text-center cursor-pointer',
                      scheduleMode === 'schedule' && 'is-active'
                    )}
                  >
                    <div className={cn('p-2 rounded-full', scheduleMode === 'schedule' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      <CalendarBlank size={22} weight="fill" />
                    </div>
                    <strong className="text-sm">{t('Schedule Drop', 'Jadwalkan Drop')}</strong>
                    <span className="text-[11px] text-muted-foreground">
                      {t('Pick calendar date & prime engagement time', 'Pilih tanggal kalender & jam interaksi puncak')}
                    </span>
                  </div>
                </div>
              </section>

              {/* Schedule Configuration */}
              {scheduleMode === 'schedule' && (
                <section className="flex flex-col gap-5">
                  {/* Calendar Grid */}
                  <div>
                    <span className="market-social-section-title block mb-2.5">
                      {t('Calendar Date', 'Tanggal Kalender')}
                    </span>
                    <div className="market-social-panel p-3 flex justify-center">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={(date) => setScheduledDate(date ?? undefined)}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Time Presets */}
                  <div>
                    <span className="market-social-section-title block mb-2.5">
                      {t('Time Slots (WIB)', 'Jam Tayang (WIB)')}
                    </span>
                    <div className="flex flex-col gap-2.5">
                      <div className="flex flex-wrap gap-2">
                        {TIME_PRESETS.map((preset) => {
                          const isSelected = scheduledTime === preset.value;
                          return (
                            <Button
                              key={preset.value}
                              variant={isSelected ? 'default' : 'secondary'}
                              size="xs"
                              onClick={() => setScheduledTime(preset.value)}
                              className={cn(
                                'market-social-time-preset button h-8 gap-1.5 text-xs font-semibold rounded-lg',
                                isSelected ? 'is-active' : 'secondary'
                              )}
                            >
                              {preset.icon}
                              <span>{isId ? preset.labelID : preset.labelEN}</span>
                            </Button>
                          );
                        })}
                      </div>

                      {/* Custom Time Input */}
                      <div className="market-social-panel flex items-center gap-2 px-3 py-2">
                        <Clock size={15} className="text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground font-medium">
                          {t('Custom Time', 'Jam Kustom')}
                        </span>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="market-social-input ml-auto px-2.5 py-1 text-xs font-semibold outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Confirmation Summary */}
                  {scheduledDate && (
                    <div className="market-social-panel p-3.5 flex items-center gap-3 border-primary/40 bg-primary/5">
                      <CalendarBlank size={22} className="text-primary shrink-0" weight="fill" />
                      <div>
                        <p className="text-xs font-bold text-primary">
                          {t('Scheduled Publication', 'Jadwal Penerbitan')}
                        </p>
                        <p className="text-sm font-semibold">
                          {scheduledDateLabel} {t('at', 'pukul')} {scheduledTime} WIB
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Best Engagement Tip */}
                  <div className="market-social-tip p-3 flex gap-2.5 text-[11px] leading-relaxed">
                    <Sparkle size={15} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <strong>{t('Prime TCG Hours in Indonesia:', 'Jam Puncak TCG di Indonesia:')}</strong>{' '}
                      {t(
                        '19:00–21:00 on weekdays, 12:00–14:00 on weekends for maximum buyer reach.',
                        '19.00–21.00 hari kerja, 12.00–14.00 akhir pekan untuk jangkauan pembeli maksimal.'
                      )}
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ═══ PREVIEW / REVIEW STEP ═══ */}
          {step === 'preview' && (
            <div className="flex flex-col gap-6">
              {/* Post Summary */}
              <section>
                <span className="market-social-section-title block mb-3">
                  {t('Post Summary & Target Channels', 'Ringkasan Post & Target Channel')}
                </span>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {selectedAccountIds.length === 0 ? (
                    <Badge variant="outline" className="text-destructive border-destructive/40 text-xs">
                      {t('No accounts selected', 'Belum ada akun dipilih')}
                    </Badge>
                  ) : (
                    accounts
                      .filter((a) => selectedAccountIds.includes(a.id))
                      .map((acc) => (
                        <Badge key={acc.id} variant="secondary" className="gap-1.5 text-xs py-1 px-2.5">
                          {getPlatformIcon(acc.platform, 13)}
                          <span>@{acc.username}</span>
                        </Badge>
                      ))
                  )}
                </div>

                {/* Preview Post Card */}
                <div className="market-social-preview-card overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/60">
                    <div className="size-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                      {selectedAccountIds.length > 0 ? (
                        getPlatformIcon(
                          accounts.find((a) => selectedAccountIds.includes(a.id))?.platform ?? 'instagram',
                          14
                        )
                      ) : (
                        <ShareNetwork size={14} />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-none">
                        {selectedAccountIds.length > 0
                          ? `@${accounts.find((a) => selectedAccountIds.includes(a.id))?.username ?? 'yourhandle'}`
                          : '@yourhandle'}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {scheduleMode === 'now'
                          ? t('Instant Publication', 'Terbit Langsung')
                          : scheduledDate
                          ? `${scheduledDateLabel} · ${scheduledTime} WIB`
                          : t('Schedule not selected', 'Jadwal belum ditentukan')}
                      </p>
                    </div>
                  </div>

                  {/* Media Strip */}
                  {selectedMediaUrls.length > 0 && (
                    <div className="flex gap-1.5 p-2.5 overflow-x-auto bg-muted/20">
                      {selectedMediaUrls.map((url, i) => (
                        <div
                          key={url}
                          className="relative aspect-square size-16 shrink-0 overflow-hidden rounded-lg border border-border"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                          <div className="absolute top-0.5 right-0.5">
                            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                              {i + 1}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Caption preview */}
                  <div className="p-4">
                    <p className="whitespace-pre-wrap text-xs leading-relaxed">
                      {caption || (
                        <span className="text-muted-foreground italic">
                          {t('No caption written', 'Caption belum diisi')}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </section>

              {/* Publication Checklist */}
              <section className="market-social-panel p-3.5 flex flex-col gap-2">
                {[
                  {
                    ok: selectedAccountIds.length > 0,
                    label: t('Target accounts connected & selected', 'Akun tujuan terhubung & dipilih'),
                  },
                  {
                    ok: caption.trim().length > 0,
                    label: t('Caption formulated & reviewed', 'Caption sudah dirumuskan & ditinjau'),
                  },
                  {
                    ok: selectedMediaUrls.length > 0,
                    label: t('Drop media & artwork attached', 'Media & artwork terlampir'),
                  },
                  {
                    ok: scheduleMode === 'now' || !!scheduledDate,
                    label: t('Timing mode confirmed', 'Mode waktu penerbitan terkonfirmasi'),
                  },
                ].map(({ ok, label }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <CheckCircle
                      size={15}
                      weight="fill"
                      className={ok ? 'text-emerald-500' : 'text-muted-foreground/40'}
                    />
                    <span className={ok ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                      {label}
                    </span>
                  </div>
                ))}
              </section>
            </div>
          )}
        </div>

        {/* ── Dialog Footer ── */}
        <div className="market-social-footer px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {step !== 'compose' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setStep((s) => (s === 'preview' ? 'schedule' : 'compose'))}
                  className="market-social-footer-btn button secondary h-8 text-xs font-semibold px-3"
                >
                  ← {t('Back', 'Kembali')}
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={publishing}
                className="market-social-footer-cancel button secondary h-8 text-xs font-semibold px-3 opacity-80 hover:opacity-100"
              >
                {t('Cancel', 'Batal')}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {step === 'compose' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setStep('schedule')}
                  className="market-social-footer-next button h-8 text-xs font-bold gap-1 px-4"
                >
                  <span>{t('Next: Schedule', 'Lanjut: Jadwal')}</span>
                  <span>→</span>
                </Button>
              )}
              {step === 'schedule' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setStep('preview')}
                  className="market-social-footer-next button h-8 text-xs font-bold gap-1 px-4"
                >
                  <span>{t('Next: Review', 'Lanjut: Tinjau')}</span>
                  <span>→</span>
                </Button>
              )}
              {step === 'preview' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => void handlePublish()}
                  disabled={publishing || !canPublish}
                  className="market-social-footer-submit button h-8 text-xs font-bold gap-2 px-5 shadow-sm"
                >
                  {publishing ? (
                    <>
                      <ArrowsClockwise size={13} className="animate-spin" />
                      <span>{t('Publishing…', 'Menerbitkan…')}</span>
                    </>
                  ) : scheduleMode === 'schedule' ? (
                    <>
                      <CalendarBlank size={14} weight="fill" />
                      <span>{t('Schedule Drop', 'Jadwalkan Drop')}</span>
                    </>
                  ) : (
                    <>
                      <Lightning size={14} weight="fill" />
                      <span>{t('Publish Now', 'Terbitkan Sekarang')}</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Lightbox Viewer Portal */}
      {mounted && lightboxIndex !== null && medias[lightboxIndex] && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('Media Lightbox Viewer', 'Pratinjau Lightbox Media')}
          className="fixed inset-0 z-[12000] flex flex-col items-center justify-between bg-black/92 backdrop-blur-md p-4 sm:p-6 select-none animate-in fade-in-0 duration-150"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Lightbox Header Bar */}
          <div
            className="w-full max-w-4xl flex items-center justify-between z-10 py-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-white">
              <Badge variant="secondary" className="bg-white/15 text-white border-white/20 text-xs px-2.5 py-0.5 font-bold">
                {medias[lightboxIndex].label || t('Listing Media', 'Media Listing')}
              </Badge>
              <span className="text-xs text-white/70 font-mono font-semibold">
                {lightboxIndex + 1} / {medias.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Set Cover Action */}
              {selectedMediaUrls.indexOf(medias[lightboxIndex].url) !== 0 && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => makeCover(medias[lightboxIndex].url)}
                  className="market-social-cover-btn button secondary h-8 text-xs font-bold gap-1.5 px-3"
                >
                  <Star size={13} weight="fill" className="text-amber-500" />
                  <span>{t('Set as Cover', 'Jadikan Cover')}</span>
                </Button>
              )}

              {/* Selection Toggle */}
              <Button
                variant={selectedMediaUrls.includes(medias[lightboxIndex].url) ? 'default' : 'secondary'}
                size="xs"
                onClick={() => toggleMediaUrl(medias[lightboxIndex].url)}
                className="button h-8 text-xs font-bold gap-1.5 px-3"
              >
                <Check size={13} weight="bold" />
                <span>
                  {selectedMediaUrls.includes(medias[lightboxIndex].url)
                    ? t('Included in Drop', 'Dipilih untuk Drop')
                    : t('Include in Drop', 'Pilih untuk Drop')}
                </span>
              </Button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="size-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors ml-2"
                aria-label={t('Close lightbox', 'Tutup lightbox')}
              >
                <X size={18} weight="bold" />
              </button>
            </div>
          </div>

          {/* Lightbox Main Stage */}
          <div
            className="relative flex-1 flex items-center justify-center w-full max-w-5xl my-auto overflow-hidden py-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Previous Image Chevron */}
            {medias.length > 1 && (
              <button
                type="button"
                onClick={() => setLightboxIndex((prev) => (prev! > 0 ? prev! - 1 : medias.length - 1))}
                className="absolute left-2 sm:left-4 z-20 size-11 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/20 backdrop-blur-xs shadow-lg"
                aria-label={t('Previous media', 'Media sebelumnya')}
              >
                <CaretLeft size={24} weight="bold" />
              </button>
            )}

            {/* Centered High-Res Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={medias[lightboxIndex].url}
              alt={medias[lightboxIndex].label ?? 'Media preview'}
              className="max-h-[76vh] max-w-[85vw] object-contain rounded-xl shadow-2xl transition-all select-none"
            />

            {/* Next Image Chevron */}
            {medias.length > 1 && (
              <button
                type="button"
                onClick={() => setLightboxIndex((prev) => (prev! < medias.length - 1 ? prev! + 1 : 0))}
                className="absolute right-2 sm:right-4 z-20 size-11 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/20 backdrop-blur-xs shadow-lg"
                aria-label={t('Next media', 'Media berikutnya')}
              >
                <CaretRight size={24} weight="bold" />
              </button>
            )}
          </div>

          {/* Lightbox Thumbnails Strip */}
          {medias.length > 1 && (
            <div
              className="flex items-center gap-2 max-w-2xl overflow-x-auto py-2 px-3 rounded-2xl bg-black/60 backdrop-blur-md z-10 border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {medias.map((m, idx) => {
                const isCur = idx === lightboxIndex;
                const isSel = selectedMediaUrls.includes(m.url);
                const isCov = selectedMediaUrls[0] === m.url;
                return (
                  <button
                    key={m.url}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className={cn(
                      'relative size-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all p-0.5 bg-black/40',
                      isCur
                        ? 'border-amber-400 scale-105 ring-2 ring-amber-400/30'
                        : isSel
                        ? 'border-white/50 opacity-80 hover:opacity-100'
                        : 'border-white/20 opacity-40 hover:opacity-75'
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt="" className="h-full w-full object-contain" />
                    {isCov && (
                      <span className="absolute top-1 left-1 size-2 rounded-full bg-amber-400 shadow-xs" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </Dialog>
  );
}
