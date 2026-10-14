import {database} from '@/lib/server/database';
import {readPublicEdgeCache,storePublicEdgeCache} from '@/lib/server/public-edge-cache';
import {supabaseAdmin} from '@/lib/server/supabase-storage';
import {isPlayableSet,PREVIEW_CARD_CODES} from '@/packages/domain/release-availability';
import {CARD_CATALOG_CACHE_REVISION} from '@/lib/card-catalog-cache';
import {env} from 'cloudflare:workers';
import {parseCardSearch,type ParsedCardSearch} from '@/lib/card-search';

type IdentityRow={id:string;printingId?:string;printingCode?:string|null;language?:string|null;code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string;rarity?:string|null;imageUrl?:string;set_code?:string|null;tcg_card_printings?:Array<{id:string;printing_code?:string|null;language:string;rarity:string|null;set_code:string|null;card_image_url:string|null;tcg_card_assets?:Array<{kind:string;object_key:string}>}>};
type SearchFilters=ParsedCardSearch;
type SearchIndexCard=IdentityRow&{setCodes:string[];rarities:string[];searchTokens:string[]};

const searchToken=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];

function internalImageUrl(value:string|undefined|null,setCode:string,language:string,printingCode:string){
  if(value?.startsWith('/'))return value;
  if(value?.startsWith('one-piece/'))return publicCardPath(value);
  if(value?.startsWith('http')){
    try{
      const source=new URL(value);
      const [,folder,sourceLanguage,...parts]=source.pathname.split('/');
      const filename=parts.at(-1);
      if(source.hostname==='cards.oplaytcg.com'&&folder&&sourceLanguage&&filename&&folder.toLowerCase()!=='tcg'&&!filename.toLowerCase().startsWith('tcg-'))return `/${encodeURIComponent(folder)}/${encodeURIComponent(sourceLanguage.toLowerCase())}/${encodeURIComponent(filename)}`;
    }catch{}
  }
  const normalizedSet=setCode.replaceAll('-','');
  return normalizedSet&&printingCode?`/${encodeURIComponent(normalizedSet)}/${encodeURIComponent(language.toLowerCase())}/${encodeURIComponent(printingCode)}.webp`:undefined;
}

function filterIndex(index:SearchIndexCard[],filters:SearchFilters){
  const normalize=(value:string)=>value.replace(/[^a-z0-9]/gi,'').toUpperCase();
  return index.filter(card=>(!filters.terms.length||filters.terms.every(term=>card.searchTokens.some(token=>token.startsWith(term))))&&(!filters.code||normalize(card.code)===normalize(filters.code))&&(!filters.setCode||card.setCodes.some(code=>normalize(code)===normalize(filters.setCode!)))&&(!filters.rarity||card.rarities.includes(filters.rarity))&&(!filters.cardType||(filters.cardType==='DON!!'?['DON','DON!!'].includes(card.card_type.toUpperCase()):card.card_type===filters.cardType))&&(!filters.color||card.color.toLowerCase().includes(filters.color.toLowerCase()))&&(filters.cost===undefined||card.cost===filters.cost)).slice(0,30).map(({setCodes:_setCodes,rarities:_rarities,searchTokens:_searchTokens,...card})=>card);
}

