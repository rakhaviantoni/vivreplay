import sharp from 'sharp';
import fs from 'node:fs';

async function generateMarketOg() {
  const width = 1200;
  const height = 630;
  const base = sharp('public/brand/vivreplay-og.png');

  // Extract authentic Market store badge from official market-icon-512
  const badgeSize = 108;
  const badgeRaw = await sharp('public/brand/vivreplay-market-icon-512.png')
    .extract({ left: 366, top: 366, width: badgeSize, height: badgeSize })
    .toBuffer();

  const circleMask = Buffer.from(`
    <svg width="${badgeSize}" height="${badgeSize}" viewBox="0 0 ${badgeSize} ${badgeSize}">
      <circle cx="${badgeSize / 2}" cy="${badgeSize / 2}" r="${badgeSize / 2 - 1.5}" fill="#ffffff"/>
    </svg>
  `);

  const maskedBadge = await sharp(badgeRaw)
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const targetBadgeSize = 136;
  const resizedBadge = await sharp(maskedBadge)
    .resize(targetBadgeSize, targetBadgeSize)
    .toBuffer();

  // Create badge with soft drop shadow and subtle brass-gold rim
  const shadowPadding = 30;
  const totalBadgeW = targetBadgeSize + shadowPadding * 2;
  const badgeWithShadowSvg = `
  <svg width="${totalBadgeW}" height="${totalBadgeW}" viewBox="0 0 ${totalBadgeW} ${totalBadgeW}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.7"/>
      </filter>
    </defs>
    <!-- Outer subtle brass border ring that ties into Vivreplay compass gold -->
    <circle cx="${totalBadgeW / 2}" cy="${totalBadgeW / 2}" r="${targetBadgeSize / 2 + 1.5}" fill="none" stroke="#dfaa35" stroke-width="1.5" stroke-opacity="0.4" filter="url(#shadow)"/>
  </svg>
  `;

  const badgeComposite = await sharp(Buffer.from(badgeWithShadowSvg))
    .composite([
      {
        input: resizedBadge,
        top: shadowPadding,
        left: shadowPadding,
      },
    ])
    .png()
    .toBuffer();

  // Full height seamless patch covering old text without any seams or ghosting
  // Pure archival VivrePlay brand styling: clean white wordmark, gold Market pill, no middots (·), no AI slop
  const patchSvg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="leftFade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#06131e" stop-opacity="1"/>
        <stop offset="44%" stop-color="#06131e" stop-opacity="1"/>
        <stop offset="54%" stop-color="#071420" stop-opacity="0.6"/>
        <stop offset="62%" stop-color="#081622" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="goldPill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fae39b"/>
        <stop offset="45%" stop-color="#dfaa35"/>
        <stop offset="100%" stop-color="#b07d17"/>
      </linearGradient>
    </defs>

    <!-- Invisible background blend -->
    <rect x="0" y="0" width="${width}" height="${height}" fill="url(#leftFade)"/>

    <!-- Left Content Column -->
    <g transform="translate(86, 218)">
      <!-- Row 1: Vivreplay wordmark + Market pill -->
      <g transform="translate(0, 64)">
        <text x="0" y="0" font-family="Plus Jakarta Sans, -apple-system, sans-serif" font-weight="800" font-size="70" fill="#ffffff" letter-spacing="-0.035em">
          Vivreplay
        </text>
        <rect x="336" y="-46" width="126" height="44" rx="10" fill="url(#goldPill)"/>
        <text x="399" y="-18" font-family="Plus Jakarta Sans, -apple-system, sans-serif" font-weight="900" font-size="19" fill="#1b160e" text-anchor="middle" letter-spacing="0.09em">
          MARKET
        </text>
      </g>

      <!-- Row 2: Gold Eyebrow: Supported Games & Formats (Strictly NO middots or AI slop) -->
      <text x="2" y="118" font-family="Plus Jakarta Sans, -apple-system, sans-serif" font-weight="800" font-size="18" fill="#dfaa35" letter-spacing="0.16em">
        ONE PIECE, POKÉMON, SLABS &amp; SEALED
      </text>

      <!-- Row 3: Subtitle in clean archival slate -->
      <text x="2" y="164" font-family="Plus Jakarta Sans, -apple-system, sans-serif" font-weight="450" font-size="24" fill="#d2dfe9" letter-spacing="-0.012em">
        Cards, slabs, sealed products, and verified trade.
      </text>
    </g>
  </svg>
  `;

  const finalImg = await base
    .composite([
      {
        input: Buffer.from(patchSvg),
        top: 0,
        left: 0,
      },
      {
        input: badgeComposite,
        top: 366 - shadowPadding,
        left: 924 - shadowPadding,
      },
    ])
    .png({ quality: 95 })
    .toBuffer();

  const outputPath = 'public/brand/vivreplay-market-og.png';
  fs.writeFileSync(outputPath, finalImg);

  const artifactPath =
    '/Users/rakhaviantoni/.gemini/antigravity/brain/19169202-8802-49ee-86b6-f33c7f70a8c3/market-og.png';
  fs.writeFileSync(artifactPath, finalImg);

  console.log(`Successfully generated ${outputPath} (${finalImg.length} bytes)`);
}

generateMarketOg().catch(console.error);
