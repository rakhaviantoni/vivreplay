import {database} from '@/lib/server/database';
import {detectCardScanGame,parseOnePieceScanCode,parsePokemonScanCode} from '@/lib/card-scan-parser';
import {pokemonArtRoute} from '@/lib/pokemon-art-route';
import {displayCardName} from '@/components/tcg/card-name';
import {deduplicateScanCandidates} from '@/lib/card-scan-candidates';

type Game='pokemon'|'one-piece';
type Candidate={id:string;game:Game;code:string;name:string;setCode:string;cardNumber:string;language:string;rarity:string;variant:string;imageUrl:string|null;setCardCount:string};
type ScanRead={game:Game;name:string;setCode:string;cardNumber:string;cardNumberTotal:string;language:string;rarity:string;variant:string;block:string};

const pokemonPrintedSetAliases:Record<string,string[]>={
  // TCGdex uses its series ID for Paldea Evolved; PAL is the code printed on cards.
  PAL:['PAL','SV02'],
  SV11W:['SV11W','SV11s','sv10.5w','PRE'],
  SV11B:['SV11B','SV11s','sv10.5b','PRE'],
  SV11:['SV11','SV11s','sv10.5w','sv10.5b'],
  SV6A:['SV6a','SV06a'],
  SV7A:['SV7a','SV07a'],
  SV8A:['SV8a','SV08a'],
  SV9:['SV9','SV09'],
  SV10:['SV10','DRI'],
  M6A:['M6a','MA6','ME06'],
  MA6:['MA6','M6a','30th','30th-c'],
  ME06:['ME06','M6a','MA6'],
  '30TH':['30th','MA6'],
  '30THC':['30th-c','MA6'],
};

const POKEMON_RARITY_ALIASES:Record<string,string[]>={
  SAR:['SAR','SPECIALARTRARE','SPECIALILLUSTRATIONRARE'],
  SIR:['SIR','SPECIALILLUSTRATIONRARE'],
  SSR:['SSR','SHINYULTRARARE'],
  RR:['RR','DOUBLERARE'],
  RRR:['RRR','TRIPLERARE'],
  UR:['UR','ULTRARARE'],
  HR:['HR','HYPERRARE'],
  AR:['AR','ARTRARE'],
  IR:['IR','ILLUSTRATIONRARE'],
  R:['R','RARE'],
  U:['U','UNCOMMON'],
  C:['C','COMMON'],
};

function pokemonRarityAliases(rarity:string,language?:string){
  const upper=rarity.toUpperCase();
  if(upper==='SR')return language==='EN'?['SR','SUPERRARE','SECRETRARE']:['SR','SUPERRARE'];
  return POKEMON_RARITY_ALIASES[upper]??[upper];
}

function pokemonCardCodeSql(){
  const shortDescription="trim(CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.shortDescription') END)";
  const description="trim(CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.description') END)";
  const describedNumber=`CASE WHEN instr(${shortDescription},' ')>0 THEN substr(${shortDescription},instr(${shortDescription},' ')+1) WHEN instr(${description},'·')>0 THEN trim(substr(${description},instr(${description},'·')+1)) ELSE NULL END`;
  const cardCode=`COALESCE(NULLIF(trim(CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.localId') END),''),NULLIF(trim(CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.collectorNumber') END),''),NULLIF(${describedNumber},''),p.printing_code)`;
  const cardNumber=`CASE WHEN instr(CAST(${cardCode} AS TEXT),'/')>0 THEN substr(CAST(${cardCode} AS TEXT),1,instr(CAST(${cardCode} AS TEXT),'/')-1) ELSE CAST(${cardCode} AS TEXT) END`;
  const printedTotal=`CASE WHEN instr(CAST(${cardCode} AS TEXT),'/')>0 THEN CAST(substr(CAST(${cardCode} AS TEXT),instr(CAST(${cardCode} AS TEXT),'/')+1) AS INTEGER) ELSE CAST(json_extract(CASE WHEN json_valid(p.source_payload) THEN p.source_payload ELSE '{}' END,'$.set.cardCount.official') AS INTEGER) END`;
  return {cardCode,cardNumber,printedTotal};
}

