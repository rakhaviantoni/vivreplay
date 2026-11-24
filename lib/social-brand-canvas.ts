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
  fallbackBg: string,
  shadowColor: string,
) {
  const specs = [
    { img: cards[0], angle: -0.15, dx: -cardW * 0.44, dy: cardH * 0.05, scale: 0.9 },
    { img: cards[2], angle: 0.15, dx: cardW * 0.44, dy: cardH * 0.05, scale: 0.9 },
    { img: cards[1], angle: 0, dx: 0, dy: -cardH * 0.03, scale: 1 },
  ];

  for (const spec of specs) {
    const w = cardW * spec.scale;
    const h = cardH * spec.scale;
    ctx.save();
    ctx.translate(centerX + spec.dx, centerY + spec.dy);
    ctx.rotate(spec.angle);

    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = fallbackBg;
    drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 12);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    if (spec.img) {
      ctx.save();
      drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 12);
      ctx.clip();
      ctx.drawImage(spec.img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 12);
    ctx.stroke();
    ctx.restore();
  }
}

function drawChipGrid(
  ctx: CanvasRenderingContext2D,
  chips: string[],
  startX: number,
  startY: number,
  maxW: number,
  chipH: number,
  fontSize: number,
  gap: number,
  palette: { badgeBg: string; line: string; ink: string },
) {
  ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
  let cx = startX;
  let cy = startY;
  for (const chip of chips) {
    const cw = Math.min(maxW, ctx.measureText(chip).width + 30);
    if (cx > startX && cx + cw > startX + maxW) {
      cx = startX;
      cy += chipH + gap;
    }
    ctx.fillStyle = palette.badgeBg;
    drawRoundedRect(ctx, cx, cy, cw, chipH, chipH / 2);
    ctx.fill();
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1.25;
    drawRoundedRect(ctx, cx, cy, cw, chipH, chipH / 2);
    ctx.stroke();

    ctx.fillStyle = palette.ink;
    ctx.textBaseline = 'middle';
    ctx.fillText(chip, cx + 15, cy + chipH / 2);
    ctx.textBaseline = 'alphabetic';
    cx += cw + gap;
  }
}

function drawEyebrowPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  palette: { accentSoft: string; accent: string },
): number {
  ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
  const upper = text.toUpperCase();
  const pillH = fontSize + 18;
  const pillW = ctx.measureText(upper).width + 26;
  ctx.fillStyle = palette.accentSoft;
  drawRoundedRect(ctx, x, y, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, x, y, pillW, pillH, pillH / 2);
  ctx.stroke();
  ctx.fillStyle = palette.accent;
  ctx.textBaseline = 'middle';
  ctx.fillText(upper, x + 13, y + pillH / 2);
  ctx.textBaseline = 'alphabetic';
  return pillH;
}

