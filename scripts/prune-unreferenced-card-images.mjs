import {createClient} from '@supabase/supabase-js';

const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const storage=client.storage.from('tcg-card-images');
const dryRun=process.env.CARD_IMAGE_ORPHAN_DRY_RUN==='true';
async function listAll(path){const items=[];for(let offset=0;;offset+=1000){const {data,error}=await storage.list(path,{limit:1000,offset,sortBy:{column:'name',order:'asc'}});if(error)throw new Error(`${path}: ${error.message}`);items.push(...data);if(data.length<1000)return items;}}
const assets=[];for(let from=0;;from+=1000){const {data,error}=await client.from('tcg_card_assets').select('object_key').eq('kind','small').range(from,from+999);if(error)throw error;assets.push(...data);if(data.length<1000)break;}
const referenced=new Set(assets.map(asset=>asset.object_key));
const stale=[];
for(const set of (await listAll('one-piece')).filter(item=>item.id===null)){
  const setPath=`one-piece/${set.name}`;
  for(const language of (await listAll(setPath)).filter(item=>item.id===null&&['en','jp'].includes(item.name.toLowerCase()))){
    const path=`${setPath}/${language.name}/small`;
    for(const file of await listAll(path)){if(file.id!==null&&!referenced.has(`${path}/${file.name}`))stale.push(`${path}/${file.name}`);}
  }
}
console.log(JSON.stringify({referenced:referenced.size,unreferenced:stale.length,dryRun}));
if(!dryRun)for(let index=0;index<stale.length;index+=100){const {error}=await storage.remove(stale.slice(index,index+100));if(error)throw error;}
