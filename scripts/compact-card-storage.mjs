import {createClient} from '@supabase/supabase-js';

const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY??process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const storage=client.storage.from('tcg-card-images');
const dryRun=process.env.CARD_STORAGE_COMPACT_DRY_RUN==='true';

async function listAll(path){const result=[];for(let offset=0;;offset+=1000){const {data,error}=await storage.list(path,{limit:1000,offset,sortBy:{column:'name',order:'asc'}});if(error)throw new Error(`${path}: ${error.message}`);result.push(...data);if(data.length<1000)return result;}}
async function mapBounded(items,limit,task){let cursor=0;const output=[];await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const index=cursor++;output[index]=await task(items[index]);}}));return output;}

const assets=[];
for(let from=0;;from+=1000){const {data,error}=await client.from('tcg_card_assets').select('object_key').eq('kind','small').range(from,from+999);if(error)throw error;assets.push(...data);if(data.length<1000)break;}
const referenced=new Set(assets.map(asset=>asset.object_key));
const sets=(await listAll('one-piece')).filter(item=>item.id===null).map(item=>item.name);
const paths=(await mapBounded(sets,32,async set=>{
 const languages=await listAll(`one-piece/${set}`);
 return languages.filter(item=>item.id===null&&['en','jp'].includes(item.name.toLowerCase())).flatMap(language=>['thumb','small','large'].map(kind=>`one-piece/${set}/${language.name}/${kind}`));
})).flat();
const listed=await mapBounded(paths,48,async path=>({path,files:await listAll(path)}));
const remove=[];
let variants=0,orphans=0;
for(const {path,files} of listed){for(const file of files){if(file.id===null)continue;const key=`${path}/${file.name}`;if(!path.endsWith('/small')){variants++;remove.push(key);}else if(!referenced.has(key)){orphans++;remove.push(key);}}}
console.log(JSON.stringify({referenced:referenced.size,variantObjects:variants,orphanSmallObjects:orphans,remove:remove.length,sample:remove.slice(0,12),dryRun}));
if(!dryRun)await mapBounded(Array.from({length:Math.ceil(remove.length/100)},(_,index)=>remove.slice(index*100,index*100+100)),12,async batch=>{const {error}=await storage.remove(batch);if(error)throw error;});
