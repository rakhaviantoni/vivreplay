import {database} from '@/lib/server/database';
import {supabaseAdmin} from '@/lib/server/supabase-storage';
import {SETS_CATALOG} from '@/packages/card-data/catalog';
import {isPlayableSet} from '@/packages/domain/release-availability';

type Row={set_code:string|null;set_name:string|null;identity_id:string|null;variant:string|null};
function summarize(rows:Row[]){
 const sets=new Map<string,{code:string;name:string;main:Set<string>;parallel:Set<string>}>();
 for(const row of rows){const code=String(row.set_code??'').trim();const identity=String(row.identity_id??'');if(!code||!identity||!isPlayableSet(code))continue;const key=code.toUpperCase().replace(/[-_\s]/g,'');let entry=sets.get(key);if(!entry){entry={code,name:String(row.set_name??code),main:new Set(),parallel:new Set()};sets.set(key,entry)}const isParallel=/parallel|manga|alt/i.test(String(row.variant??''));(isParallel?entry.parallel:entry.main).add(identity)}
 const known=new Map(SETS_CATALOG.map(set=>[set.code.toUpperCase().replace(/[-_\s]/g,''),set]));
 return [...sets.values()].map(set=>{const old=known.get(set.code.toUpperCase().replace(/[-_\s]/g,''));return{code:set.code,name:old?.name??set.name,releaseYear:old?.releaseYear??0,mainSetTotal:old?.mainCount??set.main.size,parallelsTotal:old?.parallelCount??set.parallel.size}}).sort((a,b)=>b.code.localeCompare(a.code,undefined,{numeric:true}));
}
export async function GET(){
 try{
  let rows:Row[]=[];
  try{rows=(await database().prepare(`SELECT p.set_code,p.set_name,p.identity_id,p.variant FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id`).all<Row>()).results}
  catch{
   const supabase=supabaseAdmin();if(!supabase)throw new Error('Catalog unavailable');
   for(let from=0;;from+=1000){const {data,error}=await supabase.from('tcg_card_printings').select('set_code,set_name,identity_id,variant').range(from,from+999);if(error)throw error;rows.push(...((data??[]) as Row[]));if((data??[]).length<1000)break}
  }
  return Response.json({sets:summarize(rows)},{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=86400','Cloudflare-CDN-Cache-Control':'public, max-age=31536000, immutable'}});
 }catch{return Response.json({error:'Set progress is temporarily unavailable.'},{status:503})}
}
