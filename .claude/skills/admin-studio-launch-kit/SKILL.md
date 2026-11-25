---
name: admin-studio-launch-kit
description: Generate ready-to-post Admin Studio launch kits (launch-kit.md + admin-studio-post.json) from campaigns/<slug>/campaign.json for VivrePlay.
---

# Admin Studio Launch Kit Skill

## Purpose
Read `campaigns/<slug>/campaign.json` and output:
1. `campaigns/<slug>/launch-kit.md` — human-readable creative brief, hook variations, canvas settings, and posting checklist.
2. `campaigns/<slug>/admin-studio-post.json` — direct import / API payload ready for `AdminSocialStudio` (`POST /api/admin/social-posts`).

## Required Deliverables in `launch-kit.md`
1. **3 Hook Variations (EN & ID)**:
   - Mix collector pain point, concrete platform proof (e.g., `48h inspection`, `+2m anti-snipe`, `0.75% Market Pro fee`), and direct CTA.
2. **Canvas Render Spec**:
   - Exact `template`, `format`, `theme`, `eyebrow`, `headline`, `subheadline`, `chips`, `ctaUrl`, and `showMarketBadge`.
3. **Platform-Ready Captions (EN & ID)**:
   - Formatted for Instagram, Threads, Facebook, X, TikTok, and WhatsApp Community without em-dashes (`—`) or middle dots (`•`).
4. **Recommended Jakarta (`WIB`) Schedule**:
   - Optimal posting window (e.g., `12:15 WIB` lunch break or `19:00–20:30 WIB` evening collector peak).

## Required Structure in `admin-studio-post.json`
```json
{
  "title": "...",
  "pillar": "...",
  "locale": "EN",
  "platforms": ["instagram", "threads", "facebook", "twitter"],
  "caption": "...",
  "recommendedTime": "19:00",
  "assetConfig": {
    "template": "market",
    "format": "square",
    "theme": "dark",
    "locale": "EN",
    "eyebrow": "...",
    "headline": "...",
    "subheadline": "...",
    "chips": ["..."],
    "ctaUrl": "vivreplay.com/market",
    "showMarketBadge": true
  },
  "variants": {
    "EN": { "title": "...", "caption": "...", "assetConfig": {} },
    "ID": { "title": "...", "caption": "...", "assetConfig": {} }
  }
}
```
Importing `admin-studio-post.json` in Admin Studio populates the canvas, title, pillar, locale, caption, and recommended schedule time in one click.