async function buildSearchIndex():Promise<SearchIndexCard[]>{
  const {results}=await database().prepare(`
    SELECT i.id,i.code,i.name,i.color,i.card_type,i.cost,i.power,i.effect_text,
      (SELECT p.id FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS printingId,
      (SELECT p.printing_code FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS printingCode,
      (SELECT p.language FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS language,
      (SELECT p.rarity FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS rarity,
      (SELECT p.set_code FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS set_code,
      (SELECT COALESCE(NULLIF(a.object_key,''),NULLIF(p.card_image_url,'')) FROM tcg_card_printings p LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small' WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS imageUrl,
      (SELECT json_group_array(DISTINCT p.set_code) FROM tcg_card_printings p WHERE p.identity_id=i.id AND p.set_code IS NOT NULL) AS setCodes,
      (SELECT json_group_array(DISTINCT p.rarity) FROM tcg_card_printings p WHERE p.identity_id=i.id AND p.rarity IS NOT NULL) AS rarities
    FROM tcg_card_identities i WHERE i.game_id=(SELECT id FROM tcg_games WHERE slug=?) ORDER BY i.code
  `).bind('one-piece').all<IdentityRow&{setCodes:string;rarities:string}>();
  return results.flatMap(row=>{
    const setCodes=JSON.parse(row.setCodes||'[]') as string[],rarities=JSON.parse(row.rarities||'[]') as string[];
    const code=row.code.toUpperCase(),setCode=row.set_code??'';
    if(!isPlayableSet(setCode)&&!PREVIEW_CARD_CODES.has(code))return [];
    const imageUrl=internalImageUrl(row.imageUrl,setCode,'EN',row.code);
    return [{...row,setCodes,rarities,searchTokens:searchToken(`${row.code} ${row.name} ${row.color} ${row.card_type}`),imageUrl}];
  });
}

async function readSearchIndex(request:Request):Promise<SearchIndexCard[]|null>{
  const url=new URL('/api/cards/identities/search-index',request.url);url.searchParams.set('catalogRevision',CARD_CATALOG_CACHE_REVISION);
  const cacheRequest=new Request(url,{method:'GET'}),cached=await readPublicEdgeCache(cacheRequest);
  if(cached){try{return await cached.json<SearchIndexCard[]>();}catch{}}
  const key=`catalog-snapshots/identity-search-${CARD_CATALOG_CACHE_REVISION}.json`;
  try{
    let object=await env.CARD_IMAGES?.get(key),index:SearchIndexCard[];
    if(object)index=await object.json<SearchIndexCard[]>();
    else{
      index=await buildSearchIndex();
      await env.CARD_IMAGES?.put(key,JSON.stringify(index),{httpMetadata:{contentType:'application/json; charset=utf-8',cacheControl:'public, max-age=31536000, immutable'}});
    }
    const response=Response.json(index,{headers:{'Cache-Control':'public, max-age=31536000, immutable','Cloudflare-CDN-Cache-Control':'public, max-age=31536000, immutable'}});
    await storePublicEdgeCache(cacheRequest,response);
    return index;
  }catch{return null;}
}

function publicCardPath(objectKey:string){
  const match=objectKey.replace(/^\/+/, '').match(/^one-piece\/([^/]+)\/([^/]+)\/(?:small\/|thumb\/|large\/)?(.+)$/);
  return match?`/${encodeURIComponent(match[1].replaceAll('-',''))}/${encodeURIComponent(match[2].toLowerCase())}/${match[3].split('/').map(encodeURIComponent).join('/')}`:'';
}

