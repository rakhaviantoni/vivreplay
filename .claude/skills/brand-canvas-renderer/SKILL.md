---
name: brand-canvas-renderer
description: Visual standards, canvas safe zones, real OPTCG/Pokemon card artwork rules, and self-improving visual revision log for VivrePlay Admin Social Studio.
---

# Brand Canvas Renderer — Visual & Layout Standards

Every graphic rendered by `lib/social-brand-canvas.ts` and displayed in `components/admin/admin-social-studio.tsx` must adhere strictly to these visual standards.

## Canvas Formats & Dimensions
- **Square (`square`)**: `1080x1080` — Instagram Feed, Threads, Facebook
- **Story (`story`)**: `1080x1920` — Instagram Story, TikTok, WhatsApp Status
- **Banner (`banner`)**: `1500x500` — X / Twitter Header, Web Hero
- **Link Card (`og`)**: `1200x630` — OpenGraph / X / WhatsApp link previews
- **Community Assets**:
  - `community-hub`, `group-op`, `group-pkmn`, `group-pulls`, `group-arena`: `1080x1080`
  - `wa-profile-banner`: `1500x500` (clean wide framing without stretched logos)
  - `wa-wallpaper`: `1080x1920` (subtle dark/light theme parity)

## Visual & Asset Rules
1. **Real OPTCG & Pokemon Card Art Only**:
   - Never use placeholder rectangles or generic card backs.
   - Always pull verified card art from `/api/cards/catalog?language=EN&q=Luffy&limit=10` and `/api/cards/catalog?game=pokemon&language=EN&q=Charizard&limit=10` using `cardPrintingImageUrl`.
   - Always verify `img.naturalWidth > 0` before passing URLs to `renderBrandSocialCanvas`.
2. **Typography, Spacing & Hierarchy**:
   - Maintain crisp breathing room between the eyebrow badge (`ONE PIECE & POKEMON TCG`), the headline, subheadline, and feature chips.
   - Never leave large dead voids between description copy and feature pills; keep card fan compositions balanced per format (`square`, `story`, `banner`, `og`).
3. **Icons & Brand Marks**:
   - Use `@phosphor-icons/react` for all UI controls in Admin Studio.
   - When platform icons are rendered in Connected Accounts, omit redundant platform text labels and hide the Connect button once connected.
4. **Theme Consistency**:
   - Support both `dark` (obsidian `#091118` / `#0E1A24`, gold `#D8A63B`, emerald `#16845F`) and `light` (warm ivory `#FAF7EF`, deep ink `#131B22`) across every canvas and community asset.

## Self-Improving Revision Protocol
Whenever a visual tweak, spacing adjustment, or asset layout fix is requested:
1. Apply the fix in `lib/social-brand-canvas.ts` or `components/admin/admin-social-studio.tsx`.
2. Verify with `npx tsc --noEmit && npm test`.
3. **Append a dated, actionable rule** under `## Learned Visual Rules` below.

## Learned Visual Rules
- **2026-11-25 — Real OPTCG & Pokemon Cards with Preload Verification**: Always verify every catalog image with `naturalWidth > 0` before rendering the canvas fan so the center card never renders blank.
- **2026-11-25 — Format-Specific Card & Pill Spacing**: Give the `ONE PIECE & POKEMON TCG` eyebrow badge clear separation from the headline, keep feature pills anchored directly below the subheadline without empty vertical gaps on `square` and `banner`, and tighten top/bottom card margins on `story`.
- **2026-11-25 — Direct Game Logos Without Redundant Text**: For community group icons (`group-op`, `group-pkmn`), render the game mark cleanly without repeating text inside the icon, and keep group icon-to-label spacing tight.
- **2026-11-25 — Toggle Switches Over Dual Buttons**: Use compact segmented toggle switches (`.admin-social-switch`) for binary theme (`Dark`/`Light`) and locale (`EN`/`ID`) controls in Admin Studio.
