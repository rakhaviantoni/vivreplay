---
name: social-story-flow
description: Collector-first bilingual (EN/ID) social campaign scripting and Admin Studio mapping pipeline for VivrePlay (One Piece TCG & Pokemon TCG). Always run this before generating brand canvas graphics or Admin Studio launch kits.
---

# Social Story Flow — Collector-First Copy & Campaign Mapping

VivrePlay follows a strict **Collector-First** social pipeline. Every graphic and scheduled post in Admin Social Studio starts from verified collector pain points, clean bilingual copy (`EN` and `ID`), and accurate platform features.

## Phase 1: Create `campaigns/<slug>/campaign.json`

Before rendering assets or queuing posts in Admin Studio, author `campaigns/<slug>/campaign.json`.

### Strict Copy Rules
1. **No AI Slop or Internal Jargon**:
   - **NEVER** use em-dashes (`—`), middle dots (`•`), or robotic buzzwords ("revolutionize", "elevate", "unleash", "seamless", "game-changer") in headlines, badges, or captions.
   - Use clean colons, commas, line breaks, or hyphenated lists (`- `) instead.
   - **NEVER** mention internal tooling, APIs, database tables, or admin concepts in public copy.
2. **Bilingual Parity (`EN` & `ID`)**:
   - Every campaign must include both English (`EN`) and natural Indonesian (`ID`) copy.
   - English URLs point to `https://vivreplay.com/...`; Indonesian URLs point to `https://vivreplay.com/id/...`.
   - Use natural collector terms in Indonesian (e.g., `kartu raw`, `graded slab`, `cek ongkir otomatis`, `resi otomatis`, `masa inspeksi 48 jam`, `lelang live`).
3. **Structured Canvas Copy Budget**:
   - `eyebrow`: 2–4 uppercase words (e.g., `VIVREPLAY MARKET`, `SCANNER & VAULT`).
   - `headline`: Max 7 words; punchy, benefit-led.
   - `subheadline`: 1 concise sentence (max 16 words).
   - `chips`: 3–4 short feature pills (2–3 words each).
   - `ctaUrl`: Clean domain path without `https://` (e.g., `vivreplay.com/market`).
4. **Content Pillars**:
   - `launch`: Platform overview (`template: "launch"`)
   - `market`: Buyer protection, 48h inspection, QRIS/VA, shipping (`template: "market"`)
   - `scanner`: Camera scanner, EN/JP/ID printings, Vault sync (`template: "scanner"`)
   - `auctions`: Rolling 24h/48h or fixed auctions, +2m anti-snipe, Buy Out (`template: "auctions"`)
   - `pro`: Market Pro 0.75% fee, 500 listings, Spotlight credits, vouchers (`template: "pro"`)
   - `arena`: Deck Builder, official rulings, Meta stats, Practice Arena (`template: "arena"`)

## Phase 2: Map 1-to-1 into Admin Studio

Every `campaign.json` maps directly to:
1. `SocialCampaignPreset` in `lib/social-brand-kit.ts`
2. `POST /api/admin/social-posts` payload (`campaigns/<slug>/admin-studio-post.json`)

### Required Fields in `campaign.json`
- `slug`: deterministic folder slug (e.g., `01-one-piece-pokemon-vault-scanner`)
- `pillar`: human-readable pillar name
- `template`: `'launch' | 'market' | 'scanner' | 'auctions' | 'pro' | 'arena'`
- `defaultFormat`: `'square' | 'story' | 'banner' | 'og'`
- `recommendedTime`: `HH:MM` in `Asia/Jakarta` (WIB)
- `platforms`: array of `'instagram' | 'threads' | 'facebook' | 'twitter' | 'tiktok' | 'whatsapp'`
- `en` & `id`: `{ title, caption, asset: { eyebrow, headline, subheadline, chips, ctaUrl, showMarketBadge } }`