async function fromD1(filters:SearchFilters){
  const where=["i.game_id=(SELECT id FROM tcg_games WHERE slug=?)"];
  const values:(string|number)[]=['one-piece'];
  if(filters.code){where.push('UPPER(i.code)=?');values.push(filters.code)}
  if(filters.terms.length){
    where.push('i.id IN (SELECT identity_id FROM tcg_card_identity_search WHERE tcg_card_identity_search MATCH ?)');
    values.push(filters.terms.map(term=>`${term}*`).join(' AND '));
  }
  if(filters.setCode){where.push('i.id IN (SELECT identity_id FROM tcg_card_printings WHERE UPPER(REPLACE(set_code,\'-\',\'\'))=?)');values.push(filters.setCode)}
  if(filters.rarity){where.push('i.id IN (SELECT identity_id FROM tcg_card_printings WHERE rarity=?)');values.push(filters.rarity)}
  if(filters.cardType){where.push(filters.cardType==='DON!!'?'UPPER(i.card_type) IN (\'DON\',\'DON!!\')':'i.card_type=?');if(filters.cardType!=='DON!!')values.push(filters.cardType)}
  if(filters.cost!==undefined){where.push('i.cost=?');values.push(filters.cost)}
  if(filters.color){where.push('LOWER(i.color) LIKE ?');values.push(`%${filters.color.toLowerCase()}%`)}
  const {results}=await database().prepare(`
    SELECT i.id,i.code,i.name,i.color,i.card_type,i.cost,i.power,i.effect_text,
      (SELECT p.id FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS printingId,
      (SELECT p.printing_code FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS printingCode,
      (SELECT p.language FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS language,
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
  const setPattern=filters.setCode?.replace(/^([A-Z]+)(\d+)$/,'$1%$2');
  const patterns=[...filters.terms.map(term=>`%${term}%`),...(filters.code?[`%${filters.code}%`]:[]),...(setPattern?[`%${setPattern}%`]:[]),...(filters.rarity?[`%${filters.rarity}%`]:[])];
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
  let query=db.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text,tcg_card_printings(id,printing_code,language,rarity,set_code,card_image_url,tcg_card_assets(kind,object_key))').in('id',ids).limit(100);
  if(filters.cardType)query=query.eq('card_type',filters.cardType);
  if(filters.cost!==undefined)query=query.eq('cost',filters.cost);
  if(filters.code)query=query.eq('code',filters.code);
  if(filters.color)query=query.ilike('color',`%${filters.color}%`);
  const {data,error}=await query;if(error)throw error;
  const normalize=(value:string)=>value.replace(/[^a-z0-9]/gi,'').toUpperCase();
  return ((data??[]) as unknown as IdentityRow[]).filter(row=>{
    const printings=row.tcg_card_printings??[];
    return (!filters.setCode||printings.some(item=>normalize(item.set_code??'')===normalize(filters.setCode!)))&&(!filters.rarity||printings.some(item=>item.rarity===filters.rarity));
  }).map(row=>{const printings=row.tcg_card_printings??[];const wantedSet=normalize(filters.setCode??'');const printing=printings.find(item=>(!filters.setCode||normalize(item.set_code??'')===wantedSet)&&(!filters.rarity||item.rarity===filters.rarity)&&item.language==='EN')??printings.find(item=>(!filters.setCode||normalize(item.set_code??'')===wantedSet)&&(!filters.rarity||item.rarity===filters.rarity))??printings.find(item=>item.language==='EN')??printings[0];const imageKey=printing?.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key??printing?.card_image_url??'';return{...row,printingId:printing?.id,printingCode:printing?.printing_code??row.code,language:printing?.language??'EN',rarity:printing?.rarity??null,set_code:printing?.set_code??null,imageUrl:internalImageUrl(imageKey,printing?.set_code??'',printing?.language??'EN',printing?.printing_code??row.code)}});
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
  const filters=parseCardSearch(query);
  if(!filters.terms.length&&!filters.code&&!filters.setCode&&!filters.rarity&&!filters.cardType&&filters.cost===undefined&&!filters.color)return Response.json({cards:[]});
  let cards:IdentityRow[];
  const index=await readSearchIndex(request);
  if(index)cards=filterIndex(index,filters);
  else try{cards=await fromD1(filters)}catch{try{cards=await fromSupabase(filters)}catch{return Response.json({error:'Card catalog is temporarily unavailable.'},{status:503})}}
  cards=cards.filter(card=>isPlayableSet(card.set_code??'')||PREVIEW_CARD_CODES.has(card.code.toUpperCase()));
  return storePublicEdgeCache(cacheRequest,Response.json({cards:cards.map(card=>({...card,printingId:card.printingId??card.id,imageUrl:internalImageUrl(card.imageUrl,card.set_code??'',card.language??'EN',card.printingCode??card.code)}))},{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=86400','Cloudflare-CDN-Cache-Control':'public, max-age=86400'}}));
}
