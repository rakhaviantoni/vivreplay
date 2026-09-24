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

Hosted state uses Sites sign-in, D1 and R2. Local sign-in is a development-only fixture. This is not a configured Supabase installation. Follow `docs/ARCHITECTURE.md` before production launch.

Local migration after build:
```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_yummy_terrax.sql
```

Original artwork and sample market prices are labeled demo data. No official artwork has been scraped. Gameplay and checkout remain off.
