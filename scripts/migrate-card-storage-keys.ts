import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret=process.env.SUPABASE_SECRET_KEY;
if(!url||!secret) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.');
const supabase=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket='tcg-card-images';
const concurrency=Math.max(1,Number(process.env.STORAGE_MIGRATE_CONCURRENCY||8));
const dryRun=process.env.STORAGE_MIGRATE_DRY_RUN==='true';
type Asset={kind:'thumb'|'small'|'large';object_key:string};
type Row={id:string;set_code:string;language:string;printing_code:string|null;card_image_id:string|null;card_image_url:string|null;tcg_card_identities:{code:string}|Array<{code:string}>|null;tcg_card_assets:Asset[]};
const widths={thumb:180,small:420,large:960} as const;
const qualities={thumb:72,small:78,large:84} as const;

async function rows<T>(table:string,select:string){const result:T[]=[];for(let from=0;;from+=1000){const {data,error}=await supabase.from(table).select(select).range(from,from+999);if(error)throw error;result.push(...data as T[]);if(data.length<1000)return result;}}
async function bounded<T>(items:T[],fn:(item:T)=>Promise<void>){let index=0;await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(index<items.length)await fn(items[index++]);}));}
const identityCode=(row:Row)=>Array.isArray(row.tcg_card_identities)?row.tcg_card_identities[0]?.code:row.tcg_card_identities?.code;
const filenameFor=(row:Row)=>row.printing_code||row.card_image_id||identityCode(row);
const canonicalSet=(setCode:string)=>setCode.toUpperCase().replaceAll('-','');
const baseKey=(row:Row,kind:Asset['kind'])=>`one-piece/${canonicalSet(row.set_code)}/${row.language.toLowerCase()}/${kind}/${filenameFor(row)}.webp`;
const hash=(body:Buffer)=>createHash('sha256').update(body).digest('hex');
async function downloadStored(key:string){const {data,error}=await supabase.storage.from(bucket).download(key);return error||!data?null:Buffer.from(await data.arrayBuffer());}
async function downloadSource(url:string){try{const response=await fetch(url,{signal:AbortSignal.timeout(20_000)});return response.ok?Buffer.from(await response.arrayBuffer()):null;}catch{return null;}}
async function bodyFor(job:{row:Row;asset:Asset}){const stored=await downloadStored(job.asset.object_key);if(stored)return stored;if(!job.row.card_image_url)return null;const source=await downloadSource(job.row.card_image_url);if(!source)return null;return sharp(source).rotate().resize({width:widths[job.asset.kind],withoutEnlargement:true}).webp({quality:qualities[job.asset.kind],effort:4}).toBuffer();}

const printings=await rows<Row>('tcg_card_printings','id,set_code,language,printing_code,card_image_id,card_image_url,tcg_card_identities(code),tcg_card_assets(kind,object_key)');
if(printings.some(row=>!filenameFor(row))) throw new Error('Refusing records without a printing code, image id, or identity code.');
const candidates=printings.flatMap(row=>row.tcg_card_assets.map(asset=>({row,asset,base:baseKey(row,asset.kind)})));
const grouped=new Map<string,typeof candidates>();
for(const candidate of candidates){const items=grouped.get(candidate.base)??[];items.push(candidate);grouped.set(candidate.base,items);}
const jobs=candidates.map(candidate=>{const peers=grouped.get(candidate.base)??[];const suffix=peers.length>1?`--${candidate.row.id.slice(-8)}`:'';return {...candidate,target:candidate.base.replace(/\.webp$/,`${suffix}.webp`)};}).filter(job=>job.asset.object_key!==job.target);
const duplicateTargets=jobs.map(job=>job.target).filter((key,index,all)=>all.indexOf(key)!==index);
if(duplicateTargets.length) throw new Error('Refusing duplicate destination paths.');
console.log(JSON.stringify({printings:printings.length,assets:jobs.length,legacyPathCollisions:[...grouped.values()].filter(group=>group.length>1).length,dryRun}));
let copied=0;let failed=0;
await bounded(jobs,async job=>{try{const body=await bodyFor(job);if(!body)throw new Error('Neither local asset nor source image is available');if(!dryRun){const {error:uploadError}=await supabase.storage.from(bucket).upload(job.target,body,{contentType:'image/webp',cacheControl:'31536000',upsert:false});if(uploadError){const existing=await downloadStored(job.target);if(!existing||hash(existing)!==hash(body))throw new Error(`Destination verification failed: ${uploadError.message}`);}const {error:updateError}=await supabase.from('tcg_card_assets').update({object_key:job.target}).eq('printing_id',job.row.id).eq('kind',job.asset.kind);if(updateError)throw updateError;}copied++;}catch(error){failed++;console.error(JSON.stringify({printing:job.row.id,kind:job.asset.kind,error:error instanceof Error?error.message:String(error)}));}});
console.log(JSON.stringify({copied,failed}));
if(failed)process.exitCode=1;
