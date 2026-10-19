import { createClient } from '@supabase/supabase-js';

const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
const token=process.env.CLOUDFLARE_API_TOKEN;
const accountId=process.env.CLOUDFLARE_ACCOUNT_ID;
const bucket=process.env.CLOUDFLARE_R2_BUCKET||'tcg-card-images';
const apply=process.argv.includes('--apply');
const limit=Math.max(0,Number(process.env.R2_RECONCILE_LIMIT||0));
const concurrency=Math.max(1,Math.min(8,Number(process.env.R2_RECONCILE_CONCURRENCY||4)));
const delayMs=Math.max(250,Number(process.env.R2_RECONCILE_DELAY_MS||500));
if(!supabaseUrl||!supabaseKey)throw new Error('Supabase catalog credentials are required.');
if(!token||!accountId)throw new Error('Cloudflare R2 credentials are required.');

const supabase=createClient(supabaseUrl,supabaseKey,{auth:{persistSession:false,autoRefreshToken:false}});
const allowedHosts=new Set(['cards.oplaytcg.com','assets.tcgdex.net']);
const canonicalSet=value=>String(value??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const identityCode=row=>Array.isArray(row.tcg_card_identities)?row.tcg_card_identities[0]?.code:row.tcg_card_identities?.code;
const filename=row=>row.printing_code||row.card_image_id||identityCode(row);
const apiBase=`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket)}/objects`;
const cloudflareHeaders={authorization:`Bearer ${token}`};

async function allPrintings(){
  const rows=[];
  for(let from=0;;from+=1000){
    const {data,error}=await supabase.from('tcg_card_printings').select('id,set_code,language,printing_code,card_image_id,card_image_url,tcg_card_identities(code),tcg_card_assets(kind,object_key)').range(from,from+999);
    if(error)throw new Error(`Catalog read failed: ${error.message}`);
    rows.push(...(data??[]));
    if(!data||data.length<1000)return rows;
  }
}
async function r2Keys(){
  const keys=new Set();let cursor;
  do{
    const query=new URLSearchParams({prefix:'one-piece/',per_page:'1000'});if(cursor)query.set('cursor',cursor);
    const response=await fetch(`${apiBase}?${query}`,{headers:cloudflareHeaders});
    const body=await response.json();
    if(!response.ok||!body.success)throw new Error(`R2 listing failed (${response.status}).`);
    for(const object of body.result??[])keys.add(object.key);
    cursor=body.result_info?.is_truncated?body.result_info.cursor:undefined;
  }while(cursor);
  return keys;
}
function sourceFor(row,expectedFilename){
  if(!row.card_image_url)return null;
  try{
    const url=new URL(row.card_image_url);
    const actual=decodeURIComponent(url.pathname.split('/').at(-1)??'');
    if(url.protocol!=='https:'||!allowedHosts.has(url.hostname)||actual.toLowerCase()!==expectedFilename.toLowerCase())return null;
    return url.toString();
  }catch{return null;}
}
function sourceKey(row){
  const code=filename(row);const set=canonicalSet(row.set_code);const language=String(row.language??'').toLowerCase();
  if(!code||!set||!['en','jp','id'].includes(language)||!/^[A-Za-z0-9_-]+$/.test(code))return null;
  return `one-piece/${set}/${language}/${code}.webp`;
}
const rows=await allPrintings();
const keys=await r2Keys();
const jobs=[];let skippedUnsafe=0,skippedNoSource=0;
for(const row of rows){
  if(!/^(OP|EB|ST|PRB|P|DON)[-_]/i.test(String(identityCode(row)??'')))continue;
  const target=sourceKey(row);if(!target)continue;
  if(keys.has(target))continue;
  const expected=`${filename(row)}.webp`;
  const source=sourceFor(row,expected);
  if(!source){
    const attached=(row.tcg_card_assets??[]).find(asset=>asset.kind==='small')?.object_key;
    if(attached&&keys.has(attached))jobs.push({row,target,copyKey:attached});
    else if(row.card_image_url)skippedUnsafe++;
    else skippedNoSource++;
    continue;
  }
  jobs.push({row,target,source});
}
const selected=limit?jobs.slice(0,limit):jobs;
console.log(JSON.stringify({mode:apply?'apply':'dry-run',catalogPrintings:rows.length,r2Objects:keys.size,missingCanonicalImages:jobs.length,selected:selected.length,skippedUnsafeOrMismatched:skippedUnsafe,skippedWithoutSource:skippedNoSource,concurrency,delayMs}));
if(!apply){console.log('Preview only. Pass --apply to copy verified base and parallel artwork into canonical R2 keys.');process.exit(0);}

let cursor=0,copied=0,failed=0,nextAt=0;const failures=[];
async function upload(job){
  let bytes,contentType='image/webp';
  if(job.copyKey){const {data,error}=await supabase.storage.from('tcg-card-images').download(job.copyKey);if(error||!data)throw new Error('Could not read the existing source asset.');bytes=Buffer.from(await data.arrayBuffer());}
  else{
    const wait=Math.max(0,nextAt-Date.now());nextAt=Math.max(nextAt,Date.now())+delayMs;if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
    const response=await fetch(job.source,{headers:{accept:'image/webp,image/*;q=0.8'},signal:AbortSignal.timeout(20_000)});
    contentType=response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()??contentType;
    if(!response.ok||!contentType.startsWith('image/'))throw new Error(`Approved image source returned ${response.status}.`);
    const declared=Number(response.headers.get('content-length')??0);if(declared>12*1024*1024)throw new Error('Image exceeds the 12 MiB safety limit.');
    bytes=Buffer.from(await response.arrayBuffer());
  }
  if(!bytes.length||bytes.length>12*1024*1024)throw new Error('Image size is invalid.');
  const key=job.target.split('/').map(encodeURIComponent).join('/');
  const response=await fetch(`${apiBase}/${key}`,{method:'PUT',headers:{...cloudflareHeaders,'content-type':contentType,'cache-control':'public, max-age=31536000, immutable','cf-r2-storage-class':'Standard'},body:bytes,signal:AbortSignal.timeout(60_000)});
  const result=await response.json();if(!response.ok||!result.success||Number(result.result?.size)!==bytes.length)throw new Error(`R2 upload failed (${response.status}).`);
}
await Promise.all(Array.from({length:Math.min(concurrency,selected.length)},async()=>{
  while(cursor<selected.length){const job=selected[cursor++];try{await upload(job);copied++;if(copied%50===0||copied===selected.length)console.log(JSON.stringify({copied,total:selected.length}));}catch(error){failed++;failures.push({printingId:job.row.id,setCode:job.row.set_code,language:job.row.language,printingCode:filename(job),reason:error instanceof Error?error.message:'Upload failed'});}}
}));
console.log(JSON.stringify({copied,failed,examples:failures.slice(0,20)}));
if(failed)process.exitCode=1;