const pokemonKatakanaAliases:Record<string,string>={
  'ケルディオ':'Keldeo',
  'ピカチュウ':'Pikachu',
  'リザードン':'Charizard',
  'リザード':'Charmeleon',
  'カメックス':'Blastoise',
  'フシギバナ':'Venusaur',
  'ミュウツー':'Mewtwo',
  'ミュウ':'Mew',
  'イーブイ':'Eevee',
  'ブラッキー':'Umbreon',
  'エーフィ':'Espeon',
  'ニンフィア':'Sylveon',
  'ルギア':'Lugia',
  'ホウオウ':'Ho-Oh',
  'レックウザ':'Rayquaza',
  'ギラティナ':'Giratina',
  'ディアルガ':'Dialga',
  'パルキア':'Palkia',
  'アルセウス':'Arceus',
  'キチキギス':'Fezandipiti',
  'イイネイヌ':'Okidogi',
  'マシマシラ':'Munkidori',
  'モモワロウ':'Pecharunt',
  'オーガポン':'Ogerpon',
  'テラパゴス':'Terapagos',
  'タケルライコ':'Raging Bolt',
  'ウガツホムラ':'Gouging Fire',
  'ウネルミナモ':'Walking Wake',
  'テツノカシラ':'Iron Crown',
  'テツノイワオ':'Iron Boulder',
  'テツノイサハ':'Iron Leaves',
  'トドロクツキ':'Roaring Moon',
  'テツノブジン':'Iron Valiant',
  'サーナイト':'Gardevoir',
  'ゲンガー':'Gengar',
  'ミミッキュ':'Mimikyu',
  'ルカリオ':'Lucario',
  'ゲッコウガ':'Greninja',
  'ドラパルト':'Dragapult',
  'サーフゴー':'Gholdengo',
  'コライドン':'Koraidon',
  'ミライドン':'Miraidon',
  'ソウブレイズ':'Ceruledge',
  'ヨノワール':'Dusknoir',
  'ピジョット':'Pidgeot',
  'ロトム':'Rotom',
  'ラティアス':'Latias',
  'ラティオス':'Latios',
  'カビゴン':'Snorlax',
  'カイリュー':'Dragonite',
  'バンギラス':'Tyranitar',
  'メタグロス':'Metagross',
};

function catalogSetCandidates(candidates:string[]){
  return [...new Set(candidates.flatMap(candidate=>pokemonPrintedSetAliases[candidate.toUpperCase()]??[candidate]))];
}

function parseText(text:string,requestedGame:'pokemon'|'one-piece'|'auto'):{read:ScanRead;setCandidates:string[];numberCandidates?:number[];identityCode?:string}|null{
  const normalized=text.toUpperCase().replace(/[—–−]/g,'-');
  const onePieceCode=parseOnePieceScanCode(normalized);
  const pokemonCode=parsePokemonScanCode(normalized);
  const game=detectCardScanGame(normalized,requestedGame);
  if(!game)return null;
  if(game==='one-piece'){
    if(!onePieceCode)return null;
    return {read:{game,name:'',setCode:onePieceCode.setCode,cardNumber:onePieceCode.cardNumber,cardNumberTotal:'',language:'',rarity:onePieceCode.rarity,variant:onePieceCode.variant,block:''},setCandidates:[],identityCode:onePieceCode.cardNumber};
  }
  if(!pokemonCode)return null;
  return {read:{game,name:'',setCode:pokemonCode.setCodeCandidates[0]??'',cardNumber:pokemonCode.cardNumber,cardNumberTotal:pokemonCode.cardNumberTotal,language:pokemonCode.language,rarity:pokemonCode.rarity,variant:'',block:''},setCandidates:pokemonCode.setCodeCandidates,numberCandidates:[Number(pokemonCode.cardNumber)]};
}

