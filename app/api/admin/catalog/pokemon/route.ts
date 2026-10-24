import {isCurrentUserAdmin} from '@/lib/server/admin-auth';
import {database} from '@/lib/server/database';
import {pokemonArtRoute} from '@/lib/pokemon-art-route';
import {pokemonLocalCardNumber} from '@/lib/pokemon-set-aliases';

const PAGE_SIZE=50;
type Summary={printings:number;identities:number;sets:number;stored:number;sourceOnly:number;missing:number;idPrintings:number;idMissing:number};
type Printing={id:string;code:string;name:string;language:string;setCode:string;setName:string;printingCode:string|null;collectorNumber:string|null;sourcePayload:string;variant:string;rarity:string;source:string;imageSource:string|null;imageUrl:string|null;assetKey:string|null;cardType:string;effectText:string|null;cost:number;power:number};

export async function GET(request:Request){
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  try{
    const url=new URL(request.url);
    const page=Math.max(1,Math.min(100_000,Number.parseInt(url.searchParams.get('page')??'1',10)||1));
    const query=(url.searchParams.get('q')??'').trim().slice(0,100);
    const sets=[...new Set(url.searchParams.getAll('set').map(value=>value.trim().slice(0,50)).filter(Boolean))].slice(0,30);
    const languages=[...new Set(url.searchParams.getAll('language').map(value=>value.trim().toUpperCase()).filter(value=>['EN','JP','ID'].includes(value)))];
    const sources=[...new Set(url.searchParams.getAll('source').map(value=>value.trim().slice(0,40)).filter(value=>/^[a-z0-9_-]+$/i.test(value)))].slice(0,20);
    const status=url.searchParams.get('status')??'all';
    const db=database();
    const game=await db.prepare("SELECT id FROM tcg_games WHERE slug='pokemon' LIMIT 1").first<{id:string}>();
    if(!game)return Response.json({error:'Pokémon catalog is not available.'},{status:503});

    const clauses=['i.game_id=?'];const values:unknown[]=[game.id];
    if(query){
      const rarityAliases:Record<string,string>={sar:'special illustration rare',sir:'special illustration rare',ar:'illustration rare',ir:'illustration rare',ur:'ultra rare',rr:'double rare',ace:'ace spec rare'};
      const terms=[...new Set(query.toLowerCase().split(/\s+/).map(term=>term.trim()).filter(Boolean))];
      const rarityTerms=terms.filter(term=>rarityAliases[term]);
      const nameTerms=terms.filter(term=>!rarityAliases[term]);
      const escapedTerms=nameTerms.map(term=>term.replace(/[\\%_]/g,'\\$&'));
      const currentFields=["i.code","i.name","p.printing_code","p.set_code","p.set_name","p.rarity","p.source_payload"];
      const currentSearch=escapedTerms.map(()=>`(${currentFields.map(field=>`${field} LIKE ? ESCAPE '\\'`).join(' OR ')})`);
      for(const term of escapedTerms)values.push(...currentFields.map(()=>`%${term}%`));
      if(escapedTerms.length){
        const expression=nameTerms.map(term=>`"${term.replaceAll('"','""')}"`).join(' AND ');
        const englishMatch=`(p.language='JP' AND EXISTS (SELECT 1 FROM tcg_card_identities ei JOIN tcg_card_printings ep ON ep.identity_id=ei.id AND ep.language='EN' WHERE ei.id IN (SELECT identity_id FROM tcg_card_identity_search WHERE tcg_card_identity_search MATCH ?) AND ei.game_id=i.game_id AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(p.source_payload) THEN p.source_payload ELSE '{}' END,'$.dexId') jd JOIN json_each(CASE WHEN json_valid(ep.source_payload) THEN ep.source_payload ELSE '{}' END,'$.dexId') ed ON CAST(jd.value AS TEXT)=CAST(ed.value AS TEXT)) AND UPPER(COALESCE(json_extract(p.source_payload,'$.suffix'),''))=UPPER(COALESCE(json_extract(ep.source_payload,'$.suffix'),''))))`;
        clauses.push(`(${[...currentSearch,englishMatch].join(' OR ')})`);
        values.push(expression);
      }
      if(rarityTerms.length){clauses.push(`LOWER(p.rarity) IN (${rarityTerms.map(()=>'?').join(',')})`);values.push(...rarityTerms.map(term=>rarityAliases[term]));}
    }
    if(sets.length){clauses.push(`p.set_code IN (${sets.map(()=>'?').join(',')})`);values.push(...sets);}
    if(languages.length){clauses.push(`p.language IN (${languages.map(()=>'?').join(',')})`);values.push(...languages);}
    if(sources.length){clauses.push(`p.source_kind IN (${sources.map(()=>'?').join(',')})`);values.push(...sources);}
    if(status==='stored')clauses.push("a.id IS NOT NULL");
    else if(status==='source')clauses.push("a.id IS NULL AND NULLIF(p.card_image_url,'') IS NOT NULL");
    else if(status==='missing')clauses.push("a.id IS NULL AND NULLIF(p.card_image_url,'') IS NULL");
    else if(status==='id')clauses.push("p.language='ID'");
    else if(status==='id-missing')clauses.push("p.language='ID' AND a.id IS NULL AND NULLIF(p.card_image_url,'') IS NULL");
    const where=clauses.join(' AND ');

    const metadata=url.searchParams.get('metadata')==='1';
    const summaryPromise=metadata?db.prepare("SELECT COUNT(*) AS printings,COUNT(DISTINCT i.id) AS identities,COUNT(DISTINCT p.set_code) AS sets,SUM(CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END) AS stored,SUM(CASE WHEN a.id IS NULL AND NULLIF(p.card_image_url,'') IS NOT NULL THEN 1 ELSE 0 END) AS sourceOnly,SUM(CASE WHEN a.id IS NULL AND NULLIF(p.card_image_url,'') IS NULL THEN 1 ELSE 0 END) AS missing,SUM(CASE WHEN p.language='ID' THEN 1 ELSE 0 END) AS idPrintings,SUM(CASE WHEN p.language='ID' AND a.id IS NULL AND NULLIF(p.card_image_url,'') IS NULL THEN 1 ELSE 0 END) AS idMissing FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small' WHERE i.game_id=?").bind(game.id).first<Summary>():Promise.resolve(null);
    const languagesPromise=metadata?db.prepare("SELECT p.language,COUNT(*) AS count FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id WHERE i.game_id=? GROUP BY p.language ORDER BY p.language").bind(game.id).all<{language:string;count:number}>():Promise.resolve(null);
    const setsPromise=metadata?db.prepare("SELECT DISTINCT set_code AS code,set_name AS name FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id WHERE i.game_id=? ORDER BY set_name,set_code").bind(game.id).all<{code:string;name:string}>():Promise.resolve(null);
    const sourcesPromise=metadata?db.prepare("SELECT COALESCE(NULLIF(p.source_kind,''),'unknown') AS source,COUNT(*) AS count FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id WHERE i.game_id=? GROUP BY p.source_kind ORDER BY p.source_kind").bind(game.id).all<{source:string;count:number}>():Promise.resolve(null);
    const rowsPromise=db.prepare(`SELECT p.id,i.code,i.name,i.card_type AS cardType,i.effect_text AS effectText,i.cost,i.power,p.language,p.set_code AS setCode,p.set_name AS setName,p.printing_code AS printingCode,CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.collectorNumber') ELSE NULL END AS collectorNumber,p.source_payload AS sourcePayload,p.variant,p.rarity,p.source_kind AS source,p.card_image_url AS imageUrl,a.object_key AS assetKey FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small' WHERE ${where} ORDER BY p.set_name,p.set_code,i.code,p.language,p.variant,p.id LIMIT ? OFFSET ?`).bind(...values,PAGE_SIZE+1,(page-1)*PAGE_SIZE).all<Printing>();
    const [summaryResult,languageResult,setResult,sourceResult,rowsResult]=await Promise.all([summaryPromise,languagesPromise,setsPromise,sourcesPromise,rowsPromise]);
    const summary=summaryResult?{printings:Number(summaryResult.printings??0),identities:Number(summaryResult.identities??0),sets:Number(summaryResult.sets??0),stored:Number(summaryResult.stored??0),sourceOnly:Number(summaryResult.sourceOnly??0),missing:Number(summaryResult.missing??0),idPrintings:Number(summaryResult.idPrintings??0),idMissing:Number(summaryResult.idMissing??0)}:undefined;
    const hasNext=rowsResult.results.length>PAGE_SIZE;
    const printings=rowsResult.results.slice(0,PAGE_SIZE).map(row=>{const number=pokemonLocalCardNumber(row.sourcePayload,row.collectorNumber||row.printingCode||row.code);const publicNumber=/^CT-\d+$/i.test(number)?null:number;return {...row,collectorNumber:publicNumber,cardType:row.cardType??'Pokémon',cost:Number(row.cost??0),power:Number(row.power??0),imageSource:row.imageUrl?.includes('cardtell.id')?'Cardtell':row.imageUrl?.includes('tcgdex')?'TCGdex':row.imageUrl?.includes('pokepedia.id')?'Poképedia':row.imageUrl?'Other':null,status:row.assetKey?'stored':row.imageUrl?'source':'missing',imageUrl:row.setCode?pokemonArtRoute(row.language,row.setCode,number,row.id):row.imageUrl}});
    return Response.json({generatedAt:new Date().toISOString(),summary,languages:languageResult?.results,sets:setResult?.results,sources:sourceResult?.results,page,pageSize:PAGE_SIZE,hasNext,printings});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Pokémon catalog could not be loaded.'},{status:500});}
}
