import {supabaseAdmin} from '@/lib/server/supabase-storage';
import {isPlayableSet, PREVIEW_CARD_CODES} from '@/packages/domain/release-availability';

type CatalogRow={
  id:string;
  rarity:string|null;
  variant:string|null;
  set_code:string|null;
  counter_amount:number|null;
  sub_types:string[]|string|null;
  tcg_card_assets:Array<{kind:string;object_key:string}>|null;
  tcg_card_identities:{id:string;code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string}|null;
};

function publicCardPath(objectKey:string){
  return `/${objectKey.replace(/^one-piece\/([^/]+)\//,(_,setCode)=>`${setCode.replaceAll('-','')}/`)}`;
}

export async function GET(){
  const supabase=supabaseAdmin();
  if(!supabase) return Response.json({error:'Catalog storage is unavailable.'},{status:503});

  const rows:CatalogRow[]=[];
  for(let from=0;;from+=1000){
    const {data,error}=await supabase
      .from('tcg_card_printings')
      .select('id,rarity,variant,set_code,counter_amount,sub_types,tcg_card_assets!inner(kind,object_key),tcg_card_identities!inner(id,code,name,color,card_type,cost,power,effect_text)')
      .eq('language','EN')
      .eq('tcg_card_assets.kind','small')
      .range(from,from+999);
    if(error) return Response.json({error:'Catalog is unavailable.'},{status:500});
    const page=(data??[]) as unknown as CatalogRow[];
    rows.push(...page);
    if(page.length<1000) break;
  }

  const cards=rows
    .filter(row=>row.tcg_card_identities&&(isPlayableSet(row.set_code) || PREVIEW_CARD_CODES.has(row.tcg_card_identities.code.toUpperCase()) || row.variant === 'Preview'))
    .map(row=>{
      const asset=row.tcg_card_assets?.find(item=>item.kind==='small');
      return {...row,card_image_url:asset?publicCardPath(asset.object_key):null};
    });
  return Response.json({cards},{headers:{'Cache-Control':'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400'}});
}