export async function renderBrandSocialCanvas(
  canvas: HTMLCanvasElement,
  config: SocialAssetConfig,
  cardImageUrls: string[] = [],
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
          panelSoft: 'rgba(255, 250, 240, 0.9)',
          line: '#d8cbb5',
          ink: '#28251f',
          muted: '#716a5e',
          accent: '#b77a19',
          accentSoft: 'rgba(183, 122, 25, 0.12)',
          badgeBg: '#fffaf0',
          cardFallback: '#e8dfcf',
          shadow: 'rgba(49, 38, 19, 0.22)',
        }
      : {
          bgStart: '#10141a',
          bgMid: '#131922',
          bgEnd: '#171f2b',
          panel: '#10161f',
          panelSoft: 'rgba(16, 22, 31, 0.88)',
          line: '#273344',
          ink: '#f6f2ea',
          muted: '#aab4c2',
          accent: '#e8c47d',
          accentSoft: 'rgba(232, 196, 125, 0.12)',
          badgeBg: '#1d242d',
          cardFallback: '#17202c',
          shadow: 'rgba(0, 0, 0, 0.5)',
        };

  // Exact VivrePlay gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, palette.bgStart);
  bgGrad.addColorStop(0.5, palette.bgMid);
  bgGrad.addColorStop(1, palette.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

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

  const inset = config.format === 'banner' ? 14 : 20;
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, inset, inset, width - inset * 2, height - inset * 2, 14);
  ctx.stroke();

  const cardSrcs = cardImageUrls.filter(Boolean).slice(0, 3);
  const [compassImg, opLogoImg, pkmnLogoImg, card0, card1, card2] = await Promise.all([
    loadCanvasImage('/brand/vivreplay-compass.png'),
    loadCanvasImage(GAME_LOGOS['one-piece']),
    loadCanvasImage(GAME_LOGOS.pokemon),
    cardSrcs[0] ? loadCanvasImage(cardSrcs[0]) : Promise.resolve(null),
    cardSrcs[1] ? loadCanvasImage(cardSrcs[1]) : Promise.resolve(null),
    cardSrcs[2] ? loadCanvasImage(cardSrcs[2]) : Promise.resolve(null),
  ]);

  const pad = config.format === 'banner' ? 48 : config.format === 'og' ? 52 : 60;
  const contentWidth = width - pad * 2;

  // Header brand lockup: [Compass] VivrePlay | Market
  const brandSize = config.format === 'banner' ? 38 : config.format === 'story' ? 50 : 42;
  const headerY = config.format === 'banner' ? 36 : config.format === 'story' ? 66 : 54;

  if (compassImg) {
    ctx.drawImage(compassImg, pad, headerY, brandSize, brandSize);
  }
  let brandCursorX = pad + brandSize + 14;
  ctx.font = `800 ${config.format === 'banner' ? 22 : 26}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = palette.ink;
  ctx.textBaseline = 'middle';
  ctx.fillText('VivrePlay', brandCursorX, headerY + brandSize / 2);
  brandCursorX += ctx.measureText('VivrePlay').width + 14;

  if (config.showMarketBadge) {
    ctx.fillStyle = palette.line;
    ctx.fillRect(brandCursorX, headerY + 8, 1.5, brandSize - 16);
    brandCursorX += 14;
    ctx.font = `700 ${config.format === 'banner' ? 18 : 21}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = palette.accent;
    ctx.fillText('Market', brandCursorX, headerY + brandSize / 2);
  }

  // Right-side game logos (same as Game Scope Switcher)
  const logoMaxH = config.format === 'banner' ? 28 : 32;
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

  const isBanner = config.format === 'banner';
  const isOg = config.format === 'og';
  const isStory = config.format === 'story';

  const panelY = headerY + brandSize + (isBanner ? 22 : isOg ? 24 : isStory ? 44 : 34);
  const footerReserve = isBanner ? 34 : isOg ? 64 : isStory ? 104 : 78;
  const panelH = height - panelY - footerReserve;

  ctx.fillStyle = palette.panelSoft;
  drawRoundedRect(ctx, pad, panelY, contentWidth, panelH, 18);
  ctx.fill();
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, pad, panelY, contentWidth, panelH, 18);
  ctx.stroke();

  if (isBanner || isOg || config.format === 'square') {
    // Clean 2-column editorial layout: Left = Copy + Chips, Right = Fanned OPTCG & Pokemon cards
    const innerPad = isBanner ? 34 : isOg ? 40 : 48;
    const innerX = pad + innerPad;
    const leftW = contentWidth * (config.format === 'square' ? 0.54 : 0.56) - innerPad;
    let y = panelY + (isBanner ? 30 : isOg ? 40 : 54);

    const pillH = drawEyebrowPill(
      ctx,
      config.eyebrow,
      innerX,
      y,
      isBanner ? 12 : 13,
      palette,
    );
    y += pillH + (isBanner ? 26 : isOg ? 34 : 44);

    const headSize = isBanner ? 38 : isOg ? 40 : 50;
    const headLH = isBanner ? 46 : isOg ? 48 : 60;
    ctx.font = `800 ${headSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = palette.ink;
    const hLines = wrapLines(ctx, config.headline, leftW, isBanner ? 2 : 3);
    for (const line of hLines) {
      ctx.fillText(line, innerX, y);
      y += headLH;
    }

    y += isBanner ? 6 : 14;
    const subSize = isBanner ? 18 : isOg ? 19 : 22;
    const subLH = isBanner ? 26 : isOg ? 28 : 32;
    ctx.font = `500 ${subSize}px "Manrope", sans-serif`;
    ctx.fillStyle = palette.muted;
    const sLines = wrapLines(ctx, config.subheadline, leftW, isBanner ? 2 : 4);
    for (const line of sLines) {
      ctx.fillText(line, innerX, y);
      y += subLH;
    }

    if (!isBanner && config.chips.length > 0) {
      const chipH = isOg ? 38 : 42;
      const chipY = panelY + panelH - innerPad - (config.chips.length > 2 ? chipH * 2 + 12 : chipH);
      drawChipGrid(
        ctx,
        config.chips,
        innerX,
        Math.max(y + 18, chipY),
        leftW,
        chipH,
        isOg ? 14 : 15,
        10,
        palette,
      );
    }

    const cardW = isBanner ? 132 : isOg ? 168 : 210;
    const cardH = Math.round(cardW * 1.39);
    const cardCenterX = pad + contentWidth * (config.format === 'square' ? 0.77 : 0.79);
    const cardCenterY = panelY + panelH * 0.5;
    drawFannedCards(
      ctx,
      [card0, card1, card2],
      cardCenterX,
      cardCenterY,
      cardW,
      cardH,
      palette.line,
      palette.cardFallback,
      palette.shadow,
    );
  } else {
    // Story (1080x1920): 3-zone vertical stack with generous breathing room
    const innerPad = 52;
    const innerX = pad + innerPad;
    const innerW = contentWidth - innerPad * 2;
    let y = panelY + 64;

    const pillH = drawEyebrowPill(ctx, config.eyebrow, innerX, y, 15, palette);
    y += pillH + 54;

    ctx.font = '800 62px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.ink;
    for (const line of wrapLines(ctx, config.headline, innerW, 3)) {
      ctx.fillText(line, innerX, y);
      y += 74;
    }

    y += 18;
    ctx.font = '500 28px "Manrope", sans-serif';
    ctx.fillStyle = palette.muted;
    for (const line of wrapLines(ctx, config.subheadline, innerW, 3)) {
      ctx.fillText(line, innerX, y);
      y += 40;
    }

    const chipH = 50;
    const chipsTop = panelY + panelH - innerPad - (config.chips.length > 2 ? chipH * 2 + 14 : chipH);
    const showcaseTop = y + 36;
    const showcaseCenterY = (showcaseTop + chipsTop) / 2;

    drawFannedCards(
      ctx,
      [card0, card1, card2],
      width / 2,
      showcaseCenterY,
      252,
      350,
      palette.line,
      palette.cardFallback,
      palette.shadow,
    );

    if (config.chips.length > 0) {
      drawChipGrid(ctx, config.chips, innerX, chipsTop, innerW, chipH, 19, 12, palette);
    }
  }

  // Footer CTA bar
  if (!isBanner) {
    const footerY = height - (isStory ? 50 : isOg ? 30 : 38);
    ctx.font = `700 ${isStory ? 23 : isOg ? 17 : 19}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = palette.accent;
    ctx.fillText(config.ctaUrl, pad, footerY);

    const tagline = 'One Piece & Pokémon TCG';
    ctx.font = `600 ${isStory ? 18 : 15}px "Manrope", sans-serif`;
    ctx.fillStyle = palette.muted;
    ctx.fillText(tagline, width - pad - ctx.measureText(tagline).width, footerY);
  } else {
    ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.accent;
    ctx.fillText(config.ctaUrl, pad + 34, panelY + panelH - 22);
  }
}