async function catalogMatches(parsed:NonNullable<ReturnType<typeof parseText>>,rarityOnlyFallback=false,includeOtherLanguages=false):Promise<Candidate[]>{
  const {read,setCandidates,identityCode,numberCandidates}=parsed;
  const conditions=['g.slug=?'];
  const values:(string|number)[]=[read.game];
  const {cardCode,cardNumber,printedTotal}=pokemonCardCodeSql();
  if(read.game==='one-piece'&&identityCode){
    const normalizedSet=read.setCode.replace(/[^A-Z0-9]/g,'');
    const setOptions=normalizedSet==='OP15'?['OP15','OP15EB04']:normalizedSet==='EB04'?['EB04','OP15EB04']:[normalizedSet];
    conditions.push('(UPPER(i.code)=? OR UPPER(p.printing_code)=? OR UPPER(p.printing_code) LIKE ?)');
    conditions.push(`UPPER(REPLACE(REPLACE(REPLACE(p.set_code,'-',''),'_',''),' ','')) IN (${setOptions.map(()=>'?').join(',')})`);
    values.push(identityCode,identityCode,`${identityCode}_P%`,...setOptions);
  }else{
    const numbers=numberCandidates?.length?numberCandidates:[Number.parseInt(read.cardNumber,10)];
    conditions.push(`CAST(CASE WHEN ${cardNumber} GLOB '[0-9]*' THEN ${cardNumber} ELSE '' END AS INTEGER) IN (${numbers.map(()=>'?').join(',')})`);
    values.push(...numbers);
    if(read.cardNumberTotal){
      conditions.push(`${printedTotal}=?`);
      values.push(Number.parseInt(read.cardNumberTotal,10));
    }
    if(setCandidates.length){
      const catalogSets=catalogSetCandidates(setCandidates);
      conditions.push(`(${catalogSets.map(()=>`UPPER(REPLACE(REPLACE(REPLACE(REPLACE(p.set_code,'-',''),'_',''),' ',''),'.',''))=?`).join(' OR ')})`);
      values.push(...catalogSets);
    }
    if(read.language&&!includeOtherLanguages){
      conditions.push('UPPER(p.language)=?');values.push(read.language);
    }
    if(rarityOnlyFallback&&read.rarity){
      const aliases=pokemonRarityAliases(read.rarity,read.language);
      conditions.push(`UPPER(REPLACE(REPLACE(COALESCE(p.rarity,''),' ',''),'-','')) IN (${aliases.map(()=>'?').join(',')})`);
      values.push(...aliases);
    }
  }
  const rows=await database().prepare(`
    SELECT DISTINCT p.id AS id,g.slug AS game,i.code AS code,COALESCE(NULLIF(l.name,''),i.name) AS name,
      p.set_code AS setCode,${read.game==='pokemon'?cardCode:'p.printing_code'} AS cardNumber,p.language AS language,
      COALESCE(p.rarity,'') AS rarity,COALESCE(p.variant,'') AS variant,p.card_image_url AS imageUrl,
      CASE WHEN json_valid(p.source_payload) AND CAST(json_extract(p.source_payload,'$.set.cardCount.official') AS INTEGER)>0 THEN printf('%03d',CAST(json_extract(p.source_payload,'$.set.cardCount.official') AS INTEGER)) ELSE '' END AS setCardCount
    FROM tcg_card_printings p
    JOIN tcg_card_identities i ON i.id=p.identity_id
    JOIN tcg_games g ON g.id=i.game_id
    LEFT JOIN tcg_card_localizations l ON l.identity_id=i.id AND l.language=p.language
    WHERE ${conditions.join(' AND ')}
    ORDER BY CASE WHEN ?!='' AND UPPER(p.language)=? THEN 0 ELSE 1 END,
      CASE WHEN ?!='' AND UPPER(COALESCE(p.rarity,''))=? THEN 0 ELSE 1 END,
      CASE WHEN ?!='' AND UPPER(COALESCE(p.variant,'')) LIKE '%' || ? || '%' THEN 0 ELSE 1 END,
    CASE WHEN p.variant='Standard' THEN 0 ELSE 1 END,p.language,p.set_code,p.printing_code LIMIT 80
  `).bind(...values,
    read.language,read.language,
    read.rarity,read.rarity,
    read.game==='one-piece'?read.variant:'',read.game==='one-piece'?read.variant:'',
  ).all<Candidate>();
  const uniqueRows=deduplicateScanCandidates(rows.results).slice(0,24);
  return uniqueRows.map(candidate=>({...candidate,name:candidate.game==='one-piece'
    ?displayCardName(candidate.name,candidate.code).replace(new RegExp(`\\s*\\(${candidate.code.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')}\\)$`,'i'),'')
    :candidate.name,imageUrl:candidate.game==='pokemon'
    ?pokemonArtRoute(candidate.language,candidate.setCode,candidate.cardNumber,candidate.id)
    :`/${encodeURIComponent(candidate.setCode.replace(/[^A-Z0-9]/gi,''))}/${encodeURIComponent(candidate.language.toLowerCase())}/${encodeURIComponent(candidate.cardNumber)}.webp`}));
}

