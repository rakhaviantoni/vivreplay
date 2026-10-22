import {database} from '@/lib/server/database';
import {readPublicEdgeCache,storePublicEdgeCache} from '@/lib/server/public-edge-cache';
import {isPlayableSet,PREVIEW_CARD_CODES} from '@/packages/domain/release-availability';
import {CARD_CATALOG_CACHE_REVISION} from '@/lib/card-catalog-cache';
import {env} from 'cloudflare:workers';
import {parseCardSearch,type ParsedCardSearch} from '@/lib/card-search';

type IdentityRow={id:string;printingId?:string;printingCode?:string|null;language?:string|null;code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string;rarity?:string|null;imageUrl?:string;set_code?:string|null;tcg_card_printings?:Array<{id:string;printing_code?:string|null;language:string;rarity:string|null;set_code:string|null;card_image_url:string|null;tcg_card_assets?:Array<{kind:string;object_key:string}>}>};
type SearchFilters=ParsedCardSearch;
type SearchIndexCard=IdentityRow&{setCodes:string[];rarities:string[];searchTokens:string[];printingSearchText?:string};

const searchToken=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];

function internalImageUrl(value:string|undefined|null,setCode:string,language:string,printingCode:string){
  if(value?.startsWith('/'))return value;
  if(value?.startsWith('one-piece/'))return publicCardPath(value);
  if(value?.startsWith('http')){
    try{
      const source=new URL(value);
      const [,folder,sourceLanguage,...parts]=source.pathname.split('/');
      const filename=parts.at(-1);
      if(source.hostname==='assets.tcgdex.net'&&source.protocol==='https:'){
        const pathParts=source.pathname.split('/').filter(Boolean);
        const tcgLanguage=pathParts[0]?.toLowerCase()==='id'?'id':pathParts[0]?.toLowerCase()==='ja'||pathParts[0]?.toLowerCase()==='jp'?'jp':pathParts[0]?.toLowerCase()==='en'?'en':'';
        const tcgSet=pathParts.at(-3),tcgCard=pathParts.at(-2);
        if(tcgLanguage&&tcgSet&&tcgCard)return `/pokemon/art/${tcgLanguage}/${encodeURIComponent(tcgSet)}/${encodeURIComponent(tcgCard)}`;
      }
      if(source.hostname==='cards.oplaytcg.com'&&folder&&sourceLanguage&&filename&&folder.toLowerCase()!=='tcg'&&!filename.toLowerCase().startsWith('tcg-'))return `/${encodeURIComponent(folder)}/${encodeURIComponent(sourceLanguage.toLowerCase())}/${encodeURIComponent(filename)}`;
    }catch{}
  }
  const normalizedSet=setCode.replaceAll('-','');
  return normalizedSet&&printingCode?`/${encodeURIComponent(normalizedSet)}/${encodeURIComponent(language.toLowerCase())}/${encodeURIComponent(printingCode)}.webp`:undefined;
}

function filterIndex(index:SearchIndexCard[],filters:SearchFilters){
  const normalize=(value:string)=>value.replace(/[^a-z0-9]/gi,'').toUpperCase();
  return index.filter(card=>(!filters.terms.length||filters.terms.every(term=>card.searchTokens.some(token=>token.startsWith(term))))&&(!filters.code||normalize(card.code)===normalize(filters.code))&&(!filters.setCode||card.setCodes.some(code=>normalize(code)===normalize(filters.setCode!)))&&(!filters.rarity||card.rarities.includes(filters.rarity))&&(!filters.cardType||(filters.cardType==='DON!!'?['DON','DON!!'].includes(card.card_type.toUpperCase()):card.card_type===filters.cardType))&&(!filters.color||card.color.toLowerCase().includes(filters.color.toLowerCase()))&&(filters.cost===undefined||card.cost===filters.cost)).slice(0,30).map(({setCodes:_setCodes,rarities:_rarities,searchTokens:_searchTokens,printingSearchText:_printingSearchText,...card})=>card);
}

