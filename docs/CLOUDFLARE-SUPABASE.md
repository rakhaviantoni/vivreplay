# Cloudflare and Supabase setup

Supabase is the canonical card catalog and private `tcg-card-images` bucket. Cloudflare runs the web application, protects import routes, and keeps the existing D1-backed collection flows until those user-owned records are migrated deliberately.

1. Run `supabase/migrations/0001_catalog_import.sql`, `supabase/migrations/0002_optcg_card_fields.sql`, `supabase/migrations/0003_webp_variants.sql`, and `supabase/migrations/0004_normalized_card_catalog.sql` in the Supabase SQL editor, in that order.
2. Create a Supabase secret key in Project Settings, API Keys. Set it only as `SUPABASE_SECRET_KEY` in the trusted importer environment.
3. Run `npx tsx scripts/import-optcg-to-supabase.ts` once with the URL and secret key available. The script downloads images with six concurrent workers and writes WebP `thumb` (180px), `small` (420px), and `large` (960px) variants to the private Supabase bucket.
4. Run `node --env-file=.env.local --import tsx scripts/import-oplay-jp-images.ts` to derive and verify JP `small` image URLs for every saved EN printing. Only images returning HTTP 200 create JP printing and asset-source records.
4. In Cloudflare Sites, preserve the existing `DB` D1 and `BUCKET` R2 bindings. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` as encrypted Worker secrets. Do not add the secret key to `.env.local`, client code, or a public binding.

## Deck Coach

Set `AZEKHA_AI_GATEWAY_URL`, `AZEKHA_AI_GATEWAY_TOKEN`, and optionally `AZEKHA_AI_MODEL` as encrypted Worker secrets to route the Deck Coach through the Azekha AI Gateway. The route speaks the OpenAI chat-completions contract and defaults to `glm-5.3-flash`. `SUMOPOD_API_KEY`, `SUMOPOD_BASE_URL`, and `SUMOPOD_MODEL` remain supported as a direct compatible fallback. `ZAI_API_KEY` is accepted as a server-side compatibility alias for an existing Sumopod credential, but new deployments should use `SUMOPOD_API_KEY`. Keep all provider and gateway tokens server-side.

Apply `drizzle/0002_ai_coach_requests.sql` to D1 before enabling the feature. It creates the private coach audit trail used in Admin, including the signed-in account when present, source IP, user agent, locale, model, question, deck context summary, result status, and response timing.

Set `ADMIN_EMAILS` to a comma-separated list of administrator email addresses. It gates the Deck Coach audit endpoint in Admin.
5. Add a Cloudflare Cron Trigger or Workflow that invokes the protected importer route. Use a daily schedule at first and retain raw-import and failure metrics.

The browser uses only `NEXT_PUBLIC_SUPABASE_URL` and the publishable key. The secret key bypasses Supabase RLS and is required only by the trusted importer. Catalog tables have public read policies; their write paths stay server-only. Stored image assets remain private and are not enabled for display until review approves their provenance.

### Shipping quotes

Apply `drizzle/0003_shipping_origins.sql`, then set `BITESHIP_API_KEY` as a Worker secret. Seller delivery origins are private records; listings expose only the seller city. Buyer courier prices are requested on demand through `/api/shipping/quotes` using the Biteship Rates API. No order or waybill is created by a quote.
