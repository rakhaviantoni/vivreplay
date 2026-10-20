'use client';

import {useEffect, useMemo, useState} from 'react';
import {
  CopyIcon as Copy,
  CheckIcon as Check,
  WhatsappLogoIcon as WhatsappLogo,
  XLogoIcon as XLogo,
  TelegramLogoIcon as TelegramLogo,
  DownloadSimpleIcon as DownloadSimple,
  MoonIcon as Moon,
  SunIcon as Sun,
} from '@phosphor-icons/react';
import {ShareRouteIcon, VivreMark} from './brand-assets';
import {toast} from 'sonner';
import {Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader} from '@/components/ui/dialog';
import {cardImageUrl} from './card-art';
import type {Card} from '@/packages/card-data/catalog';

export type ShareCardItem = {
  card: Card;
  printingId?: string;
  quantity?: number;
  condition?: string;
  unitAmount?: number;
};

export type ShareButtonProps = {
  title: string;
  path: string;
  privateEntity?: boolean;
  cards?: ShareCardItem[];
  card?: Card;
  subtitle?: string;
  price?: string;
  listingInfo?: {seller?:string;city?:string;expiresAt?:string;timeZone?:string};
  className?: string;
  openOnMount?: boolean;
  hideTrigger?: boolean;
  onOpenChange?: (open: boolean) => void;
  entityType?: 'listing' | 'card';
};

function shareExpiry(value:string,language:'EN'|'ID',preferredTimeZone?:string){
  const timestamp=new Date(value.includes('T')?value:`${value.replace(' ','T')}Z`);
  if(!Number.isFinite(timestamp.getTime()))return '';
  const locale=language==='ID'?'id-ID':'en-US';
  const timeZone=preferredTimeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const dateTime=new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZone}).format(timestamp);
  const offset=new Intl.DateTimeFormat('en-US',{timeZone,timeZoneName:'longOffset'}).formatToParts(timestamp).find(part=>part.type==='timeZoneName')?.value.replace(/^GMT/,'UTC')??'UTC';
  return `${language==='ID'?'Berakhir':'Expires'} ${dateTime} ${offset}`;
}