async function buildSearchIndex(gameSlug:'one-piece'|'pokemon'):Promise<SearchIndexCard[]>{
  const {results}=await database().prepare(`
    SELECT i.id,i.code,i.name,i.color,i.card_type,i.cost,i.power,i.effect_text,
      (SELECT p.id FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS printingId,
      (SELECT p.printing_code FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS printingCode,
      (SELECT p.language FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS language,
      (SELECT p.rarity FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS rarity,
      (SELECT p.set_code FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS set_code,
      (SELECT COALESCE(NULLIF(a.object_key,''),NULLIF(p.card_image_url,'')) FROM tcg_card_printings p LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small' WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS imageUrl,
      (SELECT json_group_array(DISTINCT p.set_code) FROM tcg_card_printings p WHERE p.identity_id=i.id AND p.set_code IS NOT NULL) AS setCodes,
      (SELECT json_group_array(DISTINCT p.rarity) FROM tcg_card_printings p WHERE p.identity_id=i.id AND p.rarity IS NOT NULL) AS rarities,
      (SELECT group_concat(COALESCE(p.set_code,'')||' '||COALESCE(p.set_name,'')||' '||COALESCE(p.printing_code,'')||' '||COALESCE(p.variant,'')||' '||COALESCE(p.rarity,'')||' '||COALESCE(p.language,'')||CASE p.language WHEN 'ID' THEN ' Indonesian Indonesia Indo Bahasa' WHEN 'JP' THEN ' Japanese Japan' WHEN 'EN' THEN ' English' ELSE '' END,' ') FROM tcg_card_printings p WHERE p.identity_id=i.id) AS printingSearchText
    FROM tcg_card_identities i WHERE i.game_id=(SELECT id FROM tcg_games WHERE slug=?) ORDER BY i.code
  `).bind(gameSlug).all<IdentityRow&{setCodes:string;rarities:string;printingSearchText?:string}>();
  return results.flatMap(row=>{
    const setCodes=JSON.parse(row.setCodes||'[]') as string[],rarities=JSON.parse(row.rarities||'[]') as string[];
    const code=row.code.toUpperCase(),setCode=row.set_code??'';
    if(gameSlug==='one-piece'&&!isPlayableSet(setCode)&&!PREVIEW_CARD_CODES.has(code))return [];
    const imageUrl=internalImageUrl(row.imageUrl,setCode,'EN',row.code);
    return [{...row,setCodes,rarities,searchTokens:searchToken(`${row.code} ${row.name} ${row.color} ${row.card_type} ${row.printingSearchText??''}`),imageUrl}];
  });
}

async function readSearchIndex(request:Request,gameSlug:'one-piece'|'pokemon'):Promise<SearchIndexCard[]|null>{
  const url=new URL('/api/cards/identities/search-index',request.url);url.searchParams.set('catalogRevision',CARD_CATALOG_CACHE_REVISION);url.searchParams.set('game',gameSlug);
  const cacheRequest=new Request(url,{method:'GET'}),cached=await readPublicEdgeCache(cacheRequest);
  if(cached){try{return await cached.json<SearchIndexCard[]>();}catch{}}
  const key=`catalog-snapshots/identity-search-${gameSlug}-${CARD_CATALOG_CACHE_REVISION}.json`;
  try{
    let object=await env.CARD_IMAGES?.get(key),index:SearchIndexCard[];
    if(object)index=await object.json<SearchIndexCard[]>();
    else{
      index=await buildSearchIndex(gameSlug);
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

async function fromD1(filters:SearchFilters,gameSlug:'one-piece'|'pokemon'){
  const where=["i.game_id=(SELECT id FROM tcg_games WHERE slug=?)"];
  const values:(string|number)[]=[gameSlug];
  if(filters.code){where.push('UPPER(i.code)=?');values.push(filters.code)}
  if(filters.terms.length){
    if(gameSlug==='pokemon'){
      for(const term of filters.terms){
        where.push(`(i.id IN (SELECT identity_id FROM tcg_card_identity_search WHERE tcg_card_identity_search MATCH ?) OR i.id IN (
          SELECT p.identity_id FROM tcg_card_printings p
          WHERE LOWER(COALESCE(p.set_code,'')||' '||COALESCE(p.set_name,'')||' '||COALESCE(p.printing_code,'')||' '||COALESCE(p.variant,'')||' '||COALESCE(p.rarity,'')||' '||COALESCE(p.language,'')||CASE p.language WHEN 'ID' THEN ' indonesian indonesia indo bahasa' WHEN 'JP' THEN ' japanese japan' WHEN 'EN' THEN ' english' ELSE '' END) LIKE ?
        ))`);
        values.push(`${term}*`,`%${term.toLowerCase()}%`);
      }
    }else{
      where.push('i.id IN (SELECT identity_id FROM tcg_card_identity_search WHERE tcg_card_identity_search MATCH ?)');
      values.push(filters.terms.map(term=>`${term}*`).join(' AND '));
    }
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

export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  const gameSlug=params.get('game')==='pokemon'?'pokemon':'one-piece';
  const raw=params.get('q')?.trim()??'';
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
  const index=await readSearchIndex(request,gameSlug);
  if(index)cards=filterIndex(index,filters);
  else try{cards=await fromD1(filters,gameSlug)}catch{return Response.json({error:'Card catalog is temporarily unavailable.'},{status:503})}
  if(gameSlug==='one-piece')cards=cards.filter(card=>isPlayableSet(card.set_code??'')||PREVIEW_CARD_CODES.has(card.code.toUpperCase()));
  return storePublicEdgeCache(cacheRequest,Response.json({cards:cards.map(card=>({...card,printingId:card.printingId??card.id,imageUrl:internalImageUrl(card.imageUrl,card.set_code??'',card.language??'EN',card.printingCode??card.code)}))},{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=86400','Cloudflare-CDN-Cache-Control':'public, max-age=86400'}}));
}
