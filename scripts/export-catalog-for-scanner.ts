import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const output = resolve(process.argv[2] ?? 'services/card-scanner/data/catalog_seed.json');
mkdirSync(dirname(output), { recursive: true });

console.log('Querying catalog printings from D1 database...');

const query = `
  SELECT 
    p.id,
    i.code,
    COALESCE(NULLIF(l.name, ''), i.name) AS name,
    g.slug AS game,
    p.set_code AS setCode,
    p.printing_code AS cardNumber,
    p.language,
    COALESCE(p.rarity, '') AS rarity,
    COALESCE(p.variant, 'Standard') AS variant,
    p.card_image_url AS imageUrl
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

const parsed = JSON.parse(result) as Array<{ results: Array<unknown> }>;
const cards = parsed[0]?.results ?? [];

console.log(`Found ${cards.length} cards with images.`);
writeFileSync(output, JSON.stringify(cards, null, 2), 'utf8');
console.log(`Wrote catalog seed to ${output}`);
