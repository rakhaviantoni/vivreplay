# TCG platform — Phase 1 foundation

## Implemented vertical slice

The root is the web workspace (Next App Router API on Vinext/Cloudflare). Domain, catalog, import pipeline and platform contracts are separate npm workspaces in `packages/*`. The locked npm setup is retained for Sites compatibility. No pnpm or Turborepo execution is claimed.

Card discovery → EN/JP printing → authenticated raw/slab Vault → versioned deck → owned/missing cards → relevant listings → privacy-aware sharing.

- 18 original demo identities and 36 language printings. No official One Piece data, translated rules, card images, market prices, or simulator coverage is claimed.
- Game ID belongs to identities and decks; owned collectibles/listings belong to printings; deck entries reference identities. Future MatchReference points to immutable deck-version IDs.
- UUID keys, foreign keys, query indexes, uniqueness constraints, money as integer minor units. Raw quantity >1 is allowed, graded quantity is exactly 1. Grading providers are rows, never enum migrations.
- Private items and photos are authorized server-side. Acquisition prices are excluded from public pages. Explicit visibility controls public sharing.
- Each save appends a deck version. Draft validation is surfaced; there is no simulated legal gameplay. Race conflicts fail transactionally; callers can retry after refreshing.
- Listing stock is checked atomically against active listings. Indonesia seller restriction does not block global browsing/collections/decks. No wallet, payment, escrow, settlement or checkout exists.
- Supabase Storage photo storage, 5 MB limit, image signature checks, private delivery, and maximum eight photos. Uploads remain unverified; production moderation and malware/image processing are launch gates.
- Raw-vs-graded valuation filters completed sales by exact printing, grader, grade, and currency. No live observations exist, so portfolio value stays unavailable.
- Import normalizer/diff handles NEW/CHANGED/REMOVED/CONFLICT/FAILED. Admin page is read-only sample output. No canonical mutation or administrator approval API is exposed.

## Runtime and target-stack boundary

This working private deployment uses Sites dispatch authentication, D1 SQL, and Supabase Storage. Local development identity is provided by the starter and is excluded from production. Deploy only through Sites: the identity headers are trusted at the Sites dispatch boundary, not arbitrary public request headers.

The user’s recommended production stack includes Supabase Auth/PostgreSQL, Hono, pnpm/Turborepo and Durable Objects. These are NOT silently represented as installed or provisioned. `lib/server/store.ts` is the current persistence/auth boundary. A production migration must introduce a Supabase JWT verifier, map auth subject to profile, implement PostgreSQL repositories and RLS, migrate IDs preserving relationships, and verify isolation before public launch. The domain packages are storage-independent.

Do not deploy the Worker directly to an unrestricted origin while trusting forwarded identity headers.

## Deliberately deferred

Realtime gameplay, engine/effects/rules, ratings, tournaments, aggregated meta, payment/shipping/disputes, real price adapters, broad notifications, official catalog ingestion, full Indonesian translation, FX conversion, advanced binder filters, edit/remove inventory UI, service-worker offline caching, dynamic OG images and public indexing. Shared type contracts and feature flags provide extension points without claiming those features work.

## Launch gates

Not a production launch certification: configure approved auth/database, administrator role authorization and import approval writes, rate limits and quotas, moderation, upload re-encoding/metadata removal, logging/monitoring, backup/restore, rights-approved official data, complete form/workflow accessibility audit, comprehensive multi-user isolation/load tests, and deployment CSP/security headers. Keep checkout, gameplay and related flags disabled until corresponding systems are validated.

## Commands

`npm install` · `npm run dev` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`

Schema migration: `npm run db:generate`. Migrations are schema-only. Seed inserts are idempotent and transactional; imports do not delete upstream-missing records.

## Original artwork

Built-in imagegen generated one six-panel contact sheet of original maritime fantasy characters. Source: `/Users/rakhaviantoni/.codex/generated_images/01a0c17b-8367-7261-9da4-b2ca117eb163/exec-51fc378f-7fa0-416a-8dad-5d0612fd10c8.png`. Final assets: `public/art/card-0.webp` through `card-5.webp`, hash manifest in card-data. Prompt: six equal portrait panels, red-coated sky captain at sunset, teal navigator on blue ocean, armored swordswoman in emerald storm, silver-haired admiral at icy harbor, golden mechanical shipwright in amber workshop, violet oracle in moonlight; premium original anime fantasy illustration; no copyrighted characters, text, logos, or frames. Asset generation used the built-in tool, not the CLI. Physical EN and JP printing records share this placeholder illustration but retain independent asset references.
