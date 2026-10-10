import {database} from '@/lib/server/database';
import {readPublicEdgeCache,storePublicEdgeCache} from '@/lib/server/public-edge-cache';
import {supabaseAdmin} from '@/lib/server/supabase-storage';
import {isPlayableSet,PREVIEW_CARD_CODES} from '@/packages/domain/release-availability';
import {CARD_CATALOG_CACHE_REVISION} from '@/lib/card-catalog-cache';

type IdentityRow={id:string;code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string;rarity?:string|null;imageUrl?:string;set_code?:string|null;tcg_card_printings?:Array<{language:string;rarity:string|null;set_code:string|null;card_image_url:string|null;tcg_card_assets?:Array<{kind:string;object_key:string}>}>};
type SearchFilters={terms:string[];setCode?:string;rarity?:string;cardType?:string;cost?:number};

function publicCardPath(objectKey:string){
  return `/${objectKey.replace(/^\/+/, '').replace(/^one-piece\/([^/]+)\//,(_,setCode:string)=>`${setCode.replaceAll('-','')}/`)}`;
}

function parseSearch(query:string):SearchFilters{
  let remaining=query;
  let cost:number|undefined;
  const costMatch=remaining.match(/\b(?:cost\s*)?(\d{1,2})\s*c\b|\bcost\s*(\d{1,2})\b/i);
  if(costMatch){cost=Number(costMatch[1]??costMatch[2]);remaining=remaining.replace(costMatch[0],' ')}
  let setCode:string|undefined;
  remaining=remaining.replace(/\b(OP|ST|EB|PRB|EX)-?(\d{1,2})\b/ig,(_match,prefix:string,number:string)=>{setCode=`${prefix.toUpperCase()}-${number.padStart(2,'0')}`;return ' '});
  let cardType:string|undefined;
  remaining=remaining.replace(/\b(leaders?|characters?|events?|stages?|dons?)\b/ig,(word)=>{
    const normalized=word.toLowerCase().replace(/s$/,'');
    cardType=normalized==='leader'?'Leader':normalized==='character'?'Character':normalized==='event'?'Event':normalized==='stage'?'Stage':'DON!!';
    return ' ';
  });
  let rarity:string|undefined;
  remaining=remaining.replace(/\b(PSEC|SEC|SP|SR|UC|TR|R|C|L)\b/ig,(word)=>{rarity=word.toUpperCase();return ' '});
  const terms=[...new Set(remaining.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').split(/\s+/).filter(term=>term.length>=2))].slice(0,8);
  return {terms,setCode,rarity,cardType,cost};
}

async function fromD1(filters:SearchFilters){
  const where=["i.game_id=(SELECT id FROM tcg_games WHERE slug=?)"];
  const values:(string|number)[]=['one-piece'];
  if(filters.terms.length){
    where.push('i.id IN (SELECT identity_id FROM tcg_card_identity_search WHERE tcg_card_identity_search MATCH ?)');
    values.push(filters.terms.map(term=>`${term}*`).join(' AND '));
  }
  if(filters.setCode){where.push('i.id IN (SELECT identity_id FROM tcg_card_printings WHERE set_code=?)');values.push(filters.setCode)}
  if(filters.rarity){where.push('i.id IN (SELECT identity_id FROM tcg_card_printings WHERE rarity=?)');values.push(filters.rarity)}
  if(filters.cardType){where.push(filters.cardType==='DON!!'?'UPPER(i.card_type) IN (\'DON\',\'DON!!\')':'i.card_type=?');if(filters.cardType!=='DON!!')values.push(filters.cardType)}
  if(filters.cost!==undefined){where.push('i.cost=?');values.push(filters.cost)}
  const {results}=await database().prepare(`
    SELECT i.id,i.code,i.name,i.color,i.card_type,i.cost,i.power,i.effect_text,
      (SELECT p.rarity FROM tcg_card_printings p WHERE p.identity_id=i.id AND p.language='EN' ORDER BY p.set_code,p.id LIMIT 1) AS rarity,
      (SELECT p.set_code FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS set_code,
      (SELECT COALESCE(NULLIF(a.object_key,''),NULLIF(p.card_image_url,'')) FROM tcg_card_printings p LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small' WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS imageUrl
    FROM tcg_card_identities i
    WHERE ${where.join(' AND ')}
    ORDER BY i.code LIMIT 30
  `).bind(...values).all<IdentityRow>();
  return results;
}

async function fromSupabase(filters:SearchFilters){
  const db=supabaseAdmin();if(!db)throw new Error('Card catalog is unavailable.');
  let matchedIds:Set<string>|null=null;
  const patterns=[...filters.terms.map(term=>`%${term}%`),...(filters.setCode?[`%${filters.setCode}%`]:[]),...(filters.rarity?[`%${filters.rarity}%`]:[])];
  for(const token of patterns){
    const [identities,printings]=await Promise.all([
      db.from('tcg_card_identities').select('id').or(`code.ilike.${token},name.ilike.${token}`).limit(250),
      db.from('tcg_card_printings').select('identity_id').or(`set_code.ilike.${token},rarity.ilike.${token}`).limit(1000),
    ]);
    if(identities.error)throw identities.error;if(printings.error)throw printings.error;
    const tokenIds=new Set<string>([...((identities.data??[]) as Array<{id:string}>).map(row=>row.id),...((printings.data??[]) as Array<{identity_id:string}>).map(row=>row.identity_id)]);
    if(matchedIds===null)matchedIds=tokenIds;else{const intersection=new Set<string>();for(const id of matchedIds)if(tokenIds.has(id))intersection.add(id);matchedIds=intersection}
    if(!matchedIds.size)return [];
  }
  const ids=[...(matchedIds??[])].slice(0,100);if(!ids.length)return [];
  let query=db.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text,tcg_card_printings(language,rarity,set_code,card_image_url,tcg_card_assets(kind,object_key))').in('id',ids).limit(100);
  if(filters.cardType)query=query.eq('card_type',filters.cardType);
  if(filters.cost!==undefined)query=query.eq('cost',filters.cost);
  const {data,error}=await query;if(error)throw error;
  return ((data??[]) as unknown as IdentityRow[]).map(row=>{const printing=row.tcg_card_printings?.find(item=>item.language==='EN')??row.tcg_card_printings?.[0];const imageKey=printing?.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key??printing?.card_image_url??'';return{...row,rarity:printing?.rarity??null,set_code:printing?.set_code??null,imageUrl:imageKey.startsWith('http')?imageKey:imageKey?publicCardPath(imageKey):undefined}});
}

export async function GET(request:Request){
  const raw=new URL(request.url).searchParams.get('q')?.trim()??'';
  const query=raw.replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim();
  if(query.length<2)return Response.json({cards:[]});
  const cacheUrl=new URL(request.url);
  cacheUrl.searchParams.set('q',query);
  cacheUrl.searchParams.set('_catalog',CARD_CATALOG_CACHE_REVISION);
  const cacheRequest=new Request(cacheUrl,request);
  const cached=await readPublicEdgeCache(cacheRequest);
  if(cached)return cached;
  const filters=parseSearch(query);
  if(!filters.terms.length&&!filters.setCode&&!filters.rarity&&!filters.cardType&&filters.cost===undefined)return Response.json({cards:[]});
  let cards:IdentityRow[];
  try{cards=await fromD1(filters)}catch{try{cards=await fromSupabase(filters)}catch{return Response.json({error:'Card catalog is temporarily unavailable.'},{status:503})}}
  cards=cards.filter(card=>isPlayableSet(card.set_code??'')||PREVIEW_CARD_CODES.has(card.code.toUpperCase()));
  return storePublicEdgeCache(cacheRequest,Response.json({cards:cards.map(card=>({...card,imageUrl:card.imageUrl?.startsWith('http')||card.imageUrl?.startsWith('/')?card.imageUrl:card.imageUrl?publicCardPath(card.imageUrl):undefined}))},{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=86400','Cloudflare-CDN-Cache-Control':'public, max-age=86400'}}));
}
