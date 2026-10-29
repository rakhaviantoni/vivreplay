import {env} from 'cloudflare:workers';
import {database} from '@/lib/server/database';
import {servePokemonArt} from '@/lib/server/pokemon-art-response';

const filenamePattern=/^[A-Za-z0-9_-]+\.webp$/;

function candidateObjectKeys(setCode:string,language:string,filename:string,variant:string){
  const normalizedSet=setCode.toUpperCase().replaceAll('-','');
  const legacySet=setCode.toUpperCase();
  const sets=[normalizedSet,...(legacySet===normalizedSet?[]:[legacySet])];
  const prefixes=sets.map(value=>`one-piece/${value}/${language.toLowerCase()}`);
  return [...new Set(prefixes.flatMap(prefix=>[
    // Current storage keeps one canonical artwork per printing, with no size folder.
    `${prefix}/${filename}`,
    // Older uploads remain readable while the asset migration finishes.
    `${prefix}/${variant}/${filename}`,
    ...(variant==='small'?[]:[`${prefix}/small/${filename}`]),
  ]))];
}

function setCodeAliases(setCode:string){
  const normalized=setCode.toUpperCase().replace(/[^A-Z0-9]/g,'');
  const aliases=new Set([setCode.toUpperCase(),normalized]);
  const addPrefix=(prefix:string,pattern:RegExp,separator:string)=>{
    const match=normalized.match(pattern);
    if(match)aliases.add(`${prefix}${separator}${match[1]}`);
  };
  addPrefix('OP',/^OP(\d{2})$/,'-');
  addPrefix('ST',/^ST(\d{2})$/,'-');
  addPrefix('EB',/^EB(\d{2})$/,'-');
  addPrefix('PRB',/^PRB(\d{2})$/,'-');
  const combined=normalized.match(/^OP(\d{2})EB(\d{2})$/);
  if(combined){
    aliases.add(`OP-${combined[1]}-EB${combined[2]}`);
    aliases.add(`OP${combined[1]}-EB${combined[2]}`);
    aliases.add(`OP-${combined[1]}EB${combined[2]}`);
    aliases.add(`EB-${combined[2]}`);
    aliases.add(`OP${combined[1]}`);
    aliases.add(`OP-${combined[1]}`);
  }
  const opSet=normalized.match(/^OP(\d{2})$/);
  if(opSet)aliases.add(`OP${opSet[1]}EB04`);
  return [...aliases];
}

async function catalogAssetKeys(setCode:string,language:string,filename:string){
  const printingCode=filename.replace(/\.webp$/i,'');
  const aliases=[...new Set(setCodeAliases(setCode).map(value=>value.toUpperCase().replace(/[^A-Z0-9]/g,'')))];
  const rows=(await database().prepare(`SELECT a.object_key AS objectKey,a.kind,p.card_image_url AS sourceUrl,p.source_payload AS sourcePayload FROM tcg_card_printings p LEFT JOIN tcg_card_assets a ON a.printing_id=p.id WHERE upper(p.printing_code)=upper(?) AND upper(p.language)=upper(?) AND upper(replace(replace(replace(p.set_code,'-',''),'_',''),' ','')) IN (${aliases.map(()=>'?').join(',')}) ORDER BY CASE WHEN a.kind='small' THEN 0 ELSE 1 END`).bind(printingCode,language,...aliases).all<{objectKey:string|null;kind:string|null;sourceUrl:string|null;sourcePayload:string|null}>()).results;
  return rows;
}

const approvedImageHosts=new Set(['cards.oplaytcg.com','assets.tcgdex.net','www.optcgapi.com']);
async function restoreMissingImage(setCode:string,language:string,filename:string){
  if(!/^(en|jp|id)$/i.test(language))return null;
  const rows=await catalogAssetKeys(setCode,language,filename);
  for(const row of rows){
    if(row.objectKey){const existing=await env.CARD_IMAGES?.get(row.objectKey);if(existing)return {object:existing,key:row.objectKey};}
    let payloadImage='';
    try{payloadImage=String((JSON.parse(row.sourcePayload??'{}') as Record<string,unknown>).card_image??'')}catch{}
    for(const sourceValue of [row.sourceUrl,payloadImage].filter((value):value is string=>Boolean(value))){
      let source:URL;
      try{source=new URL(sourceValue)}catch{continue}
      const sourceFilename=decodeURIComponent(source.pathname.split('/').at(-1)??'').toLowerCase();
      const optcgPayloadImage=source.hostname==='www.optcgapi.com'&&/^\/media\/static\/Card_Images\/[A-Za-z0-9_.-]+$/i.test(source.pathname);
      // Other sources must retain the exact filename. OPTCG API payload images
      // use descriptive filenames, so their URL is accepted only from this exact
      // printing's catalog record and only from its static card-image directory.
      if(source.protocol!=='https:'||!approvedImageHosts.has(source.hostname)||(!optcgPayloadImage&&sourceFilename!==filename.toLowerCase()))continue;
      try{
        const response=await fetch(source,{headers:{accept:'image/webp,image/*;q=0.8'},signal:AbortSignal.timeout(8_000)});
        const contentType=response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()??'';
        if(!response.ok||!contentType.startsWith('image/'))continue;
        const declaredSize=Number(response.headers.get('content-length')??0);
        if(declaredSize>12*1024*1024)continue;
        const bytes=await response.arrayBuffer();
        if(!bytes.byteLength||bytes.byteLength>12*1024*1024)continue;
        const canonicalKey=`one-piece/${setCode.toUpperCase().replace(/[^A-Z0-9]/g,'')}/${language.toLowerCase()}/${filename}`;
        await env.CARD_IMAGES?.put(canonicalKey,bytes,{httpMetadata:{contentType,cacheControl:'public, max-age=31536000, immutable'}});
        const restored=await env.CARD_IMAGES?.get(canonicalKey);
        if(restored)return {object:restored,key:canonicalKey};
      }catch{/* Keep trying known stored-key variants. */}
    }
  }
  return null;
}

