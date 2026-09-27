import {createClient} from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret=process.env.SUPABASE_SECRET_KEY;
if(!url||!secret)throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.');
const supabase=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket='tcg-card-images';
const limit=Math.max(1,Number(process.env.STORAGE_MOVE_LIMIT||500));
const concurrency=Math.max(1,Number(process.env.STORAGE_MOVE_CONCURRENCY||32));
type Asset={kind:'small';object_key:string};
type Printing={id:string;set_code:string;language:string;printing_code:string|null;card_image_id:string|null;tcg_card_identities:{code:string}|Array<{code:string}>|null;tcg_card_assets:Asset[]};

function canonicalSet(value:string){return value.toUpperCase().replaceAll('-','');}
function filename(row:Printing){const identity=Array.isArray(row.tcg_card_identities)?row.tcg_card_identities[0]?.code:row.tcg_card_identities?.code;return row.printing_code||row.card_image_id||identity;}
const rows:Printing[]=[];
for(let from=0;;from+=1000){const {data,error}=await supabase.from('tcg_card_printings').select('id,set_code,language,printing_code,card_image_id,tcg_card_identities(code),tcg_card_assets(kind,object_key)').range(from,from+999);if(error)throw error;rows.push(...data as Printing[]);if(data.length<1000)break;}
const raw=rows.flatMap(row=>row.tcg_card_assets.filter((asset):asset is Asset=>asset.kind==='small').map(asset=>({row,asset,base:`one-piece/${canonicalSet(row.set_code)}/${row.language.toLowerCase()}/small/${filename(row)}.webp`}))).filter(job=>job.base!==job.asset.object_key);
const groups=new Map<string,typeof raw>();for(const job of raw){const group=groups.get(job.base)??[];group.push(job);groups.set(job.base,group);}
const jobs=raw.map(job=>{const peers=groups.get(job.base)??[];const suffix=peers.length>1?`--${job.row.id.slice(-8)}`:'';return {...job,target:job.base.replace(/\.webp$/,`${suffix}.webp`)};}).filter(job=>job.asset.object_key!==job.target).filter((job,index,all)=>all.findIndex(other=>other.target===job.target)===index).slice(0,limit);
console.log(JSON.stringify({remaining:raw.length,batch:jobs.length,collisions:[...groups.values()].filter(group=>group.length>1).length}));
let cursor=0,moved=0,updated=0,failed=0;
await Promise.all(Array.from({length:Math.min(concurrency,jobs.length)},async()=>{while(cursor<jobs.length){const job=jobs[cursor++];try{const {error:moveError}=await supabase.storage.from(bucket).move(job.asset.object_key,job.target);if(moveError){const {data:target,error:targetError}=await supabase.storage.from(bucket).download(job.target);if(targetError||!target)throw moveError;}else moved++;const {error:updateError}=await supabase.from('tcg_card_assets').update({object_key:job.target}).eq('printing_id',job.row.id).eq('kind','small');if(updateError)throw updateError;updated++;}catch(error){failed++;console.error(JSON.stringify({id:job.row.id,error:error instanceof Error?error.message:String(error)}));}}}));
console.log(JSON.stringify({moved,updated,failed}));
if(failed)process.exitCode=1;
