import {database} from '@/lib/server/database';
import {env} from 'cloudflare:workers';
import {pokemonLocalCardNumber,pokemonSetAliases} from '@/lib/pokemon-set-aliases';
import {tcgdexArtResponse} from '@/lib/server/tcgdex-art-response';

const languageCodes:Record<string,string>={id:'ID',en:'EN',jp:'JP',ja:'JP'};
const normalized=(value:string)=>value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
type ArtRow={id:string;setCode:string;printingCode:string;language:string;imageUrl:string|null;sourcePayload:string;objectKey:string|null;cardName:string};

export async function servePokemonArt(request:Request,rawLanguage:string,rawSet:string,rawCard:string){
  const language=languageCodes[rawLanguage.toLowerCase()];
  if(!language||!/^[-\p{L}\p{N}._]{1,32}$/u.test(rawSet)||!/^[-\p{L}\p{N}._]{1,32}$/u.test(rawCard))return new Response('Not found',{status:404});
  try{
    const url=new URL(request.url),printingId=url.searchParams.get('printingId');
    if(printingId&&!/^[a-z0-9-]{36}$/i.test(printingId))return new Response('Not found',{status:404});
    const shortDescription="trim(CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.shortDescription') END)";
    const description="trim(CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.description') END)";
    const describedNumber=`CASE WHEN instr(${shortDescription},' ')>0 THEN substr(${shortDescription},instr(${shortDescription},' ')+1) WHEN instr(${description},'·')>0 THEN trim(substr(${description},instr(${description},'·')+1)) ELSE NULL END`;
    const localId=`COALESCE(NULLIF(trim(CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.localId') END),''),NULLIF(trim(CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.collectorNumber') END),''),NULLIF(${describedNumber},''),p.printing_code)`;
    const localCardNumber=`CASE WHEN instr(CAST(${localId} AS TEXT),'/')>0 THEN substr(CAST(${localId} AS TEXT),1,instr(CAST(${localId} AS TEXT),'/')-1) ELSE CAST(${localId} AS TEXT) END`;
    const row=await database().prepare(`
      SELECT p.id,p.set_code AS setCode,p.printing_code AS printingCode,p.language,p.card_image_url AS imageUrl,p.source_payload AS sourcePayload,a.object_key AS objectKey,i.name AS cardName
      FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id JOIN tcg_games g ON g.id=i.game_id LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small'
      WHERE g.slug='pokemon' AND p.language=?
        AND (? IS NULL OR p.id=?)
        AND (? IS NOT NULL OR UPPER(REPLACE(REPLACE(REPLACE(p.set_code,'-',''),'_',''),' ',''))=?)
        AND (? IS NOT NULL OR (UPPER(${localCardNumber})=UPPER(?) OR UPPER(p.printing_code)=UPPER(?)))
      ORDER BY CASE WHEN p.variant='Standard' THEN 0 ELSE 1 END,p.id LIMIT 1
    `).bind(language,printingId,printingId,printingId,normalized(rawSet),printingId,normalized(rawCard),rawCard).first<ArtRow>();
    if(!row)return new Response('Not found',{status:404});
    if(printingId){
      const payload=JSON.parse(row.sourcePayload||'{}') as Record<string,unknown>;
      const local=pokemonLocalCardNumber(payload,row.printingCode);
      const pathNumber=normalized(rawCard),rowNumber=normalized(local);
      const aliases=pokemonSetAliases(row.setCode,local).map(normalized);
      const legacyPrintingCode=normalized(row.printingCode);
      const privateAlias=`P${normalized(printingId).slice(0,8)}`;
      if((pathNumber!==rowNumber&&pathNumber!==legacyPrintingCode&&pathNumber!==privateAlias)||!aliases.includes(normalized(rawSet)))return new Response('Not found',{status:404});
    }
    if(row.objectKey){
      const stored=await env.CARD_IMAGES?.get(row.objectKey);
      if(stored)return new Response(stored.body,{headers:{'Content-Type':stored.httpMetadata?.contentType??'image/webp','Cache-Control':stored.httpMetadata?.cacheControl??'public, max-age=31536000, immutable','ETag':stored.httpEtag,'X-Content-Type-Options':'nosniff'}});
    }
    let payload:Record<string,unknown>={};
    try{payload=JSON.parse(row.sourcePayload||'{}') as Record<string,unknown>}catch{}
    const localCard=pokemonLocalCardNumber(payload,row.printingCode);
    const set=payload.set&&typeof payload.set==='object'?payload.set as Record<string,unknown>:{};
    const serie=set.serie&&typeof set.serie==='object'?set.serie as Record<string,unknown>:{};
    const sourceSet=String(set.id??row.setCode),serieId=String(serie.id??'');
    const sourceSetDirectories=[serieId?`${serieId}/${sourceSet}`:sourceSet];
    const sourceLanguage=language==='JP'?'ja':language.toLowerCase();
    const cardCount=set.cardCount&&typeof set.cardCount==='object'?set.cardCount as Record<string,unknown>:{};
    const officialRaw=String(cardCount.official??''),official=/^[0-9]{1,4}$/.test(officialRaw)?officialRaw.padStart(3,'0'):'';
    const candidates:string[]=[];
    if(row.imageUrl){
      const imageUrl=row.imageUrl.replace(/\/$/,'');
      if(/^https:\/\/cardtell\.id\/images\/products\/[0-9]{1,12}\.png(?:\?[^#]*)?$/i.test(imageUrl))candidates.push(imageUrl);
      else if(/assets\.tcgdex\.net\//i.test(imageUrl)){
        const base=imageUrl.replace(/\/(?:high|low)\.(?:avif|png|webp|jpe?g)$/i,'');
        const exact=/\/(?:high|low)\.(?:avif|png|webp|jpe?g)$/i.test(imageUrl)?imageUrl:null;
        if(exact)candidates.push(exact);
        for(const quality of ['high','low'])for(const extension of ['webp','png','jpg','avif'])candidates.push(`${base}/${quality}.${extension}`);
      }else if(/\.(?:avif|png|webp|jpe?g)$/i.test(imageUrl))candidates.push(imageUrl);
      else candidates.push(`${imageUrl}/high.webp`,`${imageUrl}/low.webp`);
    }
    if(sourceSet.toLowerCase()==='30th-c'&&/^[0-9]{3}$/.test(localCard))candidates.unshift(`https://static.pokemoncardlist.net/images/cards/30th-c-${localCard}.avif`);
    if(language==='ID'||language==='JP'){
      const safeSets=[...new Set([sourceSet,sourceSet.toUpperCase(),sourceSet.toLowerCase()])].filter(value=>/^[a-z0-9_-]{1,40}$/i.test(value));
      const safeNumber=/^[a-z0-9._-]{1,32}$/i.test(localCard)?localCard:'';
      if(safeNumber)for(const code of safeSets){
        const prefix=language==='JP'?'jp/':'';
        if(!/^\d+$/.test(safeNumber))candidates.push(`https://cdn.pokepedia.id/${prefix}${encodeURIComponent(code)}/${encodeURIComponent(`${safeNumber}.webp`)}`);
        if(official)candidates.push(`https://cdn.pokepedia.id/${prefix}${encodeURIComponent(code)}/${encodeURIComponent(`${safeNumber}_${official}.webp`)}`);
      }
    }
    for(const candidate of [row.imageUrl,...candidates].filter((value):value is string=>Boolean(value))){
      const response=await tcgdexArtResponse([candidate]);
      if(response.ok)return response;
    }
    return tcgdexArtResponse(candidates);
  }catch{return new Response('Image unavailable',{status:503})}
}
