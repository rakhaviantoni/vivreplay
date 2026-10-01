import {createClient} from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY??process.env.SUPABASE_SECRET_KEY;
if(!url||!key)throw new Error('Supabase credentials are required.');
const apply=process.env.APPLY_CARD_SET_FOLDER_FIX==='true';
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const storage=supabase.storage.from('tcg-card-images');
const canonicalSet=value=>String(value??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
async function allRows(table,select){
  const rows=[];
  for(let from=0;;from+=1000){
    const {data,error}=await supabase.from(table).select(select).range(from,from+999);
    if(error)throw error;
    rows.push(...(data??[]));
    if((data??[]).length<1000)return rows;
  }
}
async function mapLimit(items,limit,task){
  let cursor=0;
  const output=[];
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(cursor<items.length){const index=cursor++;output[index]=await task(items[index]);}
  }));
  return output;
}

const printings=await allRows('tcg_card_printings','id,language,set_code,printing_code,tcg_card_identities!inner(code),tcg_card_assets!inner(id,kind,object_key)');
const references=await allRows('tcg_card_assets','id,printing_id,kind,object_key');
const refCount=new Map();
for(const asset of references)refCount.set(asset.object_key,(refCount.get(asset.object_key)??0)+1);
const jobs=printings.flatMap(printing=>{
  const asset=printing.tcg_card_assets.find(item=>item.kind==='small');
  if(!asset||!printing.set_code)return[];
  const parts=asset.object_key.split('/');
  const canonical=canonicalSet(printing.set_code);
  if(parts[1]===canonical)return[];
  const target=['one-piece',canonical,parts[2],...parts.slice(3)].join('/');
  return[{printing,asset,from:asset.object_key,to:target}];
});

const directories=[...new Set(jobs.map(job=>job.to.split('/').slice(0,-1).join('/')))];
const existingObjects=new Set();
for(const directory of directories){
  const {data,error}=await storage.list(directory,{limit:1000});
  if(error)throw new Error(`Could not inspect ${directory}: ${error.message}`);
  for(const file of data??[])if(file.id!==null)existingObjects.add(`${directory}/${file.name}`);
}

const plan=jobs.map(job=>{
  const shared=refCount.get(job.from)??0;
  const conflict=existingObjects.has(job.to);
  let target=job.to;
  if(conflict){
    const suffix=job.printing.id.slice(0,8);
    target=job.to.replace(/\.webp$/i,`--${suffix}.webp`);
    while(existingObjects.has(target))target=target.replace(/\.webp$/i,`-${Math.random().toString(36).slice(2,6)}.webp`);
  }
  existingObjects.add(target);
  return{...job,target,shared,conflict};
});

console.log(JSON.stringify({mode:apply?'apply':'dry-run',mismatches:plan.length,conflicts:plan.filter(item=>item.conflict).map(item=>({printing:item.printing.tcg_card_identities.code,from:item.from,to:item.to,keptTarget:item.target})),shared:plan.filter(item=>item.shared>1).length},null,2));
if(!apply)process.exit(0);

const results=await mapLimit(plan,6,async item=>{
  const source=await storage.download(item.from);
  if(source.error||!source.data)throw new Error(`Missing source ${item.from}: ${source.error?.message??'no body'}`);
  const target=await storage.download(item.target);
  if(!target.error&&target.data)throw new Error(`Refusing to overwrite ${item.target}`);
  const moved=await storage.move(item.from,item.target);
  if(moved.error)throw new Error(`Could not move ${item.from}: ${moved.error.message}`);
  const updated=await supabase.from('tcg_card_assets').update({object_key:item.target}).eq('id',item.asset.id).eq('object_key',item.from);
  if(updated.error){
    const rollback=await storage.move(item.target,item.from);
    throw new Error(`DB update failed for ${item.from}; rollback ${rollback.error?'also failed':''}: ${updated.error.message}`);
  }
  return{printing:item.printing.tcg_card_identities.code,language:item.printing.language,from:item.from,to:item.target,sharedSource:item.shared>1};
});
console.log(JSON.stringify({moved:results.length,results},null,2));
