import {
  SOCIAL_ASSET_DIMENSIONS,
  type SocialAssetConfig,
} from '@/lib/social-brand-kit';

function loadCanvasImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines && words.length > 0) {
    let last = lines[maxLines - 1] ?? '';
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) {
      last = last.slice(0, -1).trimEnd();
    }
    if (words.join(' ').length > lines.join(' ').length) {
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

export async function renderBrandSocialCanvas(
  canvas: HTMLCanvasElement,
  config: SocialAssetConfig,
): Promise<void> {
  const { width, height } = SOCIAL_ASSET_DIMENSIONS[config.format];
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font load errors
    }
  }

  const palette =
    config.theme === 'light'
      ? {
          bgStart: '#f5f0e6',
          bgMid: '#eee7d9',
          bgEnd: '#e8dfcf',
          panel: '#fffaf0',
          panelSoft: 'rgba(255, 250, 240, 0.72)',
          line: '#d8cbb5',
          ink: '#28251f',
          muted: '#716a5e',
          accent: '#b77a19',
          accentSoft: 'rgba(183, 122, 25, 0.12)',
          badgeBg: '#fffaf0',
          badgeText: '#28251f',
        }
      : {
          bgStart: '#10141a',
          bgMid: '#131922',
          bgEnd: '#171f2b',
          panel: '#10161f',
          panelSoft: 'rgba(16, 22, 31, 0.84)',
          line: '#273344',
          ink: '#f6f2ea',
          muted: '#aab4c2',
          accent: '#e8c47d',
          accentSoft: 'rgba(232, 196, 125, 0.12)',
          badgeBg: '#1d242d',
          badgeText: '#fff7e6',
        };

  // Exact VivrePlay share background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, palette.bgStart);
  bgGrad.addColorStop(0.5, palette.bgMid);
  bgGrad.addColorStop(1, palette.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle top-right brass glow matching VivrePlay hero surfaces
  const glow = ctx.createRadialGradient(
    width * 0.84,
    height * 0.16,
    10,
    width * 0.84,
    height * 0.16,
    Math.max(width, height) * 0.52,
  );
  glow.addColorStop(
    0,
    config.theme === 'light'
      ? 'rgba(183, 122, 25, 0.10)'
      : 'rgba(232, 196, 125, 0.10)',
  );
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Outer frame border matching share.tsx (16px inset, 1.5px stroke, 14px radius)
  const inset = config.format === 'banner' ? 16 : 24;
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, inset, inset, width - inset * 2, height - inset * 2, 16);
  ctx.stroke();

  const [compassImg, opLogoImg, pkmnLogoImg] = await Promise.all([
    loadCanvasImage('/brand/vivreplay-compass.png'),
    loadCanvasImage('/assets/one-piece-card-game-logo.png'),
    loadCanvasImage('/assets/pokemon-card-game-logo.png'),
  ]);

  const pad = config.format === 'banner' ? 56 : config.format === 'og' ? 60 : 72;
  const contentWidth = width - pad * 2;

  // Header brand lockup matching navbar & footer: [Compass] VivrePlay | Market
  const brandSize = config.format === 'banner' ? 42 : config.format === 'story' ? 54 : 46;
  const headerY = config.format === 'banner' ? 44 : config.format === 'story' ? 76 : 64;

  if (compassImg) {
    ctx.drawImage(compassImg, pad, headerY, brandSize, brandSize);
  }
  let brandCursorX = pad + brandSize + 14;
  ctx.font = `800 ${config.format === 'banner' ? 24 : 28}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = palette.ink;
  ctx.textBaseline = 'middle';
  ctx.fillText('VivrePlay', brandCursorX, headerY + brandSize / 2);
  brandCursorX += ctx.measureText('VivrePlay').width + 14;

  if (config.showMarketBadge) {
    ctx.fillStyle = palette.line;
    ctx.fillRect(brandCursorX, headerY + 8, 1.5, brandSize - 16);
    brandCursorX += 14;
    ctx.font = `700 ${config.format === 'banner' ? 20 : 23}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = palette.accent;
    ctx.fillText('Market', brandCursorX, headerY + brandSize / 2);
  }

  // Right-side game logos (One Piece & Pokémon) in header
  const logoMaxH = config.format === 'banner' ? 30 : 34;
  let rightX = width - pad;
  if (pkmnLogoImg) {
    const scale = logoMaxH / (pkmnLogoImg.naturalHeight || pkmnLogoImg.height || 1);
    const drawW = (pkmnLogoImg.naturalWidth || pkmnLogoImg.width) * scale;
    rightX -= drawW;
    ctx.drawImage(pkmnLogoImg, rightX, headerY + (brandSize - logoMaxH) / 2, drawW, logoMaxH);
    rightX -= 18;
  }
  if (opLogoImg) {
    const scale = logoMaxH / (opLogoImg.naturalHeight || opLogoImg.height || 1);
    const drawW = (opLogoImg.naturalWidth || opLogoImg.width) * scale;
    rightX -= drawW;
    ctx.save();
    if (config.theme === 'dark') {
      ctx.filter = 'invert(1)';
    }
    ctx.drawImage(opLogoImg, rightX, headerY + (brandSize - logoMaxH) / 2, drawW, logoMaxH);
    ctx.restore();
  }

  ctx.textBaseline = 'alphabetic';

  if (config.format === 'banner') {
    // Horizontal 1500x500 layout
    const panelY = 120;
    const panelH = height - panelY - 44;
    ctx.fillStyle = palette.panelSoft;
    drawRoundedRect(ctx, pad, panelY, contentWidth, panelH, 16);
    ctx.fill();
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1.25;
    drawRoundedRect(ctx, pad, panelY, contentWidth, panelH, 16);
    ctx.stroke();

    const innerX = pad + 44;
    let y = panelY + 56;

    ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.accent;
    ctx.fillText(config.eyebrow.toUpperCase(), innerX, y);
    y += 48;

    ctx.font = '800 44px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.ink;
    const hLines = wrapLines(ctx, config.headline, contentWidth * 0.62, 2);
    for (const line of hLines) {
      ctx.fillText(line, innerX, y);
      y += 52;
    }

    y += 6;
    ctx.font = '500 20px "Manrope", sans-serif';
    ctx.fillStyle = palette.muted;
    const sLines = wrapLines(ctx, config.subheadline, contentWidth * 0.62, 2);
    for (const line of sLines) {
      ctx.fillText(line, innerX, y);
      y += 28;
    }

    // Right column chips + URL pill
    const colX = pad + contentWidth * 0.68;
    let chipY = panelY + 56;
    ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
    for (const chip of config.chips.slice(0, 4)) {
      const chipW = Math.min(contentWidth * 0.28, ctx.measureText(chip).width + 32);
      ctx.fillStyle = palette.badgeBg;
      drawRoundedRect(ctx, colX, chipY, chipW, 40, 20);
      ctx.fill();
      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, colX, chipY, chipW, 40, 20);
      ctx.stroke();
      ctx.fillStyle = palette.ink;
      ctx.fillText(chip, colX + 16, chipY + 25);
      chipY += 52;
    }

    ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.accent;
    ctx.fillText(config.ctaUrl, colX, panelY + panelH - 32);
    return;
  }

  // Square (1080x1080), OG (1200x630), Story (1080x1920)
  const isStory = config.format === 'story';
  const isOg = config.format === 'og';

  const panelY = headerY + brandSize + (isOg ? 28 : isStory ? 64 : 44);
  const footerReserve = isOg ? 74 : isStory ? 130 : 96;
  const panelH = height - panelY - footerReserve;

  ctx.fillStyle = palette.panelSoft;
  drawRoundedRect(ctx, pad, panelY, contentWidth, panelH, 20);
  ctx.fill();
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, pad, panelY, contentWidth, panelH, 20);
  ctx.stroke();

  const innerPad = isOg ? 44 : 56;
  const innerX = pad + innerPad;
  const innerW = contentWidth - innerPad * 2;
  let y = panelY + (isOg ? 56 : isStory ? 120 : 76);

  // Eyebrow pill
  ctx.font = `800 ${isOg ? 13 : 15}px "Plus Jakarta Sans", sans-serif`;
  const eyebrowText = config.eyebrow.toUpperCase();
  const eyebrowW = ctx.measureText(eyebrowText).width + 28;
  ctx.fillStyle = palette.accentSoft;
  drawRoundedRect(ctx, innerX, y - 22, eyebrowW, 34, 17);
  ctx.fill();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, innerX, y - 22, eyebrowW, 34, 17);
  ctx.stroke();
  ctx.fillStyle = palette.accent;
  ctx.fillText(eyebrowText, innerX + 14, y);
  y += isOg ? 56 : isStory ? 84 : 68;

  // Headline
  const headSize = isOg ? 46 : isStory ? 68 : 58;
  const headLH = isOg ? 56 : isStory ? 82 : 70;
  ctx.font = `800 ${headSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = palette.ink;
  const hLines = wrapLines(ctx, config.headline, innerW, isOg ? 2 : 4);
  for (const line of hLines) {
    ctx.fillText(line, innerX, y);
    y += headLH;
  }

  y += isOg ? 14 : 24;

  // Subheadline
  const subSize = isOg ? 22 : isStory ? 30 : 26;
  const subLH = isOg ? 32 : isStory ? 44 : 38;
  ctx.font = `500 ${subSize}px "Manrope", sans-serif`;
  ctx.fillStyle = palette.muted;
  const sLines = wrapLines(ctx, config.subheadline, innerW, isOg ? 2 : 4);
  for (const line of sLines) {
    ctx.fillText(line, innerX, y);
    y += subLH;
  }

  // Feature chips anchored inside bottom of panel
  const chipH = isOg ? 42 : isStory ? 56 : 50;
  const chipFontSize = isOg ? 16 : isStory ? 21 : 18;
  ctx.font = `700 ${chipFontSize}px "Plus Jakarta Sans", sans-serif`;

  let chipX = innerX;
  let chipY = panelY + panelH - innerPad - chipH;
  if (isStory && config.chips.length > 2) {
    chipY -= chipH + 16;
  }
  for (const chip of config.chips) {
    const chipW = ctx.measureText(chip).width + 36;
    if (chipX + chipW > innerX + innerW) {
      chipX = innerX;
      chipY += chipH + 14;
    }
    ctx.fillStyle = palette.badgeBg;
    drawRoundedRect(ctx, chipX, chipY, chipW, chipH, chipH / 2);
    ctx.fill();
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1.25;
    drawRoundedRect(ctx, chipX, chipY, chipW, chipH, chipH / 2);
    ctx.stroke();
    ctx.fillStyle = palette.ink;
    ctx.textBaseline = 'middle';
    ctx.fillText(chip, chipX + 18, chipY + chipH / 2);
    ctx.textBaseline = 'alphabetic';
    chipX += chipW + 14;
  }

  // Footer CTA bar matching share.tsx
  const footerY = height - (isOg ? 36 : isStory ? 66 : 48);
  ctx.font = `700 ${isOg ? 19 : isStory ? 24 : 21}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = palette.accent;
  ctx.fillText(config.ctaUrl, pad, footerY);

  const tagline =
    config.locale === 'ID'
      ? 'One Piece & Pokémon TCG'
      : 'One Piece & Pokémon TCG';
  ctx.font = `600 ${isOg ? 16 : 18}px "Manrope", sans-serif`;
  ctx.fillStyle = palette.muted;
  const tagW = ctx.measureText(tagline).width;
  ctx.fillText(tagline, width - pad - tagW, footerY);
}
