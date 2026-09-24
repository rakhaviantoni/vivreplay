import {createClient} from '@supabase/supabase-js';

type Identity={id:string;code:string;name:string};
type Printing={id:string;identity_id:string;set_code:string;set_name:string;language:string;variant:string;card_image_url:string|null;tcg_card_identities:Identity|Identity[]};
type Asset={printing_id:string;kind:string};
type SetRow={id:string;external_set_id:string;name:string;set_kind:string};

async function allRows<T>(supabase:any,table:string,columns:string) { const result:T[]=[]; for(let from=0;;from+=1000){const {data,error}=await supabase.from(table).select(columns).range(from,from+999);if(error)throw error;result.push(...data as T[]);if(data.length<1000)return result;} }

export async function GET() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return Response.json({error:'Storage administration is unavailable.'},{status:503});
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  try { const [identities,printings,assets,sets]=await Promise.all([allRows<Identity>(supabase,'tcg_card_identities','id,code,name'),allRows<Printing>(supabase,'tcg_card_printings','id,identity_id,set_code,set_name,language,variant,card_image_url,tcg_card_identities(id,code,name)'),allRows<Asset>(supabase,'tcg_card_assets','printing_id,kind'),allRows<SetRow>(supabase,'tcg_sets','id,external_set_id,name,set_kind')]);
    const smallAssets=new Set(assets.filter(asset=>asset.kind==='small').map(asset=>asset.printing_id)); const printingIdentityIds=new Set(printings.map(printing=>printing.identity_id)); const identityFor=(printing:Printing)=>Array.isArray(printing.tcg_card_identities)?printing.tcg_card_identities[0]:printing.tcg_card_identities;
    const missingImages=printings.filter(printing=>!smallAssets.has(printing.id)).map(printing=>({id:printing.id,code:identityFor(printing)?.code??'Unknown',name:identityFor(printing)?.name??'Unknown',setCode:printing.set_code,language:printing.language,variant:printing.variant,reason:printing.card_image_url?'Not copied to Storage':'No source image URL'})).sort((a,b)=>a.setCode.localeCompare(b.setCode)||a.code.localeCompare(b.code)||a.language.localeCompare(b.language));
    const missingCards=identities.filter(identity=>!printingIdentityIds.has(identity.id)).map(identity=>({code:identity.code,name:identity.name})).sort((a,b)=>a.code.localeCompare(b.code));
    const setHealth=[...new Map(printings.map(printing=>[printing.set_code,{setCode:printing.set_code,setName:printing.set_name,total:0,stored:0,sourceMissing:0}])).values()]; const healthByCode=new Map(setHealth.map(row=>[row.setCode,row])); for(const printing of printings){const row=healthByCode.get(printing.set_code)!;row.total++;if(smallAssets.has(printing.id))row.stored++;if(!printing.card_image_url)row.sourceMissing++;}
    const unrepresentedSets=sets.filter(set=>!healthByCode.has(set.external_set_id)).map(set=>({setCode:set.external_set_id,setName:set.name,kind:set.set_kind}));
    return Response.json({generatedAt:new Date().toISOString(),summary:{identities:identities.length,printings:printings.length,sets:sets.length,storedSmall:smallAssets.size,missingImages:missingImages.length,missingCards:missingCards.length,unrepresentedSets:unrepresentedSets.length},missingImages,missingCards,sets:[...setHealth].sort((a,b)=>b.setCode.localeCompare(a.setCode)),unrepresentedSets});
  } catch(error) { return Response.json({error:error instanceof Error?error.message:'Catalog health lookup failed.'},{status:500}); }
}
