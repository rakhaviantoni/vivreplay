import { GAME_LOGOS } from '@/components/tcg/brand-assets';
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
    while (ctx.measureText(`${last}...`).width > maxWidth && last.length > 1) {
      last = last.slice(0, -1).trimEnd();
    }
    if (words.join(' ').length > lines.join(' ').length) {
      lines[maxLines - 1] = `${last}...`;
    }
  }
  return lines;
}

function drawFannedCards(
  ctx: CanvasRenderingContext2D,
  cards: Array<HTMLImageElement | null>,
  centerX: number,
  centerY: number,
  cardW: number,
  cardH: number,
  borderColor: string,
  shadowColor: string,
) {
  const specs = [
    { img: cards[0], angle: -0.14, dx: -cardW * 0.42, dy: cardH * 0.04, scale: 0.92 },
    { img: cards[2], angle: 0.14, dx: cardW * 0.42, dy: cardH * 0.05, scale: 0.92 },
    { img: cards[1], angle: 0, dx: 0, dy: -cardH * 0.03, scale: 1 },
  ];

  for (const spec of specs) {
    if (!spec.img) continue;
    const w = cardW * spec.scale;
    const h = cardH * spec.scale;
    ctx.save();
    ctx.translate(centerX + spec.dx, centerY + spec.dy);
    ctx.rotate(spec.angle);

    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#0d1218';
    drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 14);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.save();
    drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 14);
    ctx.clip();
    ctx.drawImage(spec.img, -w / 2, -h / 2, w, h);
    ctx.restore();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 14);
    ctx.stroke();
    ctx.restore();
  }
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
          panelSoft: 'rgba(255, 250, 240, 0.88)',
          line: '#d8cbb5',
          ink: '#28251f',
          muted: '#716a5e',
          accent: '#b77a19',
          accentSoft: 'rgba(183, 122, 25, 0.12)',
          badgeBg: '#fffaf0',
          shadow: 'rgba(49, 38, 19, 0.22)',
        }
      : {
          bgStart: '#10141a',
          bgMid: '#131922',
          bgEnd: '#171f2b',
          panel: '#10161f',
          panelSoft: 'rgba(16, 22, 31, 0.86)',
          line: '#273344',
          ink: '#f6f2ea',
          muted: '#aab4c2',
          accent: '#e8c47d',
          accentSoft: 'rgba(232, 196, 125, 0.12)',
          badgeBg: '#1d242d',
          shadow: 'rgba(0, 0, 0, 0.52)',
        };

  // Exact VivrePlay share background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, palette.bgStart);
  bgGrad.addColorStop(0.5, palette.bgMid);
  bgGrad.addColorStop(1, palette.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle brass radial glow matching VivrePlay hero surfaces
  const glow = ctx.createRadialGradient(
    width * 0.82,
    height * 0.2,
    12,
    width * 0.82,
    height * 0.2,
    Math.max(width, height) * 0.55,
  );
  glow.addColorStop(
    0,
    config.theme === 'light'
      ? 'rgba(183, 122, 25, 0.12)'
      : 'rgba(232, 196, 125, 0.12)',
  );
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Outer frame border matching share.tsx
  const inset = config.format === 'banner' ? 16 : 22;
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, inset, inset, width - inset * 2, height - inset * 2, 14);
  ctx.stroke();

  const [compassImg, opLogoImg, pkmnLogoImg, card0, card1, card2] = await Promise.all([
    loadCanvasImage('/brand/vivreplay-compass.png'),
    loadCanvasImage(GAME_LOGOS['one-piece']),
    loadCanvasImage(GAME_LOGOS.pokemon),
    loadCanvasImage('/art/card-0.webp'),
    loadCanvasImage('/art/card-1.webp'),
    loadCanvasImage('/art/card-2.webp'),
  ]);

  const pad = config.format === 'banner' ? 52 : config.format === 'og' ? 56 : 68;
  const contentWidth = width - pad * 2;

  // Header brand lockup matching navbar & footer: [Compass] VivrePlay | Market
  const brandSize = config.format === 'banner' ? 40 : config.format === 'story' ? 52 : 44;
  const headerY = config.format === 'banner' ? 40 : config.format === 'story' ? 70 : 58;

  if (compassImg) {
    ctx.drawImage(compassImg, pad, headerY, brandSize, brandSize);
  }
  let brandCursorX = pad + brandSize + 14;
  ctx.font = `800 ${config.format === 'banner' ? 23 : 27}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = palette.ink;
  ctx.textBaseline = 'middle';
  ctx.fillText('VivrePlay', brandCursorX, headerY + brandSize / 2);
  brandCursorX += ctx.measureText('VivrePlay').width + 14;

  if (config.showMarketBadge) {
    ctx.fillStyle = palette.line;
    ctx.fillRect(brandCursorX, headerY + 8, 1.5, brandSize - 16);
    brandCursorX += 14;
    ctx.font = `700 ${config.format === 'banner' ? 19 : 22}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = palette.accent;
    ctx.fillText('Market', brandCursorX, headerY + brandSize / 2);
  }

  // Right-side game logos (exact same logos as Game Scope Switcher)
  const logoMaxH = config.format === 'banner' ? 28 : 34;
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
    // Horizontal 1500x500 banner with fanned cards on the right
    const panelY = 110;
    const panelH = height - panelY - 40;
    ctx.fillStyle = palette.panelSoft;
    drawRoundedRect(ctx, pad, panelY, contentWidth, panelH, 16);
    ctx.fill();
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1.25;
    drawRoundedRect(ctx, pad, panelY, contentWidth, panelH, 16);
    ctx.stroke();

    const innerX = pad + 40;
    const copyW = contentWidth * 0.56;
    let y = panelY + 52;

    ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.accent;
    ctx.fillText(config.eyebrow.toUpperCase(), innerX, y);
    y += 46;

    ctx.font = '800 42px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.ink;
    for (const line of wrapLines(ctx, config.headline, copyW, 2)) {
      ctx.fillText(line, innerX, y);
      y += 50;
    }

    y += 4;
    ctx.font = '500 19px "Manrope", sans-serif';
    ctx.fillStyle = palette.muted;
    for (const line of wrapLines(ctx, config.subheadline, copyW, 2)) {
      ctx.fillText(line, innerX, y);
      y += 27;
    }

    ctx.font = '700 17px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.accent;
    ctx.fillText(config.ctaUrl, innerX, panelY + panelH - 28);

    drawFannedCards(
      ctx,
      [card0, card1, card2],
      pad + contentWidth * 0.8,
      panelY + panelH * 0.52,
      142,
      198,
      palette.line,
      palette.shadow,
    );
    return;
  }

  if (config.format === 'og') {
    // 1200x630 split editorial layout: copy left, fanned cards right
    const panelY = headerY + brandSize + 26;
    const panelH = height - panelY - 70;
    ctx.fillStyle = palette.panelSoft;
    drawRoundedRect(ctx, pad, panelY, contentWidth, panelH, 18);
    ctx.fill();
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, pad, panelY, contentWidth, panelH, 18);
    ctx.stroke();

    const innerX = pad + 42;
    const copyW = contentWidth * 0.56;
    let y = panelY + 54;

    ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
    const eyebrowText = config.eyebrow.toUpperCase();
    const eyebrowW = ctx.measureText(eyebrowText).width + 26;
    ctx.fillStyle = palette.accentSoft;
    drawRoundedRect(ctx, innerX, y - 21, eyebrowW, 32, 16);
    ctx.fill();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, innerX, y - 21, eyebrowW, 32, 16);
    ctx.stroke();
    ctx.fillStyle = palette.accent;
    ctx.fillText(eyebrowText, innerX + 13, y);
    y += 54;

    ctx.font = '800 42px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.ink;
    for (const line of wrapLines(ctx, config.headline, copyW, 3)) {
      ctx.fillText(line, innerX, y);
      y += 50;
    }

    y += 10;
    ctx.font = '500 20px "Manrope", sans-serif';
    ctx.fillStyle = palette.muted;
    for (const line of wrapLines(ctx, config.subheadline, copyW, 3)) {
      ctx.fillText(line, innerX, y);
      y += 29;
    }

    drawFannedCards(
      ctx,
      [card0, card1, card2],
      pad + contentWidth * 0.8,
      panelY + panelH * 0.5,
      178,
      248,
      palette.line,
      palette.shadow,
    );

    const footerY = height - 34;
    ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.accent;
    ctx.fillText(config.ctaUrl, pad, footerY);
    ctx.font = '600 15px "Manrope", sans-serif';
    ctx.fillStyle = palette.muted;
    const tag = 'One Piece & Pokémon TCG';
    ctx.fillText(tag, width - pad - ctx.measureText(tag).width, footerY);
    return;
  }

  // Square (1080x1080) & Story (1080x1920)
  const isStory = config.format === 'story';
  const panelY = headerY + brandSize + (isStory ? 54 : 38);
  const footerReserve = isStory ? 116 : 86;
  const panelH = height - panelY - footerReserve;

  ctx.fillStyle = palette.panelSoft;
  drawRoundedRect(ctx, pad, panelY, contentWidth, panelH, 20);
  ctx.fill();
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, pad, panelY, contentWidth, panelH, 20);
  ctx.stroke();

  const innerPad = 52;
  const innerX = pad + innerPad;
  const innerW = contentWidth - innerPad * 2;
  let y = panelY + (isStory ? 96 : 68);

  // Eyebrow pill
  ctx.font = `800 ${isStory ? 15 : 14}px "Plus Jakarta Sans", sans-serif`;
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
  y += isStory ? 74 : 58;

  // Headline
  const headSize = isStory ? 62 : 48;
  const headLH = isStory ? 74 : 58;
  ctx.font = `800 ${headSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = palette.ink;
  for (const line of wrapLines(ctx, config.headline, innerW, 3)) {
    ctx.fillText(line, innerX, y);
    y += headLH;
  }

  y += isStory ? 20 : 12;

  // Subheadline
  const subSize = isStory ? 28 : 22;
  const subLH = isStory ? 40 : 32;
  ctx.font = `500 ${subSize}px "Manrope", sans-serif`;
  ctx.fillStyle = palette.muted;
  for (const line of wrapLines(ctx, config.subheadline, innerW, 3)) {
    ctx.fillText(line, innerX, y);
    y += subLH;
  }

  // Fanned TCG Cards showcase in center-bottom of panel
  const cardShowcaseY = isStory
    ? panelY + panelH * 0.62
    : panelY + panelH * 0.66;
  drawFannedCards(
    ctx,
    [card0, card1, card2],
    width / 2,
    cardShowcaseY,
    isStory ? 250 : 176,
    isStory ? 348 : 246,
    palette.line,
    palette.shadow,
  );

  // Feature chips along bottom edge of panel
  const chipH = isStory ? 50 : 42;
  const chipFontSize = isStory ? 19 : 16;
  ctx.font = `700 ${chipFontSize}px "Plus Jakarta Sans", sans-serif`;
  let chipX = innerX;
  let chipY = panelY + panelH - innerPad - chipH;
  if (isStory && config.chips.length > 2) {
    chipY -= chipH + 12;
  }
  for (const chip of config.chips) {
    const chipW = ctx.measureText(chip).width + 32;
    if (chipX + chipW > innerX + innerW) {
      chipX = innerX;
      chipY += chipH + 12;
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
    ctx.fillText(chip, chipX + 16, chipY + chipH / 2);
    ctx.textBaseline = 'alphabetic';
    chipX += chipW + 12;
  }

  // Footer CTA bar
  const footerY = height - (isStory ? 56 : 42);
  ctx.font = `700 ${isStory ? 24 : 20}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = palette.accent;
  ctx.fillText(config.ctaUrl, pad, footerY);

  const tagline = 'One Piece & Pokémon TCG';
  ctx.font = `600 ${isStory ? 18 : 16}px "Manrope", sans-serif`;
  ctx.fillStyle = palette.muted;
  ctx.fillText(tagline, width - pad - ctx.measureText(tagline).width, footerY);
}
