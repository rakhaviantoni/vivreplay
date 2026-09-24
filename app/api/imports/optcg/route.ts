import { Hono } from 'hono';
import { fetchAllOPTCGCards, optcgSource } from '@/packages/imports/optcg';
import { db, errorResponse, user } from '@/lib/server/store';

const app = new Hono().basePath('/api/imports/optcg');

app.get('/', context => context.json({
  source: optcgSource.id,
  sourceUrl: optcgSource.sourceUrl,
  flow: ['RawImport', 'Normalizer', 'Diff', 'Review', 'Approved canonical data'],
  assetPolicy: optcgSource.rightsStatus,
  bulkEndpoints: ['allSetCards', 'allSTCards', 'allPromos', 'allDonCards'],
}));

app.post('/', async context => {
  const account = await user();
  const batch = await fetchAllOPTCGCards(context.req.raw.signal);
  const importId = crypto.randomUUID();
  await db().prepare('INSERT INTO raw_imports (id,source,payload,status,created_by) VALUES (?,?,?,?,?)')
    .bind(importId, optcgSource.id, JSON.stringify({ fetchedAt: batch.fetchedAt, counts: batch.counts, cards: batch.cards }), 'PENDING_REVIEW', account.id)
    .run();
  return context.json({ importId, status: 'PENDING_REVIEW', counts: batch.counts, cards: batch.cards.length }, 202);
});

async function handle(request: Request) {
  try { return await app.fetch(request); }
  catch (error) { return errorResponse(error); }
}

export const GET = handle;
export const POST = handle;
