const filenamePattern=/^[A-Za-z0-9_-]+\.webp$/;
const bucket='tcg-card-images';

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
  }
  return [...aliases];
}

async function catalogAssetKeys(origin:string,key:string,setCode:string,language:string,filename:string){
  const printingCode=filename.replace(/\.webp$/i,'');
  const query=new URLSearchParams({
    select:'tcg_card_assets(object_key,kind)',
    printing_code:`eq.${printingCode}`,
    language:`eq.${language.toUpperCase()}`,
    set_code:`in.(${setCodeAliases(setCode).map(value=>`"${value}"`).join(',')})`,
  });
  const response=await fetch(`${origin}/rest/v1/tcg_card_printings?${query}`,{headers:{authorization:`Bearer ${key}`,apikey:key}});
  if(!response.ok) return [];
  const rows=await response.json() as Array<{tcg_card_assets?:Array<{object_key?:string;kind?:string}>}>;
  return rows.flatMap(row=>row.tcg_card_assets??[])
    .sort((left,right)=>(left.kind==='small'?0:1)-(right.kind==='small'?0:1))
    .map(asset=>asset.object_key)
    .filter((objectKey):objectKey is string=>Boolean(objectKey));
}

export async function serveCardImage(setCode:string,language:string,filename:string,variant='small'){
  if(!filenamePattern.test(filename)) return new Response('Not found',{status:404});
  const cacheKey=new Request(`https://vivreplay.com/${encodeURIComponent(setCode)}/${encodeURIComponent(language)}/${encodeURIComponent(filename)}`);
  const edgeCache=(globalThis.caches as (CacheStorage & {default?:Cache})|undefined)?.default;
  const cached=await edgeCache?.match(cacheKey);
  // Cache API responses have immutable headers in Workers. Return a fresh
  // Response so framework adapters can safely add their own headers.
  if(cached) return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers:new Headers(cached.headers)});

  const origin=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!origin||!key) return new Response('Asset storage is unavailable',{status:503});

  const catalogKeys=await catalogAssetKeys(origin,key,setCode,language,filename);
  const candidateKeys=[...new Set([...catalogKeys,...candidateObjectKeys(setCode,language,filename,variant)])];
  for(const objectKey of candidateKeys){
    const response=await fetch(`${origin}/storage/v1/object/${bucket}/${objectKey}`,{headers:{accept:'image/webp,image/*;q=0.8',authorization:`Bearer ${key}`,apikey:key},cf:{cacheTtl:31_536_000,cacheEverything:true}});
    if(!response.ok||!response.body) continue;
    const image=new Response(response.body,{headers:{'Content-Type':response.headers.get('content-type')||'image/webp','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
    await edgeCache?.put(cacheKey,image.clone());
    return image;
  }
  return new Response('Not found',{status:404});
}

export async function GET(_request:Request,{params}:{params:Promise<{setCode:string;language:string;filename:string}>}) {
  const {setCode,language,filename}=await params;
  return serveCardImage(setCode,language,filename);
}
