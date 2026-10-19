const origin = (process.env.POKEPEDIA_RECOVERY_ORIGIN || 'https://vivreplay.com').replace(/\/$/, '');
const languages = (process.env.POKEPEDIA_RECOVERY_LANGUAGES || 'ID,JP').split(',').map(value => value.trim().toUpperCase()).filter(value => ['ID','JP'].includes(value));
const concurrency = Math.max(1, Math.min(5, Number(process.env.POKEPEDIA_RECOVERY_CONCURRENCY || 3) || 3));
const delayMs = Math.max(250, Number(process.env.POKEPEDIA_RECOVERY_DELAY_MS || 350) || 350);
const apply = process.argv.includes('--apply');
const limit = Math.max(0, Number(process.env.POKEPEDIA_RECOVERY_LIMIT || 0) || 0);
const offset = Math.max(0, Number(process.env.POKEPEDIA_RECOVERY_OFFSET || 0) || 0);
const pageSize = 250;

if (!languages.length) throw new Error('Choose ID and/or JP in POKEPEDIA_RECOVERY_LANGUAGES.');

const jobs = [];
for (const language of languages) {
  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({ game: 'pokemon', language, missingImages: '1', limit: String(pageSize), offset: String(offset), sort: 'latest' });
    const response = await fetch(`${origin}/api/cards/catalog?${params}`, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Could not read ${language} catalog page at offset ${offset} (${response.status}).`);
    const body = await response.json();
    if (!Array.isArray(body.cards)) throw new Error(`The ${language} catalog response did not include cards.`);
    for (const card of body.cards) {
      const imageUrl = card.card_image_url;
      if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/pokemon/art/')) continue;
      jobs.push({ language, id: card.id, set: card.set_code, number: card.printing_code, url: new URL(imageUrl, origin).toString() });
    }
    if (body.cards.length < pageSize) break;
  }
}

const selected = jobs.slice(offset, limit ? offset + limit : undefined);
console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', languages, candidates: jobs.length, offset, selected: selected.length, concurrency, delayMs }));
if (!apply) {
  console.log('Preview only. Add --apply to fetch missing Pokepedia artwork through VivrePlay and cache successful images in R2.');
  process.exit(0);
}

let cursor = 0;
let nextStartAt = 0;
let recovered = 0;
let unavailable = 0;
let failed = 0;
const failures = [];
const unavailableCards = [];
async function recover(job) {
  const wait = Math.max(0, nextStartAt - Date.now());
  nextStartAt = Math.max(nextStartAt, Date.now()) + delayMs;
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  const response = await fetch(job.url, { headers: { accept: 'image/webp,image/*;q=0.8' }, signal: AbortSignal.timeout(45_000) });
  const contentType = response.headers.get('content-type')?.split(';')[0].toLowerCase() ?? '';
  if (response.status === 404) { unavailable++; unavailableCards.push({ language: job.language, set: job.set, number: job.number, id: job.id }); return; }
  if (!response.ok || !contentType.startsWith('image/')) throw new Error(`Proxy returned ${response.status} (${contentType || 'no image content type'}).`);
  await response.arrayBuffer();
  recovered++;
}

await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, async () => {
  while (cursor < selected.length) {
    const job = selected[cursor++];
    try { await recover(job); }
    catch (error) { failed++; failures.push({ language: job.language, set: job.set, number: job.number, id: job.id, reason: error instanceof Error ? error.message : 'Request failed' }); }
    const completed = recovered + unavailable + failed;
    if (completed % 25 === 0 || completed === selected.length) console.log(JSON.stringify({ completed, total: selected.length, recovered, unavailable, failed }));
  }
}));
console.log(JSON.stringify({ recovered, unavailable, failed, unavailableCards, failures }));
if (failed) process.exitCode = 1;
