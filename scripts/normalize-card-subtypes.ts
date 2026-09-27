import {createClient} from '@supabase/supabase-js';
import {cardTraits, splitCardSubtypes} from '../lib/card-subtypes';

type Printing = {id: string; sub_types: unknown};
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

const supabase = createClient(url, serviceRole);
const rows: Printing[] = [];
for (let from = 0; ; from += 1000) {
  const {data, error} = await supabase.from('tcg_card_printings').select('id,sub_types').not('sub_types', 'is', null).range(from, from + 999);
  if (error) throw error;
  rows.push(...(data ?? []));
  if ((data?.length ?? 0) < 1000) break;
}

const unresolved = new Map<string, number>();
let changed = 0;
for (const row of rows) {
  const traits = splitCardSubtypes(row.sub_types);
  const before = typeof row.sub_types === 'string' ? row.sub_types : JSON.stringify(row.sub_types);
  const after = JSON.stringify(traits);
  if (before !== after) changed++;
  for (const trait of traits) if (!cardTraits.includes(trait as typeof cardTraits[number])) unresolved.set(trait, (unresolved.get(trait) ?? 0) + 1);
}
console.log(JSON.stringify({total: rows.length, changed, unresolved: [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 160)}, null, 2));

const pending = rows.filter(row => (typeof row.sub_types === 'string' ? row.sub_types : JSON.stringify(row.sub_types)) !== JSON.stringify(splitCardSubtypes(row.sub_types)));

if (process.argv.includes('--write')) {
  for (let start = 0; start < pending.length; start += 100) {
    const results = await Promise.all(pending.slice(start, start + 100).map(row => supabase.from('tcg_card_printings').update({sub_types: JSON.stringify(splitCardSubtypes(row.sub_types))}).eq('id', row.id)));
    for (const {error} of results) if (error) throw error;
    console.log(`Updated ${Math.min(start + 100, pending.length)}/${pending.length}.`);
  }
}
