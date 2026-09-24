import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before repairing assets.');

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const printings: { id: string; card_image_id: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('tcg_card_printings').select('id,card_image_id').eq('language', 'JP').range(from, from + 999);
    if (error) throw error;
    printings.push(...data);
    if (data.length < 1000) break;
  }
  const rows = printings.flatMap(printing => {
    const code = printing.card_image_id?.toLowerCase();
    if (!code) return [];
    const setFolder = code.split('-')[0];
    return ([['thumb', 180], ['small', 420], ['large', 960]] as const).map(([kind, width]) => ({
      printing_id: printing.id,
      kind,
      object_key: `one-piece/${setFolder}/jp/${kind}/${code}.webp`,
      width,
    }));
  });
  for (let index = 0; index < rows.length; index += 250) {
    const { error } = await supabase.from('tcg_card_assets').upsert(rows.slice(index, index + 250), { onConflict: 'printing_id,kind' });
    if (error) throw error;
  }
  console.log(JSON.stringify({ jpPrintings: printings.length, assetRecords: rows.length }, null, 2));
}

await main();
