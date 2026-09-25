# TCG platform

Phase 1 working foundation for a connected TCG companion. Temporary visible brand: PROJECT_NAME. See [architecture and readiness boundaries](docs/ARCHITECTURE.md).

## Workspace

- Root: web app, responsive navigation, route handlers, UI components, SQL schema and storage adapters
- `packages/domain`: collection validation, deck legality, ownership, valuation
- `packages/card-data`: original seed catalog, printing identities, asset provenance
- `packages/imports`: import adapter contract, normalization and review diff
- `packages/platform`: sharing, payment capability and future match/tournament contracts

## Develop

```sh
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

Hosted state uses Sites sign-in, D1, and the private Supabase `tcg-card-images` bucket. Cloudflare R2 is unused. Local sign-in is a development-only fixture. Follow `docs/ARCHITECTURE.md` before production launch.

## Authentication

VivrePlay uses Better Auth with the `DB` Cloudflare D1 binding. Copy `.env.example` to `.env.local` for local development and set a unique `BETTER_AUTH_SECRET` with at least 32 bytes of entropy. In Cloudflare, add `BETTER_AUTH_SECRET` as an encrypted Worker secret and set `BETTER_AUTH_URL` to the deployed VivrePlay origin. The D1 database ID is configured in `vite.config.ts`; it is not a secret and does not need an environment variable.

Apply the Better Auth schema to the production D1 database before deploying the authentication code:

```sh
npx wrangler d1 execute DB --remote --file drizzle/0004_better_auth.sql
```

Local migration after build:
```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_yummy_terrax.sql
```

Original artwork and sample market prices are labeled demo data. No official artwork has been scraped. Gameplay and checkout remain off.
