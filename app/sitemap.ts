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
      db().prepare(`SELECT i.code,i.updated_at FROM tcg_card_identities i WHERE EXISTS(SELECT 1 FROM tcg_card_printings p WHERE p.identity_id=i.id) ORDER BY i.code`).all<{code:string;updated_at:string}>(),
      db().prepare(`SELECT replace(replace(upper(s.external_set_id),'-',''),'_','') AS code,MAX(s.release_date) AS release_date FROM tcg_sets s WHERE replace(replace(upper(s.external_set_id),'-',''),'_','') NOT IN ('OP19','EB06') AND EXISTS(SELECT 1 FROM tcg_card_printings p WHERE replace(replace(upper(p.set_code),'-',''),'_','')=replace(replace(upper(s.external_set_id),'-',''),'_','')) GROUP BY code ORDER BY code`).all<{code:string;release_date:string|null}>(),
    ]);
    entries.push(...cards.results.map(row=>({url:`${base}/cards/${encodeURIComponent(row.code)}`,lastModified:row.updated_at?new Date(row.updated_at):now,changeFrequency:'monthly' as const,priority:.55})));
    entries.push(...sets.results.map(row=>({url:`${base}/sets/${encodeURIComponent(row.code)}`,lastModified:row.release_date?new Date(row.release_date):now,changeFrequency:'monthly' as const,priority:.55})));
  }catch{}
  return entries;
}