function normalizedSetCode(value:string){return value.toUpperCase().replace(/[^A-Z0-9]/g,'')}
function setCodeDistance(left:string,right:string){
  const a=normalizedSetCode(left),b=normalizedSetCode(right);
  const row=Array.from({length:b.length+1},(_,index)=>index);
  for(let i=1;i<=a.length;i++){
    let diagonal=row[0]!;row[0]=i;
    for(let j=1;j<=b.length;j++){
      const above=row[j]!;
      row[j]=Math.min(row[j]!+1,row[j-1]!+1,diagonal+(a[i-1]===b[j-1]?0:1));
      diagonal=above;
    }
  }
  return row[b.length]!;
}

async function recoverPokemonSetOcr(parsed:NonNullable<ReturnType<typeof parseText>>,includeOtherLanguages=false):Promise<Candidate[]>{
  const {read,numberCandidates}=parsed;
  if(read.game!=='pokemon'||!read.rarity)return [];
  const numbers=numberCandidates?.length?numberCandidates:[Number.parseInt(read.cardNumber,10)];
  const aliases=pokemonRarityAliases(read.rarity,read.language);
  const {cardCode,cardNumber,printedTotal}=pokemonCardCodeSql();
  const rows=await database().prepare(`
    SELECT p.id AS id,g.slug AS game,i.code AS code,COALESCE(NULLIF(l.name,''),i.name) AS name,p.set_code AS setCode,
      ${cardCode} AS cardNumber,p.language AS language,COALESCE(p.rarity,'') AS rarity,COALESCE(p.variant,'') AS variant,p.card_image_url AS imageUrl,
      CASE WHEN json_valid(p.source_payload) AND CAST(json_extract(p.source_payload,'$.set.cardCount.official') AS INTEGER)>0 THEN printf('%03d',CAST(json_extract(p.source_payload,'$.set.cardCount.official') AS INTEGER)) ELSE '' END AS setCardCount
    FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id JOIN tcg_games g ON g.id=i.game_id
    LEFT JOIN tcg_card_localizations l ON l.identity_id=i.id AND l.language=p.language
    WHERE g.slug='pokemon' AND CAST(CASE WHEN ${cardNumber} GLOB '[0-9]*' THEN ${cardNumber} ELSE '' END AS INTEGER) IN (${numbers.map(()=>'?').join(',')})
      AND UPPER(REPLACE(REPLACE(COALESCE(p.rarity,''),' ',''),'-','')) IN (${aliases.map(()=>'?').join(',')})
      ${read.cardNumberTotal?`AND ${printedTotal}=?`:''}
      ${read.language&&!includeOtherLanguages?"AND UPPER(p.language)=?":""}
    LIMIT 80
  `).bind(...numbers,...aliases,...(read.cardNumberTotal?[Number.parseInt(read.cardNumberTotal,10)]:[]),...(read.language&&!includeOtherLanguages?[read.language]:[])).all<Candidate>();
  const ranked=rows.results.map(candidate=>({candidate:{...candidate,imageUrl:pokemonArtRoute(candidate.language,candidate.setCode,candidate.cardNumber,candidate.id)},distance:Math.min(...setCandidatesForComparison(parsed).map(set=>setCodeDistance(candidate.setCode,set)))}))
    .filter(({distance})=>distance<=2)
    .sort((a,b)=>a.distance-b.distance||a.candidate.setCode.localeCompare(b.candidate.setCode));
  if(!ranked.length)return [];
  const bestDistance=ranked[0]!.distance;
  return deduplicateScanCandidates(ranked.filter(row=>row.distance===bestDistance).map(row=>row.candidate));
}

