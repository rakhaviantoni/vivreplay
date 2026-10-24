import {isCurrentUserAdmin} from '@/lib/server/admin-auth';
import {database} from '@/lib/server/database';

type Identity={id:string;code:string;name:string};
type Printing={id:string;identity_id:string;set_code:string;set_name:string;language:string;variant:string;printing_code:string|null;card_image_url:string|null;tcg_card_identities:Identity|Identity[]};
type Asset={printing_id:string;kind:string};
type SetRow={id:string;external_set_id:string;name:string;set_kind:string};

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
  try { const d=database();const game=await d.prepare("SELECT id FROM tcg_games WHERE slug='one-piece' LIMIT 1").first<{id:string}>();if(!game)return Response.json({error:'Catalog is unavailable.'},{status:503});
    const [identities,printings,assets,sets]=await Promise.all([
      d.prepare('SELECT id,code,name FROM tcg_card_identities WHERE game_id=?').bind(game.id).all<Identity>(),
      d.prepare('SELECT p.id,p.identity_id,p.set_code,p.set_name,p.language,p.variant,p.printing_code,p.card_image_url,i.code,i.name FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id WHERE i.game_id=?').bind(game.id).all<Printing & {code:string;name:string}>(),
      d.prepare("SELECT a.printing_id,a.kind FROM tcg_card_assets a JOIN tcg_card_printings p ON p.id=a.printing_id JOIN tcg_card_identities i ON i.id=p.identity_id WHERE i.game_id=?").bind(game.id).all<Asset>(),
      d.prepare('SELECT id,external_set_id,name,set_kind FROM tcg_sets WHERE game_id=?').bind(game.id).all<SetRow>(),
    ]);
    const identityRows=identities.results,printingRows=printings.results,assetRows=assets.results,setRows=sets.results;
    const smallAssets=new Set(assetRows.filter(asset=>asset.kind==='small').map(asset=>asset.printing_id)); const printingIdentityIds=new Set(printingRows.map(printing=>printing.identity_id)); const identityFor=(printing:Printing & {code:string;name:string})=>({id:printing.identity_id,code:printing.code,name:printing.name});
    // Asset rows can lag migrated or legacy objects. Check only rows flagged as missing
    // against the same public route users load, avoiding a full-catalog image scan.
    const unchecked=printingRows.filter(printing=>!smallAssets.has(printing.id));
    const origin=(process.env.VIVREPLAY_PUBLIC_URL||'https://vivreplay.com').replace(/\/$/,'');
    const availability=await mapWithConcurrency(unchecked,8,async printing=>servedImage(printing,identityFor(printing),origin));
    const liveAssets=new Set(unchecked.filter((_printing,index)=>availability[index]).map(printing=>printing.id));
    const missingImages=unchecked.filter(printing=>!liveAssets.has(printing.id)).map(printing=>({id:printing.id,code:identityFor(printing)?.code??'Unknown',name:identityFor(printing)?.name??'Unknown',setCode:printing.set_code,language:printing.language,variant:printing.variant,reason:printing.card_image_url?'Image is unavailable on the public card route':'No source image URL or stored artwork'})).sort((a,b)=>a.setCode.localeCompare(b.setCode)||a.code.localeCompare(b.code)||a.language.localeCompare(b.language));
    const missingCards=identityRows.filter(identity=>!printingIdentityIds.has(identity.id)).map(identity=>({code:identity.code,name:identity.name})).sort((a,b)=>a.code.localeCompare(b.code));
    const setHealth=[...new Map(printingRows.map(printing=>[printing.set_code,{setCode:printing.set_code,setName:printing.set_name,total:0,stored:0,sourceMissing:0}])).values()]; const healthByCode=new Map(setHealth.map(row=>[row.setCode,row])); for(const printing of printingRows){const row=healthByCode.get(printing.set_code)!;row.total++;if(smallAssets.has(printing.id)||liveAssets.has(printing.id))row.stored++;if(!printing.card_image_url)row.sourceMissing++;}
    const setKey=(value:string)=>{const normalized=value.toUpperCase().replace(/[^A-Z0-9]/g,'');return normalized==='OP14'?'OP14EB04':normalized==='OP15'?'OP15EB04':normalized;};
    const japaneseStandard=new Set(printingRows.filter(row=>row.language==='JP'&&row.variant==='Standard').map(row=>`${setKey(row.set_code)}:${row.identity_id}`));
    const missingJapanese=printingRows.filter(row=>row.language==='EN'&&row.variant==='Standard'&&!japaneseStandard.has(`${setKey(row.set_code)}:${row.identity_id}`)).map(row=>({code:identityFor(row)?.code??'Unknown',name:identityFor(row)?.name??'Unknown',setCode:row.set_code,setName:row.set_name,printingCode:row.printing_code})).sort((a,b)=>a.setCode.localeCompare(b.setCode)||a.code.localeCompare(b.code));
    const representedSetCodes=new Set(setHealth.map(row=>setKey(row.setCode)));
    const unrepresentedSets=setRows.filter(set=>!representedSetCodes.has(setKey(set.external_set_id))).map(set=>({setCode:set.external_set_id,setName:set.name,kind:set.set_kind}));
    return Response.json({generatedAt:new Date().toISOString(),summary:{identities:identityRows.length,printings:printingRows.length,sets:setRows.length,storedSmall:printingRows.length-missingImages.length,missingImages:missingImages.length,missingCards:missingCards.length,missingJapaneseStandard:missingJapanese.length,unrepresentedSets:unrepresentedSets.length},missingImages,missingCards,missingJapanese,sets:[...setHealth].sort((a,b)=>b.setCode.localeCompare(a.setCode)),unrepresentedSets});
  } catch(error) { return Response.json({error:error instanceof Error?error.message:'Catalog health lookup failed.'},{status:500}); }
}
