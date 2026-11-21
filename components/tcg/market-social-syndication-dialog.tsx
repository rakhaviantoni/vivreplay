'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
  CalendarBlankIcon as CalendarBlank,
  CheckCircleIcon as CheckCircle,
  ClockIcon as Clock,
  ImageIcon,
  InstagramLogoIcon as Instagram,
  LightningIcon as Lightning,
  PlusIcon as Plus,
  SparkleIcon as Sparkle,
  TrashIcon as Trash,
  XLogoIcon as XLogo,
  CheckIcon as Check,
  WarningCircleIcon as WarningCircle,
  ArrowsClockwiseIcon as ArrowsClockwise,
  BookmarkSimpleIcon as Bookmark,
  CardsIcon as Cards,
  FireIcon as Fire,
  MinusIcon as Minus,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DEFAULT_CAPTION_TEMPLATES,
  renderCaptionTemplate,
  type CaptionVariables,
  type SavedCaptionTemplate,
} from '@/lib/social-captions';

type ConnectedAccount = {
  id: string;
  platform: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram size={15} weight="fill" />,
  twitter: <XLogo size={15} weight="fill" />,
  x: <XLogo size={15} weight="fill" />,
};

const AI_STYLES = [
  { key: 'consign', labelEN: 'Consign Drop', labelID: 'Format Consign', icon: <Cards size={11} /> },
  { key: 'hype', labelEN: 'Grail Hype', labelID: 'Gaya Grail', icon: <Fire size={11} weight="fill" /> },
  { key: 'minimal', labelEN: 'Minimalist', labelID: 'Minimalis', icon: <Minus size={11} /> },
] as const;

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
  };
  language?: 'EN' | 'ID';
}) {
  const isId = language === 'ID';
  const t = (en: string, id: string) => (isId ? id : en);

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [templates, setTemplates] = useState<SavedCaptionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('consign-drop');
  const [caption, setCaption] = useState('');
  const photos = listing.photoUrls ?? [];
  const [selectedPhotoIndexes, setSelectedPhotoIndexes] = useState<number[]>([]);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState('19:00');
  const [publishing, setPublishing] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [activeAiStyle, setActiveAiStyle] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [step, setStep] = useState<Step>('compose');

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

  useEffect(() => {
    if (!open) return;
    setStep('compose');
    setSelectedPhotoIndexes(photos.length > 0 ? [0] : []);

    setLoadingAccounts(true);
    void fetch('/api/market/social/accounts')
      .then(async (res) => (await res.json()) as { accounts?: ConnectedAccount[] })
      .then((data) => {
        const list = data.accounts ?? [];
        setAccounts(list);
        if (list.length > 0) setSelectedAccountIds([list[0].id]);
      })
      .catch(() => {})
      .finally(() => setLoadingAccounts(false));

    void fetch('/api/market/social/templates')
      .then(async (res) => (await res.json()) as { templates?: SavedCaptionTemplate[] })
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    const custom = templates.find((tmpl) => tmpl.id === selectedTemplateId);
    if (custom) { setCaption(renderCaptionTemplate(custom.body, captionVars)); return; }
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
      window.open(data.url, '_blank', 'width=600,height=700');
      toast.info(t('Connect your account in the popup.', 'Sambungkan akun di jendela yang terbuka.'));
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
      toast.success(t('Caption updated with AI ✨', 'Caption diperbarui dengan AI ✨'));
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
      toast.success(t('Template saved!', 'Template berhasil disimpan!'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save template', 'Gagal menyimpan template'));
    } finally {
      setSavingTemplate(false);
    }
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
          mediaUrls: selectedPhotoIndexes.map((i) => photos[i]).filter(Boolean),
          scheduledAt,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error || 'Publish failed');
      toast.success(
        scheduledAt
          ? t('Post scheduled!', 'Postingan berhasil dijadwalkan!')
          : t('Published to socials!', 'Berhasil dipublikasikan!')
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Publishing failed', 'Gagal mempublikasikan'));
    } finally {
      setPublishing(false);
    }
  };

  const togglePhoto = (index: number) => {
    setSelectedPhotoIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    );
  };

  const scheduledDateLabel = scheduledDate
    ? scheduledDate.toLocaleDateString(isId ? 'id-ID' : 'en-US', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      })
    : t('Pick a date', 'Pilih tanggal');

  const canPublish =
    caption.trim().length > 0 &&
    (scheduleMode === 'now' || (scheduleMode === 'schedule' && !!scheduledDate));

  const allTemplates = [
    ...DEFAULT_CAPTION_TEMPLATES.map((t) => ({ id: t.id, name: t.name[language], custom: false })),
    ...templates.map((t) => ({ id: t.id, name: t.name, custom: true })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="market-social-dialog"
        style={{ maxWidth: 680, padding: 0, overflow: 'hidden' }}
      >
        <div className="border-b border-border px-6 pt-5 pb-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Instagram size={15} weight="fill" color="#fff" />
              </div>
              PostForMe
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-semibold tracking-wide">
                BETA
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {t(
                'Publish or schedule this drop to your connected social accounts.',
                'Terbitkan atau jadwalkan drop ini ke akun media sosial yang terhubung.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1 mt-4">
            {(['compose', 'schedule', 'preview'] as Step[]).map((s, i) => {
              const labels = {
                compose: t('Compose', 'Konten'),
                schedule: t('Schedule', 'Jadwal'),
                preview: t('Review', 'Tinjau'),
              };
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(s)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    step === s
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded-full text-[10px] font-bold',
                      step === s ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20'
                    )}
                  >
                    {i + 1}
                  </span>
                  {labels[s]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 240px)', minHeight: 300 }}>
          {step === 'compose' && (
            <div className="flex flex-col gap-5 p-6">
              <section>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('Post to', 'Kirim ke')}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => void connectAccount('instagram')}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted transition-colors"
                    >
                      <Plus size={10} weight="bold" />
                      Instagram
                    </button>
                    <button
                      type="button"
                      onClick={() => void connectAccount('twitter')}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted transition-colors"
                    >
                      <Plus size={10} weight="bold" />
                      X / Twitter
                    </button>
                  </div>
                </div>

                {loadingAccounts ? (
                  <div className="flex gap-2">
                    {[1, 2].map((n) => (
                      <div key={n} className="h-10 w-28 animate-pulse rounded-lg bg-muted" />
                    ))}
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
                    <div>
                      <p className="text-xs font-medium">
                        {t('No connected accounts', 'Belum ada akun terhubung')}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t('Add Instagram or X above to get started.', 'Tambahkan Instagram atau X di atas.')}
                      </p>
                    </div>
                    <WarningCircle size={20} className="text-muted-foreground" />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {accounts.map((acc) => {
                      const active = selectedAccountIds.includes(acc.id);
                      const icon = PLATFORM_ICONS[acc.platform.toLowerCase()] ?? <Instagram size={14} />;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => toggleAccount(acc.id)}
                          className={cn(
                            'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                            active
                              ? 'border-primary bg-primary/8 text-primary shadow-sm'
                              : 'border-border hover:border-muted-foreground/50 hover:bg-muted'
                          )}
                        >
                          <span className={active ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>
                          <span>@{acc.username}</span>
                          {active && <Check size={12} weight="bold" className="text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                  {t('Caption Template', 'Template Caption')}
                </span>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {allTemplates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all',
                        selectedTemplateId === tmpl.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-muted-foreground/50 hover:bg-muted text-muted-foreground'
                      )}
                    >
                      {tmpl.custom ? '⭐ ' : ''}{tmpl.name}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 mb-3">
                  <Sparkle size={14} className="text-amber-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                    {t('AI Polish', 'Optimalkan AI')}
                  </span>
                  {AI_STYLES.map(({ key, labelEN, labelID, icon }) => (
                    <button
                      key={key}
                      type="button"
                      disabled={aiBusy}
                      onClick={() => void improveWithAi(key as 'consign' | 'hype' | 'minimal')}
                      className={cn(
                        'flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-all',
                        activeAiStyle === key && aiBusy
                          ? 'border-amber-400 bg-amber-50 text-amber-700'
                          : 'border-border hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 text-muted-foreground disabled:opacity-50'
                      )}
                    >
                      {activeAiStyle === key && aiBusy ? (
                        <ArrowsClockwise size={10} className="animate-spin" />
                      ) : (
                        icon
                      )}
                      {isId ? labelID : labelEN}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={9}
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
                    placeholder={t('Write your caption here…', 'Tulis caption di sini…')}
                  />
                  <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground tabular-nums">
                    {caption.length}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-end gap-2">
                  {showSaveTemplate ? (
                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                      <Bookmark size={13} className="shrink-0 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder={t('Template name…', 'Nama template…')}
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                      />
                      <button
                        type="button"
                        disabled={savingTemplate || !templateName.trim()}
                        onClick={() => void saveCustomTemplate()}
                        className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {savingTemplate ? t('Saving…', 'Menyimpan…') : t('Save', 'Simpan')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSaveTemplate(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Trash size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSaveTemplate(true)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Bookmark size={12} />
                      {t('Save as template', 'Simpan sebagai template')}
                    </button>
                  )}
                </div>
              </section>

              {photos.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('Media to Post', 'Foto yang Dikirim')}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {selectedPhotoIndexes.length}/{photos.length} {t('selected', 'dipilih')}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {photos.map((url, i) => {
                      const sel = selectedPhotoIndexes.includes(i);
                      return (
                        <button
                          key={url}
                          type="button"
                          onClick={() => togglePhoto(i)}
                          className={cn(
                            'relative aspect-square overflow-hidden rounded-xl border-2 transition-all',
                            sel
                              ? 'border-primary shadow-sm shadow-primary/20'
                              : 'border-transparent opacity-50 hover:opacity-80'
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Photo ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                          {sel && (
                            <div className="absolute inset-0 flex items-start justify-end p-1">
                              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow">
                                {selectedPhotoIndexes.indexOf(i) + 1}
                              </span>
                            </div>
                          )}
                          {i === 0 && (
                            <div className="absolute bottom-1 left-1">
                              <Badge variant="secondary" className="text-[8px] px-1 py-0 leading-tight">
                                {t('Cover', 'Cover')}
                              </Badge>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {t(
                      'Tap to select which photos to include. Numbers show post order.',
                      'Ketuk untuk memilih foto. Angka menunjukkan urutan posting.'
                    )}
                  </p>
                </section>
              )}

              {photos.length === 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3">
                  <ImageIcon size={18} className="shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium">{t('No photos attached', 'Tidak ada foto')}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t(
                        'Listings with photos get significantly more reach on social.',
                        'Listing dengan foto mendapat jangkauan lebih besar di media sosial.'
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'schedule' && (
            <div className="flex flex-col gap-5 p-6">
              <section>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
                  {t('When to Post', 'Waktu Posting')}
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleMode('now')}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-5 text-sm font-medium transition-all',
                      scheduleMode === 'now'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Lightning size={22} weight={scheduleMode === 'now' ? 'fill' : 'regular'} />
                    <span className="font-semibold">{t('Post Now', 'Terbitkan Sekarang')}</span>
                    <span className="text-[11px] opacity-70 text-center">
                      {t('Goes live immediately', 'Langsung tayang sekarang')}
                    </span>
                    {scheduleMode === 'now' && (
                      <CheckCircle size={16} weight="fill" className="mt-1" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleMode('schedule')}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-5 text-sm font-medium transition-all',
                      scheduleMode === 'schedule'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <CalendarBlank size={22} weight={scheduleMode === 'schedule' ? 'fill' : 'regular'} />
                    <span className="font-semibold">{t('Schedule', 'Jadwalkan')}</span>
                    <span className="text-[11px] opacity-70 text-center">
                      {t('Pick a date & time', 'Pilih tanggal & waktu')}
                    </span>
                    {scheduleMode === 'schedule' && (
                      <CheckCircle size={16} weight="fill" className="mt-1" />
                    )}
                  </button>
                </div>
              </section>

              {scheduleMode === 'schedule' && (
                <section className="flex flex-col gap-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                      {t('Date', 'Tanggal')}
                    </span>
                    <div className="rounded-2xl border border-border overflow-hidden">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={(date) => setScheduledDate(date ?? undefined)}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        className="w-full p-4"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                      {t('Time', 'Waktu')}
                    </span>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: t('Morning 9am', 'Pagi 09.00'), value: '09:00' },
                          { label: t('Noon 12pm', 'Siang 12.00'), value: '12:00' },
                          { label: t('Evening 7pm', 'Sore 19.00'), value: '19:00' },
                          { label: t('Night 9pm', 'Malam 21.00'), value: '21:00' },
                        ].map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => setScheduledTime(preset.value)}
                            className={cn(
                              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                              scheduledTime === preset.value
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border hover:border-primary/50 hover:bg-muted text-muted-foreground'
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                        <Clock size={14} className="text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          {t('Custom', 'Kustom')}
                        </span>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="ml-auto bg-transparent text-sm font-medium outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {scheduledDate && (
                    <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
                      <CalendarBlank size={20} className="text-primary shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-primary">
                          {t('Scheduled for', 'Dijadwalkan pada')}
                        </p>
                        <p className="text-sm font-medium">
                          {scheduledDateLabel} {t('at', 'pukul')} {scheduledTime}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 flex gap-2.5">
                    <Sparkle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                      {t(
                        'Best engagement times for TCG in Indonesia: 7–9 PM on weekdays, 12–2 PM on weekends.',
                        'Waktu terbaik untuk TCG di Indonesia: 19.00–21.00 hari kerja, 12.00–14.00 akhir pekan.'
                      )}
                    </p>
                  </div>
                </section>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col gap-5 p-6">
              <section>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
                  {t('Post Summary', 'Ringkasan Postingan')}
                </span>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  {selectedAccountIds.length === 0 ? (
                    <Badge variant="outline" className="text-destructive border-destructive/40">
                      {t('No accounts selected', 'Belum pilih akun')}
                    </Badge>
                  ) : (
                    accounts
                      .filter((a) => selectedAccountIds.includes(a.id))
                      .map((acc) => (
                        <Badge key={acc.id} variant="secondary" className="gap-1">
                          {PLATFORM_ICONS[acc.platform.toLowerCase()] ?? <Instagram size={11} />}
                          @{acc.username}
                        </Badge>
                      ))
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 overflow-hidden">
                  <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                    <div className="size-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                      <Instagram size={14} color="#fff" weight="fill" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold leading-none">
                        {selectedAccountIds.length > 0
                          ? `@${accounts.find((a) => selectedAccountIds.includes(a.id))?.username ?? 'yourhandle'}`
                          : '@yourhandle'}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {scheduleMode === 'now'
                          ? t('Now', 'Sekarang')
                          : scheduledDate
                          ? `${scheduledDateLabel} · ${scheduledTime}`
                          : t('Not scheduled yet', 'Belum dijadwalkan')}
                      </p>
                    </div>
                  </div>

                  {selectedPhotoIndexes.length > 0 && (
                    <div className="flex gap-1 p-2 bg-black/5">
                      {selectedPhotoIndexes.slice(0, 5).map((photoIdx) => (
                        <div
                          key={photoIdx}
                          className="relative aspect-square overflow-hidden rounded-lg flex-1 max-w-[80px]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photos[photoIdx]}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                      {selectedPhotoIndexes.length > 5 && (
                        <div className="flex aspect-square flex-1 max-w-[80px] items-center justify-center rounded-lg bg-black/20 text-xs font-semibold text-white">
                          +{selectedPhotoIndexes.length - 5}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="px-4 py-3">
                    <p className="whitespace-pre-wrap text-xs leading-relaxed">
                      {caption || (
                        <span className="text-muted-foreground italic">
                          {t('No caption yet', 'Caption belum diisi')}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-1.5">
                {[
                  {
                    ok: selectedAccountIds.length > 0,
                    label: t('Account selected', 'Akun dipilih'),
                  },
                  {
                    ok: caption.trim().length > 0,
                    label: t('Caption written', 'Caption sudah diisi'),
                  },
                  {
                    ok: selectedPhotoIndexes.length > 0,
                    label: t('Media attached', 'Foto terlampir'),
                    soft: true,
                  },
                  {
                    ok: scheduleMode === 'now' || !!scheduledDate,
                    label: t('Schedule set', 'Jadwal ditetapkan'),
                  },
                ].map(({ ok, label, soft }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <CheckCircle
                      size={15}
                      weight="fill"
                      className={cn(
                        ok
                          ? 'text-emerald-500'
                          : soft
                          ? 'text-amber-400'
                          : 'text-muted-foreground/40'
                      )}
                    />
                    <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>
                      {label}
                      {soft && !ok && (
                        <span className="ml-1 text-amber-500">
                          ({t('optional but recommended', 'opsional tapi disarankan')})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </section>
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {step !== 'compose' && (
                <button
                  type="button"
                  onClick={() =>
                    setStep((s) => (s === 'preview' ? 'schedule' : 'compose'))
                  }
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                >
                  ← {t('Back', 'Kembali')}
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={publishing}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors text-muted-foreground"
              >
                {t('Cancel', 'Batal')}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {step === 'compose' && (
                <button
                  type="button"
                  onClick={() => setStep('schedule')}
                  className="rounded-lg bg-muted px-4 py-1.5 text-xs font-semibold hover:bg-muted/80 transition-colors"
                >
                  {t('Next: Schedule', 'Lanjut: Jadwal')} →
                </button>
              )}
              {step === 'schedule' && (
                <button
                  type="button"
                  onClick={() => setStep('preview')}
                  className="rounded-lg bg-muted px-4 py-1.5 text-xs font-semibold hover:bg-muted/80 transition-colors"
                >
                  {t('Next: Review', 'Lanjut: Tinjau')} →
                </button>
              )}
              {step === 'preview' && (
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={publishing || !canPublish}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-all',
                    canPublish && !publishing
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  {publishing ? (
                    <>
                      <ArrowsClockwise size={14} className="animate-spin" />
                      {t('Publishing…', 'Menerbitkan…')}
                    </>
                  ) : scheduleMode === 'schedule' ? (
                    <>
                      <CalendarBlank size={14} weight="fill" />
                      {t('Schedule Post', 'Jadwalkan Postingan')}
                    </>
                  ) : (
                    <>
                      <Lightning size={14} weight="fill" />
                      {t('Publish Now', 'Terbitkan Sekarang')}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