function setCandidatesForComparison(parsed:NonNullable<ReturnType<typeof parseText>>){
  return catalogSetCandidates(parsed.setCandidates.length?parsed.setCandidates:[parsed.read.setCode].filter(Boolean));
}

async function matchPokemonByKatakana(text:string,rarity?:string):Promise<Candidate[]>{
  let englishName:string|null=null;
  for(const [katakana,english] of Object.entries(pokemonKatakanaAliases)){
    if(text.includes(katakana)){
      englishName=english;
      break;
    }
  }
  if(!englishName)return [];
  const aliases=rarity?pokemonRarityAliases(rarity):[];
  const conditions=['g.slug=?','(UPPER(i.name) LIKE ? OR UPPER(l.name) LIKE ?)'];
  const values:(string|number)[]=['pokemon',`%${englishName.toUpperCase()}%`,`%${englishName.toUpperCase()}%`];
  if(aliases.length){
    conditions.push(`UPPER(REPLACE(REPLACE(COALESCE(p.rarity,''),' ',''),'-','')) IN (${aliases.map(()=>'?').join(',')})`);
    values.push(...aliases);
  }
  const rows=await database().prepare(`
    SELECT DISTINCT p.id AS id,g.slug AS game,i.code AS code,COALESCE(NULLIF(l.name,''),i.name) AS name,
      p.set_code AS setCode,p.printing_code AS cardNumber,p.language AS language,
      COALESCE(p.rarity,'') AS rarity,COALESCE(p.variant,'') AS variant,p.card_image_url AS imageUrl,
      CASE WHEN json_valid(p.source_payload) AND CAST(json_extract(p.source_payload,'$.set.cardCount.official') AS INTEGER)>0 THEN printf('%03d',CAST(json_extract(p.source_payload,'$.set.cardCount.official') AS INTEGER)) ELSE '' END AS setCardCount
    FROM tcg_card_printings p
    JOIN tcg_card_identities i ON i.id=p.identity_id
    JOIN tcg_games g ON g.id=i.game_id
    LEFT JOIN tcg_card_localizations l ON l.identity_id=i.id AND l.language=p.language
    WHERE ${conditions.join(' AND ')}
    ORDER BY CASE WHEN p.variant='Standard' THEN 0 ELSE 1 END, p.set_code DESC LIMIT 20
  `).bind(...values).all<Candidate>();
  return deduplicateScanCandidates(rows.results).map(c=>({...c,imageUrl:pokemonArtRoute(c.language,c.setCode,c.cardNumber,c.id)}));
}

const scanNoiseWords=new Set(['pokemon','basic','stage','evolves','from','weakness','resistance','retreat','cost','illustrator','illus','hp','one','piece','card','game','leader','character','event','counter','power','life','don','effect','trigger','blocker','rush','banish','double','attack','play','main','turn']);

