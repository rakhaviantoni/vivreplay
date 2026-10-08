import {database} from '@/lib/server/database';
import {readPublicEdgeCache,storePublicEdgeCache} from '@/lib/server/public-edge-cache';
import {supabaseAdmin} from '@/lib/server/supabase-storage';
import {SETS_CATALOG} from '@/packages/card-data/catalog';
import {isPlayableSet} from '@/packages/domain/release-availability';
import {CARD_CATALOG_CACHE_REVISION} from '@/lib/card-catalog-cache';
import {env} from 'cloudflare:workers';

type Row={set_code:string|null;set_name:string|null;identity_id:string|null;variant:string|null};
function summarize(rows:Row[]){
 const sets=new Map<string,{code:string;name:string;main:Set<string>;parallel:Set<string>}>();
 for(const row of rows){const code=String(row.set_code??'').trim();const identity=String(row.identity_id??'');if(!code||!identity||!isPlayableSet(code))continue;const key=code.toUpperCase().replace(/[-_\s]/g,'');let entry=sets.get(key);if(!entry){entry={code,name:String(row.set_name??code),main:new Set(),parallel:new Set()};sets.set(key,entry)}const isParallel=/parallel|manga|alt/i.test(String(row.variant??''));(isParallel?entry.parallel:entry.main).add(identity)}
 const known=new Map(SETS_CATALOG.map(set=>[set.code.toUpperCase().replace(/[-_\s]/g,''),set]));
 return [...sets.values()].map(set=>{const old=known.get(set.code.toUpperCase().replace(/[-_\s]/g,''));return{code:set.code,name:old?.name??set.name,releaseYear:old?.releaseYear??0,mainSetTotal:old?.mainCount??set.main.size,parallelsTotal:old?.parallelCount??set.parallel.size}}).sort((a,b)=>b.code.localeCompare(a.code,undefined,{numeric:true}));
}

const publicHeaders={
 'Cache-Control':'public, max-age=300, stale-while-revalidate=86400',
 'Cloudflare-CDN-Cache-Control':'public, max-age=31536000, immutable',
};

export async function GET(request:Request){
 const cached=await readPublicEdgeCache(request);if(cached)return cached;
 const snapshotKey=`catalog-snapshots/sets-${CARD_CATALOG_CACHE_REVISION}.json`;
 try{
  const snapshot=await env.CARD_IMAGES?.get(snapshotKey);
  if(snapshot)return storePublicEdgeCache(request,Response.json(await snapshot.json<{sets:ReturnType<typeof summarize>}>(),{headers:publicHeaders}));
 }catch{/* Rebuild the snapshot from the catalog source. */}
 try{
  let rows:Row[]=[];
  try{rows=(await database().prepare(`SELECT set_code,set_name,identity_id,variant FROM tcg_card_printings WHERE identity_id IS NOT NULL`).all<Row>()).results}
  catch{
   const supabase=supabaseAdmin();if(!supabase)throw new Error('Catalog unavailable');
   for(let from=0;;from+=1000){const {data,error}=await supabase.from('tcg_card_printings').select('set_code,set_name,identity_id,variant').range(from,from+999);if(error)throw error;rows.push(...((data??[]) as Row[]));if((data??[]).length<1000)break}
  }
  const sets=summarize(rows);
  try{await env.CARD_IMAGES?.put(snapshotKey,JSON.stringify({sets}),{httpMetadata:{contentType:'application/json; charset=utf-8',cacheControl:'public, max-age=86400'}})}catch{/* Keep serving this request if snapshot storage is unavailable. */}
  return storePublicEdgeCache(request,Response.json({sets},{headers:publicHeaders}));
 }catch{return Response.json({error:'Set progress is temporarily unavailable.'},{status:503})}
}
