'use client';

import {useEffect, useMemo, useState} from 'react';
import {
  CopyIcon as Copy,
  CheckIcon as Check,
  WhatsappLogoIcon as WhatsappLogo,
  XLogoIcon as XLogo,
  TelegramLogoIcon as TelegramLogo,
  DownloadSimpleIcon as DownloadSimple,
} from '@phosphor-icons/react';
import {ShareRouteIcon, VivreMark} from './brand-assets';
import {toast} from 'sonner';
import {Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader} from '@/components/ui/dialog';
import {CardArt, cardImageUrl} from './card-art';
import type {Card} from '@/packages/card-data/catalog';

export type ShareCardItem = {
  card: Card;
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
  className?: string;
  openOnMount?: boolean;
  hideTrigger?: boolean;
  onOpenChange?: (open: boolean) => void;
};

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

async function generateListingCompositeBlob({
  title,
  price,
  subtitle,
  cards,
  language = 'EN',
}: {
  title: string;
  price?: string;
  subtitle?: string;
  cards: ShareCardItem[];
  language?: 'EN' | 'ID';
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
  const gapY = 24;
  const headerHeight = 136;
  const footerHeight = 56;
  const cardsAreaHeight = rows * (cardHeight + 28) + (rows - 1) * gapY;
  const canvasHeight = Math.max(640, headerHeight + cardsAreaHeight + footerHeight + 44);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Obsidian card-table background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  bgGrad.addColorStop(0, '#10141a');
  bgGrad.addColorStop(0.5, '#131922');
  bgGrad.addColorStop(1, '#171f2b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Quiet border suggesting binder / display case
  ctx.strokeStyle = '#273344';
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
      const url = cardImageUrl(item.card);
      if (!url) return null;
      return loadImg(url);
    }),
  ]);

  // VivrePlay | Market navbar-style header brand lockup
  const brandY = 56;
  let brandX = paddingX;

  if (compassImg) {
    ctx.drawImage(compassImg, brandX, brandY - 20, 24, 24);
    brandX += 32;
  }

  ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#f0ebe1';
  ctx.fillText('VivrePlay', brandX, brandY - 2);
  const vpWidth = ctx.measureText('VivrePlay').width;
  brandX += vpWidth + 8;

  ctx.font = '400 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#4f5e71';
  ctx.fillText('|', brandX, brandY - 3);
  brandX += 14;

  ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#c58b28';
  ctx.fillText('Market', brandX, brandY - 2);

  // Price badge on the right
  if (price) {
    ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#e8c47d';
    ctx.textAlign = 'right';
    ctx.fillText(price, canvasWidth - paddingX, brandY);
    ctx.textAlign = 'left';
  }

  // Display listing title in Plus Jakarta Sans
  ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#f6f2ea';
  let displayTitle = title;
  if (displayTitle.length > 52) {
    displayTitle = displayTitle.slice(0, 49) + '…';
  }
  ctx.fillText(displayTitle, paddingX, 96);

  // Subtitle in Manrope
  if (subtitle) {
    ctx.font = '600 13px "Manrope", sans-serif';
    ctx.fillStyle = '#8e9aa8';
    ctx.fillText(subtitle, paddingX, 120);
  }

  // Divider rule
  ctx.strokeStyle = '#222d3b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingX, 136);
  ctx.lineTo(canvasWidth - paddingX, 136);
  ctx.stroke();

  // Cards grid placement
  const availableWidth = canvasWidth - paddingX * 2;
  const gapX = cols > 1 ? Math.floor((availableWidth - cols * cardWidth) / (cols - 1)) : 0;
  const gridStartX = paddingX + (availableWidth - (cols * cardWidth + (cols - 1) * gapX)) / 2;
  const startY = 162;

  for (let i = 0; i < count; i++) {
    const item = cards[i];
    const img = loadedCardImages[i];
    const r = Math.floor(i / cols);
    const c = i % cols;
    const cardX = gridStartX + c * (cardWidth + gapX);
    const cardY = startY + r * (cardHeight + 28 + gapY);

    // Realistic physical card shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#10161f';
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
      ctx.fillStyle = '#17202c';
      ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
      ctx.fillStyle = '#d5deea';
      ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(item.card.name, cardX + 12, cardY + cardHeight / 2);
    }
    ctx.restore();

    // Card border
    ctx.strokeStyle = '#324053';
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
      ctx.fillStyle = '#1d242d';
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 11);
      ctx.fill();
      ctx.strokeStyle = '#c58b28';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 11);
      ctx.stroke();

      ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#fff7e6';
      ctx.textAlign = 'center';
      ctx.fillText(`×${item.quantity}`, badgeX + badgeW / 2, badgeY + 15);
      ctx.restore();
    }

    // Specimen label under card in Manrope
    ctx.font = '700 12px "Manrope", sans-serif';
    ctx.fillStyle = '#d1d8e3';
    ctx.textAlign = 'center';
    const conditionTag = item.condition ? ` · ${item.condition}` : '';
    const rarityTag = item.card.rarity ? ` · ${item.card.rarity}` : '';
    const label = `${item.card.code}${rarityTag}${conditionTag}`;
    ctx.fillText(label, cardX + cardWidth / 2, cardY + cardHeight + 18);
    ctx.textAlign = 'left';
  }

  // Footer rule & provenance in Manrope
  ctx.strokeStyle = '#222d3b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingX, canvasHeight - 48);
  ctx.lineTo(canvasWidth - paddingX, canvasHeight - 48);
  ctx.stroke();

  const footerY = canvasHeight - 24;
  if (compassImg) ctx.drawImage(compassImg, paddingX, footerY - 13, 18, 18);
  ctx.font = '500 11px "Manrope", sans-serif';
  ctx.fillStyle = '#8997a9';
  ctx.fillText('Powered by', paddingX + 25, footerY);
  const poweredWidth = ctx.measureText('Powered by').width;
  ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#f0ebe1';
  ctx.fillText('VivrePlay', paddingX + 31 + poweredWidth, footerY);
  ctx.font = '500 10px "Manrope", sans-serif';
  ctx.fillStyle = '#657487';
  ctx.fillText('vivreplay.com', paddingX + 31 + poweredWidth + ctx.measureText('VivrePlay').width + 10, footerY);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#8997a9';
  ctx.font = '600 12px "Manrope", sans-serif';
  ctx.fillText('Card Listing Showcase', canvasWidth - paddingX, canvasHeight - 24);
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
  className = '',
  openOnMount = false,
  hideTrigger = false,
  onOpenChange,
}: ShareButtonProps) {
  const [open, setOpen] = useState(openOnMount);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'ID'>('EN');
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    const sync = () => setLanguage(window.localStorage.getItem('vivreplay-locale') === 'ID' ? 'ID' : 'EN');
    const onLocale = (event: Event) => setLanguage((event as CustomEvent<'EN' | 'ID'>).detail === 'ID' ? 'ID' : 'EN');
    sync();
    window.addEventListener('vivreplay:locale', onLocale);
    return () => window.removeEventListener('vivreplay:locale', onLocale);
  }, []);

  const cardList: ShareCardItem[] = useMemo(() => cards && cards.length > 0 ? cards : card ? [{card, quantity: 1}] : [], [cards, card]);

  const url = typeof window === 'undefined' ? path : new URL(path, window.location.origin).href;

  useEffect(() => {
    if (!open || cardList.length === 0 || imagePreview) return;
    let active = true;
    void generateListingCompositeBlob({title,price,subtitle,cards:cardList,language}).then(blob => {
      if (!active || !blob) return;
      setImagePreview(URL.createObjectURL(blob));
    }).catch(() => {});
    return () => { active = false; };
  }, [open,cardList,imagePreview,title,price,subtitle,language]);

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
        subtitle,
        cards: cardList,
        language,
      });
      if (!blob) throw new Error('Image generation failed');

      const previewUrl = URL.createObjectURL(blob);
      setImagePreview((old) => { if (old) URL.revokeObjectURL(old); return previewUrl; });

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${title.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}_listing.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      toast.success(language === 'ID' ? 'Gambar listing tersimpan' : 'Listing image saved');
    } catch {
      toast.error(language === 'ID' ? 'Gagal membuat gambar listing' : 'Could not generate listing image');
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
          const file = new File([await response.blob()], `${title.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}_listing.png`, {type: 'image/png'});
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
            <div className="share-brand-lockup">
              <VivreMark size={20} />
              <span>VivrePlay</span>
              <i>|</i>
              <b>Market</b>
            </div>
            <DialogTitle>{language === 'ID' ? 'Bagikan listing' : 'Share listing'}</DialogTitle>
            <DialogDescription>
              {privateEntity
                ? (language === 'ID' ? 'Listing ini bersifat privat. Hanya Anda yang dapat membuka tautan ini.' : 'This listing is private. Only you can open this link.')
                : (language === 'ID' ? 'Bagikan ke pemain lain atau simpan gambar showcase.' : 'Share with other players or save the showcase card.')}
            </DialogDescription>
          </DialogHeader>

          {cardList.length > 0 && (
            <div className="share-preview-listing">
              {imagePreview && <img className="share-listing-image-preview" src={imagePreview} alt={language === 'ID' ? `Gambar listing ${title}` : `${title} listing image`} />}
              <div className="share-preview-header">
                <div className="share-preview-meta">
                  <h3 className="share-preview-title">{title}</h3>
                  {subtitle && <span className="share-preview-sub">{subtitle}</span>}
                </div>
                {price && <span className="share-preview-price">{price}</span>}
              </div>

              <div className="share-cards-grid-preview">
                {cardList.map((item, index) => (
                  <div
                    className="share-card-thumb"
                    key={item.card.id ?? `${item.card.code}-${index}`}
                    title={`${item.card.name} (${item.card.code})`}
                  >
                    <div className="share-card-thumb-art">
                      <CardArt card={item.card} small />
                    </div>
                    {item.quantity && item.quantity > 1 ? (
                      <span className="share-card-qty">×{item.quantity}</span>
                    ) : null}
                    <span className="share-card-code">{item.card.code}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="share-preview-save-btn"
                onClick={handleDownloadListingImage}
                disabled={downloading}
              >
                <DownloadSimple size={15} />
                <span>{downloading ? (language === 'ID' ? 'Membuat gambar showcase...' : 'Creating showcase card...') : (language === 'ID' ? 'Simpan gambar listing' : 'Save listing image')}</span>
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
              aria-label={language === 'ID' ? 'Tautan listing' : 'Listing share link'}
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