export async function serveCardImage(setCode:string,language:string,filename:string,variant='small',requestedWidth?:number){
  if(!filenamePattern.test(filename)) return new Response('Not found',{status:404});
  const sizeQuery=requestedWidth?`?width=${requestedWidth}&v=2`:'';
  const cacheKey=new Request(`https://vivreplay.com/${encodeURIComponent(setCode)}/${encodeURIComponent(language)}/${encodeURIComponent(filename)}${sizeQuery}`);
  const edgeCache=(globalThis.caches as (CacheStorage & {default?:Cache})|undefined)?.default;
  const cached=await edgeCache?.match(cacheKey);
  // Cache API responses have immutable headers in Workers. Return a fresh
  // Response so framework adapters can safely add their own headers.
  if(cached) return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers:new Headers(cached.headers)});

  let catalogRows:Awaited<ReturnType<typeof catalogAssetKeys>>=[];
  try{catalogRows=await catalogAssetKeys(setCode,language,filename)}catch{catalogRows=[]}
  const candidateKeys=[...new Set([...catalogRows.map(row=>row.objectKey).filter((key):key is string=>Boolean(key)),...candidateObjectKeys(setCode,language,filename,variant)])];
  for(const objectKey of candidateKeys){
    const stored=await env.CARD_IMAGES?.get(objectKey);
    if(stored){
      const bytes=await stored.arrayBuffer();
      const headers={'Cache-Control':stored.httpMetadata?.cacheControl??'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'};
      let image:Response;
      if(requestedWidth&&env.IMAGES){
        try{
          const imageStream=new Response(bytes).body;
          if(!imageStream)throw new Error('Could not create image stream.');
          const transformed=(await env.IMAGES.input(imageStream)
            .transform({width:requestedWidth,height:Math.round(requestedWidth*580/420),fit:'scale-down'})
            .output({format:'image/webp',quality:78})).response();
          image=new Response(transformed.body,{status:transformed.status,statusText:transformed.statusText,headers:{...Object.fromEntries(transformed.headers),...headers,'Content-Type':transformed.headers.get('content-type')??'image/webp'}});
        }catch{
          image=new Response(bytes,{headers:{...headers,'Content-Type':stored.httpMetadata?.contentType??'image/webp'}});
        }
      }else image=new Response(bytes,{headers:{...headers,'Content-Type':stored.httpMetadata?.contentType??'image/webp'}});
      await edgeCache?.put(cacheKey,image.clone());
      return image;
    }

  }

  try{
    const restored=await restoreMissingImage(setCode,language,filename);
    if(restored){
      const bytes=await restored.object.arrayBuffer();
      const image=new Response(bytes,{headers:{'Content-Type':restored.object.httpMetadata?.contentType??'image/webp','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
      await edgeCache?.put(cacheKey,image.clone());
      return image;
    }
  }catch{/* A missing source should remain a normal 404. */}
  return new Response('Not found',{status:404});
}

export async function GET(request:Request,{params}:{params:Promise<{setCode:string;language:string;filename:string}>}) {
  const {setCode,language,filename}=await params;
  if(filename.toLowerCase().endsWith('.webp')){
    const pokemon=await servePokemonArt(request,language,setCode,filename.replace(/\.webp$/i,''));
    if(pokemon.status!==404)return pokemon;
  }
  const rawWidth=Number(new URL(request.url).searchParams.get('width'));
  const requestedWidth=[160,220,280,360].includes(rawWidth)?rawWidth:undefined;
  return serveCardImage(setCode,language,filename,'small',requestedWidth);
}
