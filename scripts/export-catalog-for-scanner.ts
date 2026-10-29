import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { pokemonLocalCardNumber } from '../lib/pokemon-set-aliases';

const output = resolve(process.argv[2] ?? 'services/card-scanner/data/catalog_seed.json.gz');
mkdirSync(dirname(output), { recursive: true });

console.log('Querying catalog printings from D1 database...');

const query = `
  SELECT 
    p.id,
    i.code,
    COALESCE(NULLIF(l.name, ''), i.name) AS name,
    g.slug AS game,
    p.set_code AS setCode,
    COALESCE(
      NULLIF(json_extract(p.source_payload, '$.collectorNumber'), ''),
      NULLIF(json_extract(p.source_payload, '$.localId'), ''),
      CASE WHEN p.printing_code LIKE 'CT-%' THEN '' ELSE p.printing_code END
    ) AS cardNumber,
    p.language,
    COALESCE(p.rarity, '') AS rarity,
    COALESCE(p.variant, 'Standard') AS variant,
    p.card_image_url AS imageUrl,
    p.source_payload AS sourcePayload
  FROM tcg_card_printings p
  JOIN tcg_card_identities i ON i.id = p.identity_id
  JOIN tcg_games g ON g.id = i.game_id
  LEFT JOIN tcg_card_localizations l ON l.identity_id = i.id AND l.language = p.language
  WHERE p.card_image_url IS NOT NULL AND p.card_image_url != ''
  ORDER BY g.slug, p.set_code, p.printing_code;
`;

const result = execFileSync('npx', [
  'wrangler', 'd1', 'execute', 'DB',
  '--config', 'wrangler.migrations.json',
  '--remote',
  '--json',
  '--command', query
], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });

const parsed = JSON.parse(result) as Array<{ results: Array<any> }>;
const cards = parsed[0]?.results ?? [];

console.log(`Found ${cards.length} cards with images. Sanitizing card numbers...`);

for (const card of cards) {
  if (card.imageUrl && card.imageUrl.startsWith('/')) {
    card.imageUrl = `https://vivreplay.com${card.imageUrl.replace('/small/', '/')}`;
  }
  if (card.game === 'pokemon') {
    const local = pokemonLocalCardNumber(card.sourcePayload, '');
    if (local && !/^CT-\d+$/i.test(local)) {
      card.cardNumber = local;
    } else if (/^CT-\d+$/i.test(card.cardNumber)) {
      card.cardNumber = '';
    }
  }
  delete card.sourcePayload;
}

const jsonString = JSON.stringify(cards);
if (output.endsWith('.gz')) {
  writeFileSync(output, gzipSync(Buffer.from(jsonString, 'utf-8')));
  // Also write uncompressed json alongside
  writeFileSync(output.replace(/\.gz$/, ''), jsonString, 'utf8');
} else {
  writeFileSync(output, jsonString, 'utf8');
  writeFileSync(`${output}.gz`, gzipSync(Buffer.from(jsonString, 'utf-8')));
}

console.log(`Wrote catalog seed to ${output} (total ${cards.length} cards).`);
