'use client';

import { useEffect, useState } from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Calendar} from '@/components/ui/calendar';
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
import {toast} from 'sonner';
import {cn} from '@/lib/utils';
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
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const cardLink = typeof window !== 'undefined' ? `${window.location.origin}/market/${listing.id}` : `https://vivreplay.com/market/${listing.id}`;

  const formatPrice = (val: number, cur: string = 'IDR') => new Intl.NumberFormat(isId ? 'id-ID' : 'en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(val);

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
    setSelectedPhotoIndexes(photos.length > 0 ? [0] : []);
    setLoadingAccounts(true);
    void fetch('/api/market/social/accounts').then(async (res) => (await res.json()) as { accounts?: ConnectedAccount[] }).then((data) => { const list = data.accounts ?? []; setAccounts(list); if (list.length > 0) setSelectedAccountIds([list[0].id]); }).catch(() => {}).finally(() => setLoadingAccounts(false));
    void fetch('/api/market/social/templates').then(async (res) => (await res.json()) as { templates?: SavedCaptionTemplate[] }).then((data) => setTemplates(data.templates ?? [])).catch(() => {});
  }, [open, photos.length]);

  useEffect(() => {
    const custom = templates.find((tmpl) => tmpl.id === selectedTemplateId);
    if (custom) { setCaption(renderCaptionTemplate(custom.body, captionVars)); return; }
    const def = DEFAULT_CAPTION_TEMPLATES.find((tmpl) => tmpl.id === selectedTemplateId);
    if (def) setCaption(renderCaptionTemplate(def.body, captionVars));
  }, [selectedTemplateId, templates]);

  const connectAccount = async (platform: string) => {
    try {
      const res = await fetch('/api/market/social/auth-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform, redirectUrl: window.location.href }) });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || 'Connection failed');
      window.open(data.url, '_blank', 'width=600,height=700');
      toast.info(t('Connect in popup', 'Sambungkan di popup'));
    } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed', 'Gagal')); }
  };

  const improveWithAi = async (style: 'consign' | 'hype' | 'minimal') => {
    setAiBusy(true);
    try {
      const res = await fetch('/api/market/social/ai-caption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, style, locale: language, cardDetails: captionVars }) });
      const data = (await res.json()) as { caption?: string; error?: string };
      if (!res.ok || !data.caption) throw new Error(data.error || 'Failed');
      setCaption(data.caption);
      toast.success(t('Updated', 'Diperbarui'));
    } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed', 'Gagal')); } finally { setAiBusy(false); }
  };

  const saveCustomTemplate = async () => {
    if (!templateName.trim() || !caption.trim()) { toast.error(t('Name required', 'Nama wajib')); return; }
    setSavingTemplate(true);
    try {
      const res = await fetch('/api/market/social/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: templateName.trim(), body: caption, isDefault: false }) });
      const data = (await res.json()) as { templates?: SavedCaptionTemplate[]; error?: string };
      if (!res.ok || !data.templates) throw new Error(data.error || 'Failed');
      setTemplates(data.templates);
      setShowSaveTemplate(false);
      setTemplateName('');
      toast.success(t('Saved', 'Tersimpan'));
    } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed', 'Gagal')); } finally { setSavingTemplate(false); }
  };

  const handlePublish = async () => {
    if (!caption.trim()) { toast.error(t('Caption required', 'Caption wajib')); return; }
    setPublishing(true);
    let scheduledAt: string | null = null;
    if (scheduleMode === 'schedule' && scheduledDate) {
      const [h = '19', m = '00'] = scheduledTime.split(':');
      const d = new Date(scheduledDate);
      d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
      scheduledAt = d.toISOString();
    }
    try {
      const res = await fetch('/api/market/social/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId: listing.id, accountIds: selectedAccountIds, text: caption, mediaUrls: selectedPhotoIndexes.map((i) => photos[i]).filter(Boolean), scheduledAt }) });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      toast.success(scheduledAt ? t('Scheduled', 'Dijadwalkan') : t('Published', 'Dipublikasikan'));
      onOpenChange(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed', 'Gagal')); } finally { setPublishing(false); }
  };

  const togglePhoto = (index: number) => { setSelectedPhotoIndexes((prev) => prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]); };
  const toggleAccount = (id: string) => { setSelectedAccountIds((curr) => curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]); };

  const allTemplates = [
    ...DEFAULT_CAPTION_TEMPLATES.map((t) => ({ id: t.id, name: t.name[language], custom: false })),
    ...templates.map((t) => ({ id: t.id, name: t.name, custom: true })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="market-social-dialog">
        <DialogHeader>
          <DialogTitle style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <Instagram size={18}/>
            PostForMe
          </DialogTitle>
          <DialogDescription>{t('Publish or schedule drop','Publikasikan atau jadwalkan drop')}</DialogDescription>
        </DialogHeader>

        <div style={{display:'flex',flexDirection:'column',gap:'20px',marginTop:'16px'}}>
          <section>
            <label style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:'8px'}}>{t('Accounts','Akun')}</label>
            {loadingAccounts ? <small>{t('Loading…','Memuat…')}</small> : accounts.length === 0 ? (
              <div style={{padding:'12px',border:'1px dashed var(--line)',borderRadius:'8px',fontSize:'12px'}}>
                <p>{t('No accounts','Tidak ada akun')}</p>
                <div style={{display:'flex',gap:'6px',marginTop:'8px'}}>
                  <button type="button" className="button secondary" style={{fontSize:'11px',padding:'4px 8px'}} onClick={() => void connectAccount('instagram')}><Plus size={11}/>Instagram</button>
                  <button type="button" className="button secondary" style={{fontSize:'11px',padding:'4px 8px'}} onClick={() => void connectAccount('twitter')}><Plus size={11}/>X</button>
                </div>
              </div>
            ) : (
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                {accounts.map((acc) => {
                  const active = selectedAccountIds.includes(acc.id);
                  const icon = PLATFORM_ICONS[acc.platform.toLowerCase()] ?? <Instagram size={13} />;
                  return (
                    <button key={acc.id} type="button" className={`button ${active ? 'primary' : 'secondary'}`} style={{fontSize:'12px',display:'flex',alignItems:'center',gap:'6px'}} onClick={() => toggleAccount(acc.id)}>
                      {icon} @{acc.username} {active && <Check size={12} weight="bold"/>}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <label style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:'8px'}}>{t('Template','Template')}</label>
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'8px'}}>
              {allTemplates.map((tmpl) => (
                <button key={tmpl.id} type="button" className={`button ${selectedTemplateId === tmpl.id ? 'primary' : 'secondary'}`} style={{fontSize:'11px'}} onClick={() => setSelectedTemplateId(tmpl.id)}>
                  {tmpl.custom && '⭐ '}{tmpl.name}
                </button>
              ))}
            </div>

            <div style={{display:'flex',alignItems:'center',gap:'6px',padding:'6px 10px',background:'var(--surface-raised)',borderRadius:'8px',marginBottom:'8px'}}>
              <Sparkle size={13} style={{color:'var(--accent)'}}/>
              <span style={{fontSize:'11px',fontWeight:700}}>{t('AI','AI')}:</span>
              <button type="button" className="button secondary" disabled={aiBusy} onClick={() => void improveWithAi('consign')} style={{fontSize:'11px',padding:'3px 8px'}}>🃏 {t('Consign','Consign')}</button>
              <button type="button" className="button secondary" disabled={aiBusy} onClick={() => void improveWithAi('hype')} style={{fontSize:'11px',padding:'3px 8px'}}>🔥 {t('Hype','Hype')}</button>
              <button type="button" className="button secondary" disabled={aiBusy} onClick={() => void improveWithAi('minimal')} style={{fontSize:'11px',padding:'3px 8px'}}>✦ {t('Minimal','Minimal')}</button>
            </div>

            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={7} style={{width:'100%',fontSize:'12px',padding:'10px',borderRadius:'8px',border:'1px solid var(--line)',background:'var(--surface)',resize:'vertical'}}/>

            {showSaveTemplate ? (
              <div style={{display:'flex',gap:'8px',alignItems:'center',marginTop:'8px'}}>
                <input type="text" placeholder={t('Name','Nama')} value={templateName} onChange={(e) => setTemplateName(e.target.value)} style={{flex:1,fontSize:'12px',padding:'6px 8px',borderRadius:'6px',border:'1px solid var(--line)'}}/>
                <button type="button" className="button primary" disabled={savingTemplate} onClick={() => void saveCustomTemplate()} style={{fontSize:'11px'}}>{t('Save','Simpan')}</button>
                <button type="button" className="button secondary" onClick={() => setShowSaveTemplate(false)} style={{fontSize:'11px'}}><Trash size={12}/></button>
              </div>
            ) : (
              <button type="button" className="button secondary" onClick={() => setShowSaveTemplate(true)} style={{fontSize:'11px',marginTop:'8px'}}><Bookmark size={11}/> {t('Save','Simpan')}</button>
            )}
          </section>

          {photos.length > 0 && (
            <section>
              <label style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:'8px'}}>{t('Media','Media')} ({selectedPhotoIndexes.length}/{photos.length})</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'8px'}}>
                {photos.map((url, i) => {
                  const sel = selectedPhotoIndexes.includes(i);
                  return (
                    <button key={url} type="button" onClick={() => togglePhoto(i)} style={{position:'relative',aspectRatio:'1',overflow:'hidden',borderRadius:'8px',border:sel?'2px solid var(--primary)':'2px solid transparent',opacity:sel?1:0.5}}>
                      <img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      {sel && <span style={{position:'absolute',top:'4px',right:'4px',background:'var(--primary)',color:'var(--primary-fg)',borderRadius:'50%',width:'18px',height:'18px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700}}>{selectedPhotoIndexes.indexOf(i) + 1}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <label style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:'8px'}}>{t('Schedule','Jadwal')}</label>
            <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
              <button type="button" className={`button ${scheduleMode === 'now' ? 'primary' : 'secondary'}`} onClick={() => setScheduleMode('now')} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
                <Lightning size={14}/> {t('Now','Sekarang')}
              </button>
              <button type="button" className={`button ${scheduleMode === 'schedule' ? 'primary' : 'secondary'}`} onClick={() => setScheduleMode('schedule')} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
                <CalendarBlank size={14}/> {t('Schedule','Jadwal')}
              </button>
            </div>

            {scheduleMode === 'schedule' && (
              <>
                <Calendar mode="single" selected={scheduledDate} onSelect={(date) => setScheduledDate(date ?? undefined)} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} className="rounded-lg border"/>
                <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
                  <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} style={{flex:1,fontSize:'12px',padding:'6px 8px',borderRadius:'6px',border:'1px solid var(--line)'}}/>
                </div>
              </>
            )}
          </section>

          <div style={{display:'flex',justifyContent:'flex-end',gap:'8px'}}>
            <button type="button" className="button secondary" onClick={() => onOpenChange(false)} disabled={publishing}>{t('Cancel','Batal')}</button>
            <button type="button" className="button primary" onClick={() => void handlePublish()} disabled={publishing || !caption.trim() || (scheduleMode === 'schedule' && !scheduledDate)}>
              {publishing ? t('Publishing…','Mempublikasikan…') : scheduleMode === 'schedule' ? t('Schedule','Jadwalkan') : t('Publish','Publikasikan')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