function fitCanvasText(ctx:CanvasRenderingContext2D,value:string,maxWidth:number){
  let text=value;
  while(text.length>4&&ctx.measureText(text).width>maxWidth)text=`${text.slice(0,-4)}…`;
  return text;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
  ctx.closePath();
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function shareCardImageUrls(card:Card,printingId?:string):string[]{
  void printingId;
  const urls:string[]=[];
  const resolved=cardImageUrl(card);
  if(resolved?.startsWith('/')&&!resolved.startsWith('//'))urls.push(resolved);
  return [...new Set(urls)];
}

async function generateListingCompositeBlob({
  title,
  price,
  subtitle,
  cards,
  link,
  language = 'EN',
  style = 'light',
  entityType = 'listing',
}: {
  title: string;
  price?: string;
  subtitle?: string;
  cards: ShareCardItem[];
  link: string;
  language?: 'EN' | 'ID';
  style?: 'light' | 'dark';
  entityType?: 'listing' | 'card';
}): Promise<Blob | null> {
  const canvasWidth = 1200;
  const paddingX = 54;
  const count = cards.length;

  let cols = 1;
  let cardWidth = 320;
  if (count === 2) {
    cols = 2;
    cardWidth = 270;
  } else if (count === 3) {
    cols = 3;
    cardWidth = 230;
  } else if (count === 4) {
    cols = 4;
    cardWidth = 210;
  } else if (count >= 5 && count <= 8) {
    cols = 4;
    cardWidth = 200;
  } else if (count >= 9) {
    cols = 5;
    cardWidth = 175;
  }

  const cardHeight = Math.round(cardWidth * (580 / 420));
  const rows = Math.ceil(count / cols);
  const gapY = 16;
  const cardInfoHeight = 58;
  const headerHeight = 136;
  const footerHeight = 56;
  const cardsAreaHeight = rows * (cardHeight + cardInfoHeight) + (rows - 1) * gapY;
  const canvasHeight = Math.max(640, headerHeight + cardsAreaHeight + footerHeight + 44);
  const palette = style === 'light' ? {
    bgStart: '#f5f0e6', bgMid: '#eee7d9', bgEnd: '#e8dfcf',
    panel: '#fffaf0', line: '#d8cbb5', ink: '#28251f', muted: '#716a5e', accent: '#b77a19',
    cardFallback: '#f5f0e6', cardText: '#28251f', badge: '#fffaf0', badgeText: '#28251f',
  } : {
    bgStart: '#10141a', bgMid: '#131922', bgEnd: '#171f2b',
    panel: '#10161f', line: '#273344', ink: '#f6f2ea', muted: '#aab4c2', accent: '#e8c47d',
    cardFallback: '#17202c', cardText: '#d5deea', badge: '#1d242d', badgeText: '#fff7e6',
  };

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Listing image background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  bgGrad.addColorStop(0, palette.bgStart);
  bgGrad.addColorStop(0.5, palette.bgMid);
  bgGrad.addColorStop(1, palette.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Quiet border suggesting binder / display case
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 16, 16, canvasWidth - 32, canvasHeight - 32, 14);
  ctx.stroke();

  // Ensure fonts are ready before canvas measurement and rendering
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font wait failures
    }
  }

  // Load brand compass mark & card images concurrently
  const [compassImg, ...loadedCardImages] = await Promise.all([
    loadImg('/brand/vivreplay-compass.png'),
    ...cards.map(async (item) => {
      // Share previews should use the exact printing selected for the listing.
      // Catalog URL reconstruction can point at the standard art when an
      // alternate printing has a different image path.
      for(const url of shareCardImageUrls(item.card,item.printingId)){
        const image=await loadImg(url);
        if(image)return image;
      }
      return null;
    }),
  ]);

  // Keep card shares associated with the library; listings belong to Market.
  const brandY = 56;
  let brandX = paddingX;

  if (compassImg) {
    ctx.drawImage(compassImg, brandX, brandY - 20, 24, 24);
    brandX += 32;
  }

  ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = palette.ink;
  ctx.fillText('VivrePlay', brandX, brandY - 2);
  const vpWidth = ctx.measureText('VivrePlay').width;
  brandX += vpWidth + 8;

  if (entityType === 'listing') {
    ctx.font = '400 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.muted;
    ctx.fillText('|', brandX, brandY - 3);
    brandX += 14;

    ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.accent;
    ctx.fillText('Market', brandX, brandY - 2);
  }

  // Price badge on the right
  if (price) {
    ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.accent;
    ctx.textAlign = 'right';
    ctx.fillText(price, canvasWidth - paddingX, brandY);
    ctx.textAlign = 'left';
  }

  // Display listing title in Plus Jakarta Sans
  ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = palette.ink;
  let displayTitle = title;
  if (displayTitle.length > 52) {
    displayTitle = displayTitle.slice(0, 49) + '…';
  }
  ctx.fillText(displayTitle, paddingX, 96);

  // Subtitle in Manrope
  if (subtitle) {
    ctx.font = '600 13px "Manrope", sans-serif';
    ctx.fillStyle = palette.muted;
    ctx.fillText(fitCanvasText(ctx,subtitle,canvasWidth-paddingX*2), paddingX, 120);
  }

  // Divider rule
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingX, 136);
  ctx.lineTo(canvasWidth - paddingX, 136);
  ctx.stroke();

  // Cards grid placement
  const availableWidth = canvasWidth - paddingX * 2;
  const gapX = 18;
  const gridWidth = cols * cardWidth + (cols - 1) * gapX;
  const gridStartX = paddingX + Math.max(0, (availableWidth - gridWidth) / 2);
  const startY = 162;

  for (let i = 0; i < count; i++) {
    const item = cards[i];
    const img = loadedCardImages[i];
    const r = Math.floor(i / cols);
    const c = i % cols;
    const cardX = gridStartX + c * (cardWidth + gapX);
    const cardY = startY + r * (cardHeight + cardInfoHeight + gapY);

    // Show duplicate copies as a small physical stack behind the top card.
    const stackLayers = Math.min(2, Math.max(0, Math.ceil((item.quantity ?? 1) - 1)));
    for (let layer = stackLayers; layer > 0; layer--) {
      const layerX = cardX + layer * 5;
      const layerY = cardY - layer * 4;
      ctx.save();
      ctx.fillStyle = palette.panel;
      drawRoundedRect(ctx, layerX, layerY, cardWidth, cardHeight, 7);
      ctx.fill();
      ctx.save();
      drawRoundedRect(ctx, layerX, layerY, cardWidth, cardHeight, 7);
      ctx.clip();
      if (img) ctx.drawImage(img, layerX, layerY, cardWidth, cardHeight);
      else {
        ctx.fillStyle = palette.cardFallback;
        ctx.fillRect(layerX, layerY, cardWidth, cardHeight);
      }
      ctx.restore();
      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, layerX, layerY, cardWidth, cardHeight, 7);
      ctx.stroke();
      ctx.restore();
    }

    // Realistic physical card shadow
    ctx.save();
    ctx.shadowColor = style === 'light' ? 'rgba(49, 38, 19, 0.18)' : 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = palette.panel;
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 7);
    ctx.fill();
    ctx.restore();

    // Clipped card art
    ctx.save();
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 7);
    ctx.clip();
    if (img) {
      ctx.drawImage(img, cardX, cardY, cardWidth, cardHeight);
    } else {
      ctx.fillStyle = palette.cardFallback;
      ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
      ctx.fillStyle = palette.cardText;
      ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(item.card.name, cardX + 12, cardY + cardHeight / 2);
    }
    ctx.restore();

    // Card border
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 7);
    ctx.stroke();

    // VivrePlay stack badge for count > 1
    if (item.quantity && item.quantity > 1) {
      const badgeW = 38;
      const badgeH = 22;
      const badgeX = cardX + cardWidth - badgeW - 6;
      const badgeY = cardY + cardHeight - badgeH - 6;

      ctx.save();
      ctx.fillStyle = palette.badge;
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 11);
      ctx.fill();
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 11);
      ctx.stroke();

      ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = palette.badgeText;
      ctx.textAlign = 'center';
      ctx.fillText(`×${item.quantity}`, badgeX + badgeW / 2, badgeY + 15);
      ctx.restore();
    }

    // Listing details stay attached to each card in the grid.
    ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.ink;
    ctx.textAlign = 'center';
    const maxLabelWidth = cardWidth - 8;
    let nameLabel = item.card.name;
    while (nameLabel.length > 3 && ctx.measureText(nameLabel).width > maxLabelWidth) nameLabel = `${nameLabel.slice(0, -2)}…`;
    ctx.fillText(nameLabel, cardX + cardWidth / 2, cardY + cardHeight + 16);
    ctx.font = '600 10px "Manrope", sans-serif';
    ctx.fillStyle = palette.muted;
    const cardDetails = [item.card.code, item.condition].filter(Boolean).join(' / ');
    ctx.fillText(cardDetails, cardX + cardWidth / 2, cardY + cardHeight + 32);
    if (typeof item.unitAmount === 'number' && item.unitAmount > 0) {
      ctx.font = '800 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = palette.accent;
      const unitPrice = new Intl.NumberFormat(language === 'ID' ? 'id-ID' : 'en-ID', {style: 'currency', currency: 'IDR', maximumFractionDigits: 0}).format(item.unitAmount);
      ctx.fillText(`${unitPrice} / ${language === 'ID' ? 'kartu' : 'card'}`, cardX + cardWidth / 2, cardY + cardHeight + 50);
    }
    ctx.textAlign = 'left';
  }

  // Footer rule & provenance in Manrope
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingX, canvasHeight - 48);
  ctx.lineTo(canvasWidth - paddingX, canvasHeight - 48);
  ctx.stroke();

  const footerY = canvasHeight - 24;
  if (compassImg) ctx.drawImage(compassImg, paddingX, footerY - 13, 18, 18);
  ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = palette.ink;
  ctx.fillText('VivrePlay', paddingX + 25, footerY);
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.muted;
  ctx.font = '600 11px "Manrope", sans-serif';
  ctx.fillText(link, canvasWidth - paddingX, footerY, 500);
  ctx.textAlign = 'left';

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export function ShareButton({
  title,
  path,
  privateEntity = false,
  cards,
  card,
  subtitle,
  price,
  listingInfo,
  className = '',
  openOnMount = false,
  hideTrigger = false,
  onOpenChange,
  entityType = 'listing',
}: ShareButtonProps) {
  const [open, setOpen] = useState(openOnMount);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'ID'>('EN');
  const [shareStyle, setShareStyle] = useState<'light' | 'dark'>('light');
  const [imagePreview, setImagePreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const sync = () => setLanguage(window.localStorage.getItem('vivreplay-locale') === 'ID' ? 'ID' : 'EN');
    const onLocale = (event: Event) => setLanguage((event as CustomEvent<'EN' | 'ID'>).detail === 'ID' ? 'ID' : 'EN');
    sync();
    window.addEventListener('vivreplay:locale', onLocale);
    return () => window.removeEventListener('vivreplay:locale', onLocale);
  }, []);

  const cardList: ShareCardItem[] = useMemo(() => cards && cards.length > 0 ? cards : card ? [{card, quantity: 1}] : [], [cards, card]);

  const url = typeof window === 'undefined' ? path : new URL(path, window.location.origin).href;
  const imageLink = `vivreplay.com${new URL(path, 'https://vivreplay.com').pathname}`;
  const imageSubtitle=[subtitle,listingInfo?.city,listingInfo?.seller?`${language==='ID'?'oleh':'by'} ${listingInfo.seller}`:'',listingInfo?.expiresAt?shareExpiry(listingInfo.expiresAt,language,listingInfo.timeZone):''].filter(Boolean).join(' | ');
  const entityLabel = entityType === 'card' ? (language === 'ID' ? 'kartu' : 'card') : 'listing';
  const imageFileLabel = entityType === 'card' ? 'card' : 'listing';

  useEffect(() => {
    if (!open || cardList.length === 0) return;
    let active = true;
    setPreviewLoading(true);
    setImagePreview('');
    void generateListingCompositeBlob({title,price,subtitle:imageSubtitle,cards:cardList,link:imageLink,language,style:shareStyle,entityType}).then(blob => {
      if (!active || !blob) return;
      setImagePreview(URL.createObjectURL(blob));
    }).catch(() => {}).finally(() => { if (active) setPreviewLoading(false); });
    return () => { active = false; };
  }, [open,cardList,title,price,imageSubtitle,imageLink,listingInfo,language,shareStyle,entityType]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(language === 'ID' ? 'Tautan disalin ke papan klip' : 'Link copied to clipboard');
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      toast.error(language === 'ID' ? 'Gagal menyalin. Silakan pilih dan salin tautan secara manual.' : 'Copy unavailable. Please select and copy the link.');
    }
  };

  const handleDownloadListingImage = async () => {
    if (cardList.length === 0) return;
    setDownloading(true);
    try {
      const blob = await generateListingCompositeBlob({
        title,
        price,
        subtitle:imageSubtitle,
        cards: cardList,
        link: imageLink,
        language,
        style: shareStyle,
        entityType,
      });
      if (!blob) throw new Error('Image generation failed');

      const previewUrl = URL.createObjectURL(blob);
      setImagePreview((old) => { if (old) URL.revokeObjectURL(old); return previewUrl; });

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${title.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}_${imageFileLabel}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      toast.success(entityType === 'card'
        ? (language === 'ID' ? 'Gambar kartu tersimpan' : 'Card image saved')
        : (language === 'ID' ? 'Gambar listing tersimpan' : 'Listing image saved'));
    } catch {
      toast.error(entityType === 'card'
        ? (language === 'ID' ? 'Gagal membuat gambar kartu' : 'Could not generate card image')
        : (language === 'ID' ? 'Gagal membuat gambar listing' : 'Could not generate listing image'));
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && Boolean(navigator.share)) {
      try {
        if (imagePreview) {
          const response = await fetch(imagePreview);
          const file = new File([await response.blob()], `${title.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}_${imageFileLabel}.png`, {type: 'image/png'});
          if (navigator.canShare?.({files: [file]})) { await navigator.share({title, text: subtitle, url, files: [file]}); return; }
        }
        await navigator.share({title, text: subtitle, url});
      } catch {
        // User cancelled or dismissed share sheet
      }
    }
  };

  return (
    <>
      {!hideTrigger && <button
        type="button"
        className={`share-action-button button secondary ${className}`}
        onClick={() => { setOpen(true); onOpenChange?.(true); }}
        aria-label={language === 'ID' ? `Bagikan ${title}` : `Share ${title}`}
      >
        <ShareRouteIcon size={15} />
        <span>{language === 'ID' ? 'Bagikan' : 'Share'}</span>
      </button>}

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); onOpenChange?.(next); }}>
        <DialogContent className="share-dialog-content">
          <DialogHeader className="share-dialog-header">
            <div className={`share-brand-lockup${entityType === 'card' ? ' is-library-share' : ''}`}>
              <VivreMark size={20} />
              <span>VivrePlay</span>
              {entityType !== 'card' && <><i>|</i><b>Market</b></>}
            </div>
            <DialogTitle>{entityType === 'card'
              ? (language === 'ID' ? 'Bagikan kartu' : 'Share card')
              : (language === 'ID' ? 'Bagikan listing' : 'Share listing')}</DialogTitle>
            <DialogDescription>
              {entityType === 'card'
                ? (language === 'ID' ? 'Bagikan kartu lewat tautan atau gambar.' : 'Share this card with a link or image.')
                : privateEntity
                ? (language === 'ID' ? 'Listing ini bersifat privat. Hanya Anda yang dapat membuka tautan ini.' : 'This listing is private. Only you can open this link.')
                : (language === 'ID' ? 'Bagikan listing lewat tautan atau gambar.' : 'Share this listing with a link or image.')}
            </DialogDescription>
          </DialogHeader>

          {cardList.length > 0 && (
            <div className="share-preview-listing">
              <div className="share-preview-canvas">
                <div className="share-preview-style-picker">
                  <button
                    type="button"
                    className="share-preview-theme-toggle"
                    aria-label={shareStyle === 'light'
                      ? (language === 'ID' ? 'Gunakan tema gelap' : 'Use dark image theme')
                      : (language === 'ID' ? 'Gunakan tema terang' : 'Use light image theme')}
                    aria-pressed={shareStyle === 'dark'}
                    onClick={() => setShareStyle(current => current === 'light' ? 'dark' : 'light')}
                  >
                    {shareStyle === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
                  </button>
                </div>
                {previewLoading && <div className="share-listing-image-loading" aria-label={language === 'ID' ? 'Memuat pratinjau' : 'Loading preview'} />}
                {!previewLoading && imagePreview && <img className="share-listing-image-preview" src={imagePreview} alt={language === 'ID' ? `Gambar ${entityLabel} ${title}` : `${entityLabel[0].toUpperCase()}${entityLabel.slice(1)} image for ${title}`} />}
                {!previewLoading && !imagePreview && <p className="share-preview-error" role="status">{language === 'ID' ? 'Pratinjau gambar tidak tersedia.' : 'Image preview is unavailable.'}</p>}
              </div>
              <button
                type="button"
                className="share-preview-save-btn"
                onClick={handleDownloadListingImage}
                disabled={downloading}
              >
                <DownloadSimple size={15} />
                <span>{downloading ? (language === 'ID' ? 'Membuat gambar...' : 'Creating image...') : entityType === 'card'
                  ? (language === 'ID' ? 'Simpan gambar kartu' : 'Save card image')
                  : (language === 'ID' ? 'Simpan gambar listing' : 'Save listing image')}</span>
              </button>
            </div>
          )}

          <div className="share-link-box">
            <input
              type="text"
              readOnly
              value={url}
              className="share-link-input"
              onFocus={(e) => e.target.select()}
              aria-label={language === 'ID' ? `Tautan ${entityLabel}` : `${entityLabel[0].toUpperCase()}${entityLabel.slice(1)} share link`}
            />
            <button
              type="button"
              className="button share-copy-btn"
              onClick={handleCopy}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              <span>{copied ? (language === 'ID' ? 'Tersalin!' : 'Copied!') : (language === 'ID' ? 'Salin' : 'Copy')}</span>
            </button>
          </div>

          {!privateEntity && (
            <div className="share-channels-grid">
              <a
                className="share-channel-btn whatsapp"
                href={`https://wa.me/?text=${encodeURIComponent(`${title} - ${url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsappLogo size={18} weight="fill" />
                <span>WhatsApp</span>
              </a>
              <a
                className="share-channel-btn x-social"
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <XLogo size={18} weight="bold" />
                <span>X</span>
              </a>
              <a
                className="share-channel-btn telegram"
                href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <TelegramLogo size={18} weight="fill" />
                <span>Telegram</span>
              </a>
            </div>
          )}

          {!privateEntity && typeof navigator !== 'undefined' && Boolean(navigator.share) && (
            <button
              type="button"
              className="button secondary share-native-btn"
              onClick={handleNativeShare}
            >
              <ShareRouteIcon size={15} />
              <span>{language === 'ID' ? 'Opsi berbagi lainnya' : 'More sharing options'}</span>
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
