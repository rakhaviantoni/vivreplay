import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret=process.env.SUPABASE_SECRET_KEY;
if(!url||!secret) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.');
const supabase=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket='tcg-card-images';
const limit=Number(process.env.STORAGE_HYDRATE_LIMIT||0);
const concurrency=Math.max(1,Number(process.env.STORAGE_HYDRATE_CONCURRENCY||16));
const dryRun=process.env.STORAGE_HYDRATE_DRY_RUN==='true';
const requestedCodes=new Set((process.env.STORAGE_HYDRATE_CODES||'').split(',').map(value=>value.trim().toUpperCase()).filter(Boolean));
type Printing={id:string;card_image_url:string|null;set_code:string;language:string;printing_code:string|null;card_image_id:string|null;tcg_card_identities:{code:string}|Array<{code:string}>|null};
type Asset={printing_id:string;kind:string};
const variants=[['thumb',180,72],['small',420,78],['large',960,84]] as const;

async function paged<T>(table:string,select:string){const rows:T[]=[];for(let from=0;;from+=1000){const {data,error}=await supabase.from(table).select(select).range(from,from+999);if(error)throw error;rows.push(...data as T[]);if(data.length<1000)return rows;}}
async function mapBounded<T,R>(items:T[],fn:(item:T)=>Promise<R>){const out:R[]=[];let cursor=0;await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(cursor<items.length){const index=cursor++;out[index]=await fn(items[index]);}}));return out;}
async function fetchImage(source:string){for(let attempt=0;attempt<3;attempt++){try{const response=await fetch(source,{headers:{accept:'image/webp,image/*;q=0.8'},signal:AbortSignal.timeout(20_000)});if(response.ok)return Buffer.from(await response.arrayBuffer());if(response.status===404)return null;}catch{}await new Promise(done=>setTimeout(done,500*(attempt+1)));}return null;}
const identityCode=(printing:Printing)=>Array.isArray(printing.tcg_card_identities)?printing.tcg_card_identities[0]?.code:printing.tcg_card_identities?.code;
const filenameFor=(printing:Printing)=>printing.printing_code||printing.card_image_id||identityCode(printing);
const assetKey=(printing:Printing,kind:string)=>`one-piece/${printing.set_code.toUpperCase().replaceAll('-','')}/${printing.language.toLowerCase()}/${kind}/${filenameFor(printing)}.webp`;
async function hydrate(printing:Printing){const source=printing.card_image_url;if(!source)return {ok:false,reason:'no source'};const image=await fetchImage(source);if(!image)return {ok:false,reason:'download failed'};const rows=[] as Array<{printing_id:string;kind:string;object_key:string;width:number}>;for(const [kind,width,quality] of variants){const objectKey=assetKey(printing,kind);const body=await sharp(image).rotate().resize({width,withoutEnlargement:true}).webp({quality,effort:4}).toBuffer();const {error}=await supabase.storage.from(bucket).upload(objectKey,body,{contentType:'image/webp',cacheControl:'31536000',upsert:true});if(error)return {ok:false,reason:error.message};rows.push({printing_id:printing.id,kind,object_key:objectKey,width});}const {error}=await supabase.from('tcg_card_assets').upsert(rows,{onConflict:'printing_id,kind'});return error?{ok:false,reason:error.message}:{ok:true};}
const printings=await paged<Printing>('tcg_card_printings','id,card_image_url,set_code,language,printing_code,card_image_id,tcg_card_identities(code)');
const assets=await paged<Asset>('tcg_card_assets','printing_id,kind');
const stored=new Set(assets.filter(asset=>asset.kind==='small').map(asset=>asset.printing_id));
const candidates=printings.filter(printing=>Boolean(printing.card_image_url)&&((requestedCodes.size&&requestedCodes.has(String(filenameFor(printing)).toUpperCase()))||(!requestedCodes.size&&!stored.has(printing.id)))).slice(0,limit||undefined);
console.log(JSON.stringify({printings:printings.length,smallAssets:stored.size,candidates:candidates.length,requested:requestedCodes.size,dryRun}));
if(!dryRun&&candidates.length){const result=await mapBounded(candidates,hydrate);const failed=result.filter(item=>!item.ok);console.log(JSON.stringify({hydrated:result.length-failed.length,failed:failed.length,examples:failed.slice(0,10)}));if(failed.length)process.exitCode=1;}
