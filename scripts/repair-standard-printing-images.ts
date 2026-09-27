import {createClient} from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY??process.env.SUPABASE_SECRET_KEY;
if(!url||!secret)throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before repairing printings.');

const supabase=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const requestedCodes=new Set((process.env.CARD_CODES??'').split(',').map(value=>value.trim().toUpperCase()).filter(Boolean));
const concurrency=Math.max(1,Number(process.env.STANDARD_IMAGE_CONCURRENCY??16));
const offset=Math.max(0,Number(process.env.STANDARD_IMAGE_OFFSET??0));
const limit=Math.max(0,Number(process.env.STANDARD_IMAGE_LIMIT??0));
const language=(process.env.STANDARD_IMAGE_LANGUAGE??'EN').toUpperCase();
const onlyParallelSources=process.env.STANDARD_IMAGE_ONLY_PARALLEL_SOURCES==='true';
type Row={id:string;identity_id:string;set_id:string|null;set_code:string;set_name:string;rarity:string|null;source_kind:string|null;life:number|null;sub_types:string|null;counter_amount:number|null;attribute:string|null;source_payload:Record<string,unknown>|null;tcg_card_identities:{code:string}};
type Repair={row:Row;sourceUrl:string};

function chunks<T>(items:T[],size=200){return Array.from({length:Math.ceil(items.length/size)},(_,index)=>items.slice(index*size,(index+1)*size));}
function sourceUrl(code:string){
  const set=code.match(/^(OP|EB|ST|PRB)\d+/i)?.[0]?.toUpperCase()??(/^P-\d+/i.test(code)?'P':null);
  return set?`https://cards.oplaytcg.com/${set}/${language.toLowerCase()}/small/${code}.webp`:null;
}
async function boundedMap<T,R>(items:T[],task:(item:T)=>Promise<R>){const results:R[]=[];let cursor=0;await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(cursor<items.length){const index=cursor++;results[index]=await task(items[index]);}}));return results;}
async function fetchRows(){const rows:Row[]=[];for(let from=0;;from+=1000){const {data,error}=await supabase.from('tcg_card_printings').select('id,identity_id,set_id,set_code,set_name,rarity,source_kind,life,sub_types,counter_amount,attribute,source_payload,tcg_card_identities!inner(code)').eq('language',language).eq('variant','Standard').range(from,from+999);if(error)throw error;rows.push(...data as unknown as Row[]);if((data??[]).length<1000)break;}return rows.filter(row=>(!requestedCodes.size||requestedCodes.has(row.tcg_card_identities.code.toUpperCase()))&&(!onlyParallelSources||/_p\d+\.(?:jpg|png|webp)/i.test(String(row.source_payload?.card_image??''))));}
async function hasStandardAsset(row:Row):Promise<Repair|null>{const code=row.tcg_card_identities.code.toUpperCase();const url=sourceUrl(code);if(!url)return null;try{const response=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(12_000)});return response.ok?{row,sourceUrl:url}:null;}catch{return null;}}
async function write(repairs:Repair[]){for(const batch of chunks(repairs)){const payload=batch.map(({row,sourceUrl})=>({id:row.id,identity_id:row.identity_id,language,set_id:row.set_id,set_code:row.set_code,set_name:row.set_name,printing_code:row.tcg_card_identities.code.toUpperCase(),rarity:row.rarity,variant:'Standard',source_kind:row.source_kind,life:row.life,sub_types:row.sub_types,counter_amount:row.counter_amount,attribute:row.attribute,card_image_id:row.tcg_card_identities.code.toUpperCase(),card_image_url:sourceUrl,source_payload:{...row.source_payload,canonical_standard_image:true,canonical_source:'oplaytcg'}}));const {error}=await supabase.from('tcg_card_printings').upsert(payload,{onConflict:'id'});if(error)throw error;}}
async function main(){const candidates=await fetchRows();const rows=limit?candidates.slice(offset,offset+limit):candidates.slice(offset);const verified=await boundedMap(rows,hasStandardAsset);const repairs=verified.filter((repair):repair is Repair=>Boolean(repair));await write(repairs);console.log(JSON.stringify({checked:rows.length,repaired:repairs.length,notFound:rows.length-repairs.length,scope:requestedCodes.size?'requested':'all',language,onlyParallelSources,offset,codes:repairs.map(repair=>repair.row.tcg_card_identities.code)},null,2));}
await main();
