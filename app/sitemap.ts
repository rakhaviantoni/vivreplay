import type {MetadataRoute} from 'next';
import {db} from '@/lib/server/store';

const base='https://vivreplay.com';
const corePaths=['/','/about','/cards','/cards/index','/archetypes','/sets','/market','/meta','/play','/play/tutorial','/decks','/legal/terms','/legal/privacy','/legal/refund','/faq'];

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const now=new Date();
  const entries:MetadataRoute.Sitemap=corePaths.map(path=>({url:`${base}${path}`,lastModified:now,changeFrequency:path==='/cards'||path==='/market'?'daily':'weekly',priority:path==='/'?1:(path==='/cards'||path==='/market'?0.9:0.65)}));
  for(const path of ['/legal/terms','/legal/privacy','/legal/refund','/faq'])entries.push({url:`${base}/id${path}`,lastModified:now,changeFrequency:'weekly',priority:.6});
  try{
    const [cards,sets]=await Promise.all([
      db().prepare('SELECT code,updated_at FROM tcg_card_identities ORDER BY code').all<{code:string;updated_at:string}>(),
      db().prepare('SELECT external_set_id,release_date FROM tcg_sets ORDER BY external_set_id').all<{external_set_id:string;release_date:string|null}>(),
    ]);
    entries.push(...cards.results.map(row=>({url:`${base}/cards/${encodeURIComponent(row.code)}`,lastModified:row.updated_at?new Date(row.updated_at):now,changeFrequency:'monthly' as const,priority:.55})));
    entries.push(...sets.results.map(row=>({url:`${base}/sets/${encodeURIComponent(row.external_set_id)}`,lastModified:row.release_date?new Date(row.release_date):now,changeFrequency:'monthly' as const,priority:.55})));
  }catch{}
  return entries;
}