async function matchCardByNameFallback(text:string,game:'pokemon'|'one-piece'|'auto'):Promise<Candidate[]>{
  const lines=text.split(/[\r\n]+/).map(line=>line.replace(/[^A-Za-z0-9\s.'-]/g,' ').replace(/\s+/g,' ').trim()).filter(line=>{
    if(line.length<4||line.length>42)return false;
    const words=line.toLowerCase().split(/\s+/).filter(Boolean);
    return words.some(word=>word.length>=4&&!scanNoiseWords.has(word));
  });
  const candidateTerm=lines.find(line=>!/^\d+$/.test(line));
  if(!candidateTerm)return [];
  const gameFilter=game==='auto'?'':"AND g.slug=?";
  const rows=await database().prepare(`
    SELECT DISTINCT p.id AS id,g.slug AS game,i.code AS code,COALESCE(NULLIF(l.name,''),i.name) AS name,
      p.set_code AS setCode,p.printing_code AS cardNumber,p.language AS language,
      COALESCE(p.rarity,'') AS rarity,COALESCE(p.variant,'') AS variant,p.card_image_url AS imageUrl,
      CASE WHEN json_valid(p.source_payload) AND CAST(json_extract(p.source_payload,'$.set.cardCount.official') AS INTEGER)>0 THEN printf('%03d',CAST(json_extract(p.source_payload,'$.set.cardCount.official') AS INTEGER)) ELSE '' END AS setCardCount
    FROM tcg_card_printings p
    JOIN tcg_card_identities i ON i.id=p.identity_id
    JOIN tcg_games g ON g.id=i.game_id
    LEFT JOIN tcg_card_localizations l ON l.identity_id=i.id AND l.language=p.language
    WHERE (UPPER(i.name) LIKE ? OR UPPER(l.name) LIKE ?) ${gameFilter}
    ORDER BY CASE WHEN UPPER(i.name)=? OR UPPER(l.name)=? THEN 0 ELSE 1 END,
      CASE WHEN p.variant='Standard' THEN 0 ELSE 1 END,p.language,p.set_code DESC LIMIT 16
  `).bind(`%${candidateTerm.toUpperCase()}%`,`%${candidateTerm.toUpperCase()}%`,...(game==='auto'?[]:[game]),candidateTerm.toUpperCase(),candidateTerm.toUpperCase()).all<Candidate>();
  return deduplicateScanCandidates(rows.results).map(candidate=>({...candidate,name:candidate.game==='one-piece'
    ?displayCardName(candidate.name,candidate.code).replace(new RegExp(`\\s*\\(${candidate.code.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')}\\)$`,'i'),'')
    :candidate.name,imageUrl:candidate.game==='pokemon'
    ?pokemonArtRoute(candidate.language,candidate.setCode,candidate.cardNumber,candidate.id)
    :`/${encodeURIComponent(candidate.setCode.replace(/[^A-Z0-9]/gi,''))}/${encodeURIComponent(candidate.language.toLowerCase())}/${encodeURIComponent(candidate.cardNumber)}.webp`}));
}

export async function POST(request:Request){
  try{
    const payload=await request.json() as {text?:unknown;game?:unknown};
    const text=typeof payload.text==='string'?payload.text.trim().slice(0,4000):'';
    const game=payload.game==='pokemon'||payload.game==='one-piece'?payload.game:'auto';
    if(!text)return Response.json({error:'No card text was recognized. Try a closer, sharper photo.'},{status:422});
    const parsed=parseText(text,game);
    if(!parsed){
      if(game==='pokemon'||game==='auto'){
        const katakanaCandidates=await matchPokemonByKatakana(text);
        if(katakanaCandidates.length>0){
          return Response.json({read:{game:'pokemon',name:'',setCode:'',cardNumber:'',cardNumberTotal:'',language:'JP',rarity:'',variant:'',block:''},candidates:katakanaCandidates});
        }
      }
      const nameCandidates=await matchCardByNameFallback(text,game);
      if(nameCandidates.length>0){
        return Response.json({read:{game:nameCandidates[0]!.game,name:'',setCode:'',cardNumber:'',cardNumberTotal:'',language:'',rarity:'',variant:'',block:''},candidates:nameCandidates});
      }
      return Response.json({error:'Could not read the set and card number. Keep the lower edge in focus and try again.'},{status:422});
    }
    const rarityOnlyFallback=parsed.read.game==='pokemon'&&!parsed.setCandidates.length;
    let candidates=await catalogMatches(parsed,rarityOnlyFallback);
    if(!candidates.length&&parsed.read.language)candidates=await catalogMatches(parsed,rarityOnlyFallback,true);
    if(!candidates.length&&parsed.read.game==='pokemon'&&parsed.setCandidates.length){
      candidates=await recoverPokemonSetOcr(parsed);
      if(!candidates.length&&parsed.read.language)candidates=await recoverPokemonSetOcr(parsed,true);
    }
    if(!candidates.length&&(parsed.read.game==='pokemon'||game==='auto')){
      candidates=await matchPokemonByKatakana(text,parsed.read.rarity);
    }
    return Response.json({read:parsed.read,candidates},{headers:{'Cache-Control':'private, no-store'}});
  }catch{
    return Response.json({error:'Could not search the card catalog. Please try again.'},{status:500});
  }
}
