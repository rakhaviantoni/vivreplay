'use client';

import { useEffect, useState } from 'react';
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
  { key: 'consign', labelEN: 'Consignment', labelID: 'Consign', emoji: '🃏' },
  { key: 'hype', labelEN: 'Hype', labelID: 'Hype', emoji: '🔥' },
  { key: 'minimal', labelEN: 'Minimal', labelID: 'Minimal', emoji: '✦' },
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

  const [step, setStep] = useState<Step>('compose');
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
  }, [open, photos.length]);

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
      if (!res.ok || !data.url) throw new Error(data.error || 'Connection failed');
      window.open(data.url, '_blank', 'width=600,height=700');
      toast.info(t('Connect in the popup window', 'Sambungkan di jendela popup'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Connection failed', 'Gagal menyambungkan'));
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
      if (!res.ok || !data.caption) throw new Error(data.error || 'AI failed');
      setCaption(data.caption);
      toast.success(t('Caption updated', 'Caption diperbarui'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Update failed', 'Gagal memperbarui'));
    } finally {
      setAiBusy(false);
      setActiveAiStyle(null);
    }
  };

  const saveCustomTemplate = async () => {
    if (!templateName.trim() || !caption.trim()) {
      toast.error(t('Enter template name', 'Masukkan nama template'));
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
      if (!res.ok || !data.templates) throw new Error(data.error || 'Save failed');
      setTemplates(data.templates);
      setShowSaveTemplate(false);
      setTemplateName('');
      toast.success(t('Template saved', 'Template tersimpan'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Save failed', 'Gagal menyimpan'));
    } finally {
      setSavingTemplate(false);
    }
  };

  const handlePublish = async () => {
    if (!caption.trim()) {
      toast.error(t('Caption required', 'Caption wajib diisi'));
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
          ? t('Post scheduled', 'Postingan dijadwalkan')
          : t('Published', 'Dipublikasikan')
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Publish failed', 'Gagal mempublikasikan'));
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
    : t('Select date', 'Pilih tanggal');

  const canPublish =
    caption.trim().length > 0 &&
    (scheduleMode === 'now' || (scheduleMode === 'schedule' && !!scheduledDate));

  const allTemplates = [
    ...DEFAULT_CAPTION_TEMPLATES.map((t) => ({ id: t.id, name: t.name[language], custom: false })),
    ...templates.map((t) => ({ id: t.id, name: t.name, custom: true })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] p-0 gap-0">
        <div className="border-b px-6 pt-5 pb-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="size-7 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <Instagram size={14} weight="fill" className="text-white" />
              </div>
              PostForMe
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-semibold">
                BETA
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              {t(
                'Publish or schedule this drop to connected social accounts',
                'Publikasikan atau jadwalkan drop ke akun sosial media'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1 mt-4">
            {(['compose', 'schedule', 'preview'] as Step[]).map((s, i) => {
              const labels = {
                compose: t('Content', 'Konten'),
                schedule: t('Schedule', 'Jadwal'),
                preview: t('Review', 'Tinjau'),
              };
              return (
                <Button
                  key={s}
                  variant={step === s ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setStep(s)}
                  className="gap-1.5"
                >
                  <span className={cn(
                    'flex size-4 items-center justify-center rounded-full text-[10px] font-bold',
                    step === s ? 'bg-primary-foreground/20' : 'bg-muted'
                  )}>
                    {i + 1}
                  </span>
                  {labels[s]}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(100dvh-240px)] min-h-[300px]">
          {step === 'compose' && (
            <div className="flex flex-col gap-5 p-6">
              <section>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('Accounts', 'Akun')}
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => void connectAccount('instagram')}
                    >
                      <Plus size={10} weight="bold" />
                      Instagram
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => void connectAccount('twitter')}
                    >
                      <Plus size={10} weight="bold" />
                      X
                    </Button>
                  </div>
                </div>

                {loadingAccounts ? (
                  <div className="flex gap-2">
                    {[1, 2].map((n) => (
                      <div key={n} className="h-10 w-28 animate-pulse rounded-lg bg-muted" />
                    ))}
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="flex items-center justify-between rounded-xl border border-dashed bg-muted/30 px-4 py-3">
                    <div>
                      <p className="text-xs font-medium">
                        {t('No accounts connected', 'Belum ada akun terhubung')}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t('Connect Instagram or X above', 'Hubungkan Instagram atau X di atas')}
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
                        <Button
                          key={acc.id}
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleAccount(acc.id)}
                          className="gap-2"
                        >
                          {icon}
                          @{acc.username}
                          {active && <Check size={12} weight="bold" />}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                  {t('Template', 'Template')}
                </span>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {allTemplates.map((tmpl) => (
                    <Button
                      key={tmpl.id}
                      variant={selectedTemplateId === tmpl.id ? 'default' : 'outline'}
                      size="xs"
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                    >
                      {tmpl.custom && '⭐ '}{tmpl.name}
                    </Button>
                  ))}
                </div>

                <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 mb-3">
                  <Sparkle size={14} className="text-amber-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                    {t('AI Style', 'Gaya AI')}
                  </span>
                  {AI_STYLES.map(({ key, labelEN, labelID, emoji }) => (
                    <Button
                      key={key}
                      variant="ghost"
                      size="xs"
                      disabled={aiBusy}
                      onClick={() => void improveWithAi(key as 'consign' | 'hype' | 'minimal')}
                      className={cn(
                        activeAiStyle === key && aiBusy && 'bg-amber-50 text-amber-700'
                      )}
                    >
                      {activeAiStyle === key && aiBusy ? (
                        <ArrowsClockwise size={10} className="animate-spin" />
                      ) : (
                        <span>{emoji}</span>
                      )}
                      {isId ? labelID : labelEN}
                    </Button>
                  ))}
                </div>

                <div className="relative">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={9}
                    className="w-full resize-none rounded-xl border bg-background px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/50"
                    placeholder={t('Caption text...', 'Teks caption...')}
                  />
                  <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground tabular-nums">
                    {caption.length}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-end gap-2">
                  {showSaveTemplate ? (
                    <div className="flex flex-1 items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
                      <Bookmark size={13} className="shrink-0 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder={t('Template name', 'Nama template')}
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                      />
                      <Button
                        variant="default"
                        size="xs"
                        disabled={savingTemplate || !templateName.trim()}
                        onClick={() => void saveCustomTemplate()}
                      >
                        {savingTemplate ? t('Saving', 'Menyimpan') : t('Save', 'Simpan')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setShowSaveTemplate(false)}
                      >
                        <Trash size={13} />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setShowSaveTemplate(true)}
                    >
                      <Bookmark size={12} />
                      {t('Save template', 'Simpan template')}
                    </Button>
                  )}
                </div>
              </section>

              {photos.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('Media', 'Media')}
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
                              ? 'border-primary shadow-sm'
                              : 'border-transparent opacity-50 hover:opacity-80'
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                          {sel && (
                            <div className="absolute inset-0 flex items-start justify-end p-1">
                              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow">
                                {selectedPhotoIndexes.indexOf(i) + 1}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {photos.length === 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/20 px-4 py-3">
                  <ImageIcon size={18} className="shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium">{t('No photos', 'Tidak ada foto')}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t('Photos improve reach on social media', 'Foto meningkatkan jangkauan di sosial media')}
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
                  {t('Timing', 'Waktu')}
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={scheduleMode === 'now' ? 'default' : 'outline'}
                    onClick={() => setScheduleMode('now')}
                    className="flex flex-col h-auto py-5 gap-2"
                  >
                    <Lightning size={22} weight={scheduleMode === 'now' ? 'fill' : 'regular'} />
                    <span className="font-semibold">{t('Now', 'Sekarang')}</span>
                    <span className="text-[11px] opacity-70">
                      {t('Publish immediately', 'Publikasikan langsung')}
                    </span>
                  </Button>

                  <Button
                    variant={scheduleMode === 'schedule' ? 'default' : 'outline'}
                    onClick={() => setScheduleMode('schedule')}
                    className="flex flex-col h-auto py-5 gap-2"
                  >
                    <CalendarBlank size={22} weight={scheduleMode === 'schedule' ? 'fill' : 'regular'} />
                    <span className="font-semibold">{t('Schedule', 'Jadwalkan')}</span>
                    <span className="text-[11px] opacity-70">
                      {t('Select date & time', 'Pilih tanggal & waktu')}
                    </span>
                  </Button>
                </div>
              </section>

              {scheduleMode === 'schedule' && (
                <section className="flex flex-col gap-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                      {t('Date', 'Tanggal')}
                    </span>
                    <div className="rounded-2xl border overflow-hidden">
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
                    <div className="flex flex-wrap gap-2 mb-2">
                      {[
                        { label: t('Morning 9am', 'Pagi 09.00'), value: '09:00' },
                        { label: t('Noon 12pm', 'Siang 12.00'), value: '12:00' },
                        { label: t('Evening 7pm', 'Sore 19.00'), value: '19:00' },
                        { label: t('Night 9pm', 'Malam 21.00'), value: '21:00' },
                      ].map((preset) => (
                        <Button
                          key={preset.value}
                          variant={scheduledTime === preset.value ? 'default' : 'outline'}
                          size="xs"
                          onClick={() => setScheduledTime(preset.value)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
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

                  {scheduledDate && (
                    <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
                      <CalendarBlank size={20} className="text-primary shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-primary">
                          {t('Scheduled for', 'Dijadwalkan pada')}
                        </p>
                        <p className="text-sm font-medium">
                          {scheduledDateLabel} {scheduledTime}
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col gap-5 p-6">
              <section>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-3">
                  {t('Summary', 'Ringkasan')}
                </span>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  {selectedAccountIds.length === 0 ? (
                    <Badge variant="outline" className="text-destructive border-destructive/40">
                      {t('No accounts', 'Tidak ada akun')}
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

                <div className="rounded-2xl border overflow-hidden">
                  <div className="flex items-center gap-2.5 border-b px-4 py-3">
                    <div className="size-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                      <Instagram size={14} color="#fff" weight="fill" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold leading-none">
                        {selectedAccountIds.length > 0
                          ? `@${accounts.find((a) => selectedAccountIds.includes(a.id))?.username ?? 'account'}`
                          : '@account'}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {scheduleMode === 'now'
                          ? t('Now', 'Sekarang')
                          : scheduledDate
                          ? `${scheduledDateLabel} · ${scheduledTime}`
                          : t('Not scheduled', 'Belum dijadwalkan')}
                      </p>
                    </div>
                  </div>

                  {selectedPhotoIndexes.length > 0 && (
                    <div className="flex gap-1 p-2 bg-muted/20">
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
                        <div className="flex aspect-square flex-1 max-w-[80px] items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                          +{selectedPhotoIndexes.length - 5}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="px-4 py-3">
                    <p className="whitespace-pre-wrap text-xs leading-relaxed">
                      {caption || (
                        <span className="text-muted-foreground italic">
                          {t('No caption', 'Tidak ada caption')}
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
                    label: t('Caption written', 'Caption terisi'),
                  },
                  {
                    ok: selectedPhotoIndexes.length > 0,
                    label: t('Media attached', 'Media terlampir'),
                    soft: true,
                  },
                  {
                    ok: scheduleMode === 'now' || !!scheduledDate,
                    label: t('Schedule set', 'Jadwal diatur'),
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
                    </span>
                  </div>
                ))}
              </section>
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {step !== 'compose' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setStep((s) => (s === 'preview' ? 'schedule' : 'compose'))
                  }
                >
                  {t('Back', 'Kembali')}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={publishing}
              >
                {t('Cancel', 'Batal')}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {step === 'compose' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setStep('schedule')}
                >
                  {t('Next', 'Lanjut')}
                </Button>
              )}
              {step === 'schedule' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setStep('preview')}
                >
                  {t('Next', 'Lanjut')}
                </Button>
              )}
              {step === 'preview' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => void handlePublish()}
                  disabled={publishing || !canPublish}
                  className="gap-2"
                >
                  {publishing ? (
                    <>
                      <ArrowsClockwise size={14} className="animate-spin" />
                      {t('Publishing', 'Mempublikasikan')}
                    </>
                  ) : scheduleMode === 'schedule' ? (
                    <>
                      <CalendarBlank size={14} weight="fill" />
                      {t('Schedule', 'Jadwalkan')}
                    </>
                  ) : (
                    <>
                      <Lightning size={14} weight="fill" />
                      {t('Publish', 'Publikasikan')}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
