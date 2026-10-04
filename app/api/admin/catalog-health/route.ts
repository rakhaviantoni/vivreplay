import {createClient} from '@supabase/supabase-js';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

type Identity={id:string;code:string;name:string};
type Printing={id:string;identity_id:string;set_code:string;set_name:string;language:string;variant:string;printing_code:string|null;card_image_url:string|null;tcg_card_identities:Identity|Identity[]};
type Asset={printing_id:string;kind:string};
type SetRow={id:string;external_set_id:string;name:string;set_kind:string};

async function allRows<T>(supabase:any,table:string,columns:string) { const result:T[]=[]; for(let from=0;;from+=1000){const {data,error}=await supabase.from(table).select(columns).range(from,from+999);if(error)throw error;result.push(...data as T[]);if(data.length<1000)return result;} }

async function servedImage(printing:Printing,identity:Identity|undefined,origin:string){
  const code=printing.printing_code||identity?.code;
  if(!code||!/^[A-Za-z0-9_-]+$/.test(code))return false;
  const setCode=printing.set_code.toUpperCase().replace(/[^A-Z0-9]/g,'');
  const url=new URL(`/${setCode}/${encodeURIComponent(printing.language.toLowerCase())}/${encodeURIComponent(code)}.webp`,origin);
  try{
    const response=await fetch(url,{method:'HEAD',cache:'no-store',signal:AbortSignal.timeout(8_000)});
    return response.ok&&response.headers.get('content-type')?.toLowerCase().includes('image/')===true;
  }catch{return false;}
}

async function mapWithConcurrency<T,R>(items:T[],concurrency:number,task:(item:T)=>Promise<R>){
  const results=new Array<R>(items.length);let cursor=0;
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(cursor<items.length){const index=cursor++;results[index]=await task(items[index]);}}));
  return results;
}

export async function GET(request:Request) {
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return Response.json({error:'Storage administration is unavailable.'},{status:503});
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  try { const [identities,printings,assets,sets]=await Promise.all([allRows<Identity>(supabase,'tcg_card_identities','id,code,name'),allRows<Printing>(supabase,'tcg_card_printings','id,identity_id,set_code,set_name,language,variant,printing_code,card_image_url,tcg_card_identities(id,code,name)'),allRows<Asset>(supabase,'tcg_card_assets','printing_id,kind'),allRows<SetRow>(supabase,'tcg_sets','id,external_set_id,name,set_kind')]);
    const smallAssets=new Set(assets.filter(asset=>asset.kind==='small').map(asset=>asset.printing_id)); const printingIdentityIds=new Set(printings.map(printing=>printing.identity_id)); const identityFor=(printing:Printing)=>Array.isArray(printing.tcg_card_identities)?printing.tcg_card_identities[0]:printing.tcg_card_identities;
    // Asset rows can lag migrated or legacy objects. Check only rows flagged as missing
    // against the same public route users load, avoiding a full-catalog image scan.
    const unchecked=printings.filter(printing=>!smallAssets.has(printing.id));
    const origin=(process.env.VIVREPLAY_PUBLIC_URL||'https://vivreplay.com').replace(/\/$/,'');
    const availability=await mapWithConcurrency(unchecked,8,async printing=>servedImage(printing,identityFor(printing),origin));
    const liveAssets=new Set(unchecked.filter((_printing,index)=>availability[index]).map(printing=>printing.id));
    const missingImages=unchecked.filter(printing=>!liveAssets.has(printing.id)).map(printing=>({id:printing.id,code:identityFor(printing)?.code??'Unknown',name:identityFor(printing)?.name??'Unknown',setCode:printing.set_code,language:printing.language,variant:printing.variant,reason:printing.card_image_url?'Image is unavailable on the public card route':'No source image URL or stored artwork'})).sort((a,b)=>a.setCode.localeCompare(b.setCode)||a.code.localeCompare(b.code)||a.language.localeCompare(b.language));
    const missingCards=identities.filter(identity=>!printingIdentityIds.has(identity.id)).map(identity=>({code:identity.code,name:identity.name})).sort((a,b)=>a.code.localeCompare(b.code));
    const setHealth=[...new Map(printings.map(printing=>[printing.set_code,{setCode:printing.set_code,setName:printing.set_name,total:0,stored:0,sourceMissing:0}])).values()]; const healthByCode=new Map(setHealth.map(row=>[row.setCode,row])); for(const printing of printings){const row=healthByCode.get(printing.set_code)!;row.total++;if(smallAssets.has(printing.id)||liveAssets.has(printing.id))row.stored++;if(!printing.card_image_url)row.sourceMissing++;}
    const unrepresentedSets=sets.filter(set=>!healthByCode.has(set.external_set_id)).map(set=>({setCode:set.external_set_id,setName:set.name,kind:set.set_kind}));
    return Response.json({generatedAt:new Date().toISOString(),summary:{identities:identities.length,printings:printings.length,sets:sets.length,storedSmall:printings.length-missingImages.length,missingImages:missingImages.length,missingCards:missingCards.length,unrepresentedSets:unrepresentedSets.length},missingImages,missingCards,sets:[...setHealth].sort((a,b)=>b.setCode.localeCompare(a.setCode)),unrepresentedSets});
  } catch(error) { return Response.json({error:error instanceof Error?error.message:'Catalog health lookup failed.'},{status:500}); }
}
