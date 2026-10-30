import {useEffect,useState,type ReactNode} from 'react';
import {versionedCardCatalogUrl} from '@/lib/card-catalog-cache';
import {pokemonPrintingRarity,pokemonRarityLabel} from '@/lib/pokemon-rarity';
import type {EnrichedCollectionItem,VaultPrinting} from '../types';

type PsaGrade={label:string;score:string};
type CardSetYear={code:string;releaseYear:number};
const setYearCache=new Map<string,Promise<Map<string,number>>>();
const normalizeSetCode=(value:string)=>value.toUpperCase().replace(/[-_\s]/g,'');

function psaGrade(value:string|null,isPsa:boolean):PsaGrade{
  const grade=String(value||'10').trim().toUpperCase();
  const expanded=grade.replace(/\bNM-MT\b/g,'NEAR MINT-MINT').replace(/\bEX-MT\b/g,'EXCELLENT-MINT').replace(/\bVG-EX\b/g,'VERY GOOD-EXCELLENT');
  const score=expanded.match(/(?:^|\s)(\d{1,2}(?:\.\d)?)$/)?.[1]??'';
  const rawLabel=score?expanded.slice(0,expanded.length-score.length).trim():expanded;
  const psaLabels:Record<string,string>={'GEM MINT':'GEM MT','NEAR MINT-MINT':'NM-MT','NEAR MINT':'NM','EXCELLENT-MINT':'EX-MT','EXCELLENT':'EX','VERY GOOD-EXCELLENT':'VG-EX','VERY GOOD':'VG','POOR':'PR'};
  const label=isPsa?(psaLabels[rawLabel]??rawLabel):rawLabel;
  if(label)return {label,score};
  const labels:Record<string,string>={'10':isPsa?'GEM MT':'GEM MINT','9.5':'MINT','9':'MINT','8.5':isPsa?'NM-MT':'NEAR MINT-MINT','8':isPsa?'NM-MT':'NEAR MINT-MINT','7':isPsa?'NM':'NEAR MINT','6':isPsa?'EX-MT':'EXCELLENT-MINT','5':isPsa?'EX':'EXCELLENT','4':isPsa?'VG-EX':'VERY GOOD-EXCELLENT','3':isPsa?'VG':'VERY GOOD','2':'GOOD','1':isPsa?'PR':'POOR'};
  return {label:labels[grade]??'GRADE',score:grade};
}

function bgsGrade(value:string|null):PsaGrade{
  const grade=String(value||'10').trim().toUpperCase();
  const scoreMatch=grade.match(/(?:^|\s)(\d{1,2}(?:\.\d)?)(?=\s|$)/);
  const score=scoreMatch?.[1]??'';
  const rawLabel=scoreMatch?grade.slice(0,scoreMatch.index).trim():grade;
  if(/\bBLACK\s*LABEL\b/.test(rawLabel))return {label:'PRISTINE',score:score||'10'};
  if(rawLabel)return {label:rawLabel,score};
  const labels:Record<string,string>={'10':'PRISTINE','9.5':'GEM MINT','9':'MINT','8.5':'NEAR MINT-MINT','8':'NEAR MINT-MINT','7.5':'NEAR MINT+','7':'NEAR MINT','6.5':'EXCELLENT-MINT+','6':'EXCELLENT-MINT','5.5':'EXCELLENT+','5':'EXCELLENT','4.5':'VERY GOOD-EXCELLENT+','4':'VERY GOOD-EXCELLENT','3.5':'VERY GOOD+','3':'VERY GOOD','2.5':'GOOD+','2':'GOOD','1.5':'FAIR','1':'POOR'};
  return {label:labels[grade]??'GRADE',score:score||grade};
}

function bgsBlackLabel(subgrades:Record<string,number|string>|null|undefined,grade:string|null,score:string){
  if(/\bblack\s*label\b/i.test(String(grade??'')))return true;
  if(score!=='10'||!subgrades)return false;
  const scores=Object.entries(subgrades).filter(([key])=>/centering|corners|edges|surface/i.test(key)).map(([,value])=>Number(String(value).match(/\d+(?:\.\d+)?/)?.[0]));
  return scores.length===4&&scores.every(score=>score===10);
}

function BgsMark(){
  return <svg className="vault-slot-bgs-logo" viewBox="0 0 72 46" role="img" aria-label="Beckett Grading Services">
    <path d="M14 5C5 9 3 16 5 23c-2 7 0 14 9 18M58 5c9 4 11 11 9 18 2 7 0 14-9 18" fill="none" stroke="currentColor" strokeWidth="2"/>
    <path d="m7 10 5 2-4 4m-1 5 6 1-5 4m2 5 6 0-4 5m56-26-5 2 4 4m1 5-6 1 5 4m-2 5-6 0 4 5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <text x="36" y="31" fill="currentColor" textAnchor="middle" fontFamily="Georgia,serif" fontSize="31" fontWeight="700">B</text>
    <text x="36" y="44" fill="currentColor" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="7" fontWeight="800" letterSpacing=".8">BECKETT</text>
  </svg>;
}

function ArsPlaqueFrame(){
  return <svg className="vault-slot-ars-frame" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true">
    <path d="M8 4h384v72H8zM8 23V8h24M8 57v15h24m360-49V8h-24m24 49v15h-24" fill="none" stroke="currentColor" strokeWidth="1"/>
    <path d="M10 19c8 0 10-2 10-10m-12 16c9 0 13-4 13-13m369 7c-8 0-10-2-10-10m12 16c-9 0-13-4-13-13M10 61c8 0 10 2 10 10M8 55c9 0 13 4 13 13m369-7c-8 0-10 2-10 10m12-16c-9 0-13 4-13 13" fill="none" stroke="currentColor" strokeWidth=".8"/>
  </svg>;
}

function ArsPlaqueSeal(){
  return <svg className="vault-slot-ars-seal" viewBox="0 0 80 48" aria-hidden="true">
    <path d="m40 2 8 8-8 8-8-8zM40 18l8 8-8 8-8-8zM40 34l8 7-8 5-8-5zM24 10l8 8-8 8-8-8zM56 10l8 8-8 8-8-8zM24 26l8 8-8 7-8-7zM56 26l8 8-8 7-8-7z" fill="none" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M11 18h12m34 0h12M11 34h12m34 0h12M40 2v42" fill="none" stroke="currentColor" strokeWidth=".8"/>
  </svg>;
}

function useSetYear({enabled,game,language,setCode}:{enabled:boolean;game:'one-piece'|'pokemon';language:string;setCode:string}){
  const normalizedLanguage=language==='ID'?'ID':language==='JP'||language==='JA'?'JP':'EN';
  const lookupKey=`${game}:${normalizedLanguage}:${normalizeSetCode(setCode)}`;
  const [resolved,setResolved]=useState<{key:string;year:number|null}>({key:'',year:null});
  useEffect(()=>{
    if(!enabled||!setCode)return;
    let active=true;
    const key=`${game}:${normalizedLanguage}`;
    let years=setYearCache.get(key);
    if(!years){
      years=fetch(versionedCardCatalogUrl(`/api/cards/sets?game=${game}&language=${normalizedLanguage}`),{cache:'force-cache'}).then(async response=>{
        if(!response.ok)return new Map<string,number>();
        const payload=await response.json() as {sets?:CardSetYear[]};
        return new Map((payload.sets??[]).filter(set=>set.code&&Number(set.releaseYear)>0).map(set=>[normalizeSetCode(set.code),Number(set.releaseYear)]));
      }).catch(()=>new Map<string,number>());
      setYearCache.set(key,years);
    }
    years.then(result=>{if(active)setResolved({key:lookupKey,year:result.get(normalizeSetCode(setCode))??null})});
    return()=>{active=false};
  },[enabled,game,normalizedLanguage,setCode,lookupKey]);
  return enabled&&setCode&&resolved.key===lookupKey?resolved.year:null;
}

function printingCardNumber(item:EnrichedCollectionItem){
  const printing=item.printingCode??item.card.printingCode??item.card.code;
  const withoutPrintSuffix=printing.replace(/_p\d+$/i,'');
  const numberPart=withoutPrintSuffix.split('-').filter(Boolean).at(-1)??withoutPrintSuffix;
  return numberPart.split('/')[0]??numberPart;
}

function pokemonCollectorNumber(item:EnrichedCollectionItem,printing:VaultPrinting|undefined){
  let payload:unknown=item.card.source_payload??{};
  if(typeof payload==='string')try{payload=JSON.parse(payload)}catch{payload={}}
  const record=payload&&typeof payload==='object'?payload as Record<string,unknown>:{};
  const explicit=String(record.collectorNumber??'').trim();
  const explicitFraction=explicit.match(/^(\d{1,4})\s*\/\s*(\d{1,4})$/);
  if(explicitFraction)return `${explicitFraction[1]}/${explicitFraction[2]}`;
  const localId=String(record.localId??explicit??printingCardNumber(item)).trim();
  const set=record.set&&typeof record.set==='object'?record.set as Record<string,unknown>:{};
  const cardCount=set.cardCount&&typeof set.cardCount==='object'?set.cardCount as Record<string,unknown>:{};
  const total=String(cardCount.official??set.printedTotal??record.setTotal??'').trim();
  return total&&/^\d+$/.test(localId)&&/^\d+$/.test(total)?`${localId}/${total}`:localId;
}

function arsPrintingNumber(item:EnrichedCollectionItem,printing:VaultPrinting|undefined,game:'one-piece'|'pokemon'){
  if(game==='one-piece')return slabFullPrintingCode(item,printing,game);
  const source=String(printing?.printing_code??item.printingCode??item.card.printingCode??item.card.code).replace(/_p\d+$/i,'');
  return source.match(/(?:^|[-_])(\d{1,3}\/\d{1,3})$/)?.[1]??printingCardNumber(item);
}

function slabCardName(item:EnrichedCollectionItem){
  const code=String(item.card.code??'').trim();
  return item.card.name.replace(/\s*\(([^)]+)\)\s*$/,(_match,inside:string)=>inside.trim().toUpperCase()===code.toUpperCase()?'':' '+`(${inside})`);
}

function slabArchetype(item:EnrichedCollectionItem,printing:VaultPrinting|undefined){
  if(isDonPrinting(item,printing,(item.card.gameSlug??'one-piece') as 'one-piece'|'pokemon'))return '';
  const source=item.card.source_payload??{};
  const value=printing?.sub_types??source.sub_types??source.subTypes??source.traits;
  if(Array.isArray(value))return String(value[0]??'').trim();
  if(typeof value==='string'&&value.trim()){
    try{
      const parsed=JSON.parse(value) as unknown;
      if(Array.isArray(parsed))return String(parsed[0]??'').trim();
    }catch{}
    return value.split(/[,/|]/).map(part=>part.trim()).find(Boolean)??'';
  }
  return item.card.effect.match(/\{([^}]+)\}/)?.[1]?.trim()??'';
}

function slabFullPrintingCode(item:EnrichedCollectionItem,printing:VaultPrinting|undefined,game:'one-piece'|'pokemon'){
  if(game==='pokemon')return printingCardNumber(item);
  const code=String(printing?.printing_code??item.printingCode??item.card.printingCode??item.card.code).replace(/_p\d+$/i,'').toUpperCase();
  return code.replace(/^OP-(\d+)-/,'OP$1-');
}

function selectedVaultPrinting(item:EnrichedCollectionItem){
  const printings=item.card.availablePrintings??[];
  const selected=printings.find(printing=>String(printing.id)===String(item.printingId));
  if(selected?.sub_types)return selected;
  const normalizedCode=(value:string)=>value.replace(/_p\d+$/i,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const normalizedVariant=(value:string)=>value.split(' · ')[0].trim().toLowerCase();
  const metadataMatch=printings.find(printing=>(item.language??item.card.language??'EN').toUpperCase()===printing.language.toUpperCase()
    &&normalizeSetCode(item.setCode??item.card.setCode??'')===normalizeSetCode(printing.set_code??'')
    &&normalizedCode(item.printingCode??item.card.printingCode??item.card.code)===normalizedCode(printing.printing_code??'')
    &&normalizedVariant(item.variant??item.card.variant??'Standard')===normalizedVariant(printing.variant??'Standard'));
  return selected?.sub_types?selected:metadataMatch?.sub_types?metadataMatch:selected??metadataMatch;
}

function fullRarity(item:EnrichedCollectionItem,game:'one-piece'|'pokemon'){
  const selectedPrinting=selectedVaultPrinting(item);
  const value=String(selectedPrinting?.rarity||item.rarity||item.card.rarity||'').trim();
  if(game==='pokemon'){
    const resolved=pokemonPrintingRarity(
      value,
      selectedPrinting?.language??item.language??item.card.language,
      selectedPrinting?.set_code??item.setCode??item.card.setCode,
      selectedPrinting?.printing_code??item.printingCode??item.card.printingCode,
    );
    const normalized=resolved.toLowerCase().replace(/[^a-z]/g,'');
    if(normalized==='sar'||normalized==='sir')return 'SPECIAL ART RARE';
    if(normalized==='ar'||normalized==='ir')return 'ART RARE';
    const labels:Record<string,string>={
      c:'COMMON',u:'UNCOMMON',r:'RARE',rr:'DOUBLE RARE',rrr:'TRIPLE RARE',ur:'ULTRA RARE',hr:'HYPER RARE',
      ace:'ACE SPEC RARE',ssr:'SHINY ULTRA RARE',sr:'SECRET RARE',promo:'PROMO',
    };
    return labels[normalized]??resolved.toUpperCase();
  }
  if(!value)return value;
  const normalized=value.toLowerCase().replace(/[^a-z]/g,'');
  if(normalized==='l')return 'LEADER';
  return normalized==='sr'?'SPECIAL ART RARE':value.toUpperCase();
}

function tagLabelDescriptor(item:EnrichedCollectionItem,printing:VaultPrinting|undefined,game:'one-piece'|'pokemon',rarity:string){
  if(game==='pokemon')return rarity;
  const category=String(item.card.type??'').trim().toUpperCase();
  const rawRarity=String(printing?.rarity||item.rarity||item.card.rarity||'').trim().toLowerCase().replace(/[^a-z]/g,'');
  const variant=String(printing?.variant||item.variant||item.card.variant||'').trim().toUpperCase().replace(/[_/]+/g,' ').replace(/\s+/g,' ');
  const rarityLabels:Record<string,string>={c:'COMMON',uc:'UNCOMMON',r:'RARE',sr:'SUPER RARE',sec:'SEC',l:'LEADER',sp:'SPECIAL',p:'PROMO',pr:'PR',don:'DON!!'};
  const rarityLabel=rarityLabels[rawRarity]??String(rarity||'').trim().toUpperCase();
  if(rawRarity==='don'||category==='DON!!')return 'DON!!';
  const promoFromVariant=/\bPROMO(?:TIONAL)?\b/.test(variant);
  const isPromo=promoFromVariant||['p','pr','promo'].includes(rawRarity);
  const isAlt=/\bALT(?:ERNATE)?(?:\s+ART)?\b|\bPARALLEL\b/.test(variant);
  const hasWanted=/\bWANTED\b/.test(variant);
  const hasSerialized=/\bSERIALI[ZS]ED\b/.test(variant);
  const hasSuperPreRelease=/\bSUPER\s+PRE[ -]?RELEASE\b/.test(variant);
  const hasSpecialAlternate=/\bSPECIAL\s+(?:ALT|ALTERNATE)(?:\s+ART)?\b/.test(variant);
  const hasManga=/\bMANGA\b/.test(variant);

  if(hasSpecialAlternate)return 'SPECIAL ALTERNATE ART';
  if(hasWanted&&isAlt)return `WANTED ALT ART - ${rarityLabel||category}`;
  if(hasSerialized){
    const suffix=[isAlt?'ALT ART':undefined,category||undefined,rarityLabel||undefined].filter(Boolean).join(' ');
    return suffix?`SERIALIZED - ${suffix}`:'SERIALIZED';
  }
  if(hasSuperPreRelease)return ['SUPER PRE RELEASE',category||undefined,rarityLabel&&!category?rarityLabel:undefined].filter(Boolean).join(' - ');
  if(isPromo&&isAlt){
    const promoFirst=promoFromVariant&&variant.indexOf('PROMO')<variant.search(/ALT|ALTERNATE|PARALLEL/);
    if(promoFirst)return ['PROMO','ALT ART',rarityLabel&&!['PROMO','PR'].includes(rarityLabel)?rarityLabel:undefined].filter(Boolean).join(' - ');
    return ['ALTERNATE ART','PROMO',rarityLabel&&!['PROMO','PR'].includes(rarityLabel)?rarityLabel:undefined].filter(Boolean).join(' - ');
  }
  if(isPromo)return 'PROMO';
  if(hasManga)return rawRarity==='sec'||rarityLabel==='SEC'?'MANGA ART - SEC':'MANGA ART';
  if(isAlt)return category?`ALTERNATE ART - ${category}`:'ALTERNATE ART';
  if(rawRarity==='l'||rarityLabel==='LEADER')return 'LEADER';
  return [rarityLabel,category].filter(Boolean).join(' - ');
}

function isDonPrinting(item:EnrichedCollectionItem,printing:VaultPrinting|undefined,game:'one-piece'|'pokemon'){
  if(game!=='one-piece')return false;
  const type=String(item.card.type??'').trim().toUpperCase();
  const codes=[printing?.printing_code,item.printingCode,item.card.printingCode,item.card.code].map(value=>String(value??'').trim().toUpperCase());
  return type==='DON!!'||type==='DON'||codes.some(code=>/^DON(?:[_-]|!!)/.test(code));
}

function egsOnePieceDetails(item:EnrichedCollectionItem,printing:VaultPrinting|undefined,rarity:string,archetype:string,printingCode:string){
  if(isDonPrinting(item,printing,'one-piece')){
    const number=printingCode.replace(/^DON(?:[_-]|!!)+/i,'').replace(/^[-_]+/,'');
    return [`DON!!${number?` #${number}`:''}`];
  }
  return [rarity?tagLabelDescriptor(item,printing,'one-piece',rarity):'', [archetype,printingCode?`#${printingCode}`:''].filter(Boolean).join(' ')].filter(Boolean);
}

function psaBarcodeBackground(certificate:string){
  let seed=2166136261;
  for(const character of certificate||'UNVERIFIED')seed=Math.imul(seed^character.charCodeAt(0),16777619)>>>0;
  const bars:{width:number;gap:number}[]=[];
  for(let index=0;index<42;index++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const width=1+seed%3;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    bars.push({width,gap:1+(seed>>>8)%2});
  }
  const total=bars.reduce((sum,bar)=>sum+bar.width+bar.gap,0);
  let cursor=0;
  const stops=bars.map(({width,gap})=>{
    const start=cursor/total*100;
    cursor+=width;
    const end=cursor/total*100;
    cursor+=gap;
    const gapEnd=cursor/total*100;
    return `#18202a ${start}% ${end}%, transparent ${end}% ${gapEnd}%`;
  });
  return `linear-gradient(90deg,${stops.join(',')})`;
}

function TagQrMark(){
  const size=25;
  const modules=Array.from({length:size},(_,y)=>Array.from({length:size},(_,x)=>{
    const inFinder=(left:number,top:number)=>x>=left&&x<left+7&&y>=top&&y<top+7;
    if(inFinder(0,0)||inFinder(size-7,0)||inFinder(0,size-7))return false;
    if(x>=9&&x<=15&&y>=9&&y<=15)return false;
    let seed=(x+1)*374761393+(y+1)*668265263;
    seed=(seed^(seed>>>13))*1274126177;
    seed^=seed>>>16;
    return (seed&3)!==0;
  }));
  const finder=(left:number,top:number)=><g key={`${left}-${top}`}>
    <rect x={left} y={top} width="7" height="7" fill="#fff"/>
    <rect x={left+1} y={top+1} width="5" height="5" fill="#050608"/>
    <rect x={left+2} y={top+2} width="3" height="3" fill="#fff"/>
  </g>;
  return <svg className="vault-slot-tag-qr" viewBox={`0 0 ${size} ${size}`} role="presentation" aria-hidden="true">
    <rect width={size} height={size} fill="#050608"/>
    {modules.flatMap((row,y)=>row.map((active,x)=>active?<rect key={`${x}-${y}`} x={x+.12} y={y+.12} width=".76" height=".76" fill="#fff"/>:null))}
    {finder(0,0)}{finder(size-7,0)}{finder(0,size-7)}
    <rect x="9" y="9" width="7" height="7" fill="#050608"/>
    <rect x="10" y="10" width="5" height="5" fill="#fff"/>
    <text x="12.5" y="13.15" textAnchor="middle" fill="#050608" fontSize="2.1" fontWeight="700">TAG</text>
  </svg>;
}

function EgsQrMark(){
  const size=21;
  const blocks=Array.from({length:size},(_,y)=>Array.from({length:size},(_,x)=>{
    const finder=(left:number,top:number)=>x>=left&&x<left+5&&y>=top&&y<top+5;
    if(finder(0,0)||finder(size-5,0)||finder(0,size-5))return false;
    let seed=(x+11)*374761393+(y+7)*668265263;
    seed=(seed^(seed>>>13))*1274126177;
    return ((seed^(seed>>>16))&3)!==0;
  }));
  const finder=(left:number,top:number)=><g key={`${left}-${top}`} fill="currentColor">
    <path d={`M${left} ${top}h5v5h-5z M${left+1} ${top+1}v3h3v-3z`} fillRule="evenodd"/>
  </g>;
  return <svg className="vault-slot-egs-qr" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
    {blocks.flatMap((row,y)=>row.map((active,x)=>active?<rect key={`${x}-${y}`} x={x+.15} y={y+.15} width=".7" height=".7" fill="currentColor"/>:null))}
    {finder(0,0)}{finder(size-5,0)}{finder(0,size-5)}
  </svg>;
}

export function VaultSlotSlabPlate({item}:{item:EnrichedCollectionItem}){
  const provider=(item.provider||'PSA').trim().toUpperCase();
  const isPsa=provider==='PSA';
  const isCgc=provider==='CGC'||provider==='CGC CARDS'||provider==='CERTIFIED GUARANTY COMPANY';
  const isTag=provider==='TAG'||provider==='TAG GRADING';
  const isBgs=provider==='BGS'||provider.startsWith('BECKETT');
  const isArs=provider==='ARS'||provider.startsWith('ARS ');
  const isEgs=provider==='EGS'||provider.startsWith('EGS ')||provider.includes('EMPORIUM GRADING SERVICE');
  const egsLabelStyle=String(item.subgrades?.__labelStyle??'standard').toLowerCase()==='clear'?'clear':'standard';
  const egsPristine=isEgs&&/\bPRISTINE\b/i.test(String(item.grade??''));
  const isTagPristine=isTag&&/\bPRISTINE\b/i.test(String(item.grade??''));
  const game=(item.card.gameSlug??(/^PK-/i.test(item.card.code)?'pokemon':'one-piece')) as 'one-piece'|'pokemon';
  const setCode=item.setCode??item.card.setCode??'';
  const selectedPrinting=selectedVaultPrinting(item);
  const labelSetCode=selectedPrinting?.set_code??setCode;
  const language=item.language??item.card.language??'EN';
  const year=useSetYear({enabled:isPsa||isCgc||isTag||isBgs||isEgs||isArs,game,language,setCode:labelSetCode});
  const grade=psaGrade(item.grade,isPsa);
  const bgsGradeValue=bgsGrade(item.grade);
  const bgsIsBlack=bgsBlackLabel(item.subgrades,item.grade,bgsGradeValue.score);
  const bgsIsGold=bgsIsBlack||bgsGradeValue.score==='10'||bgsGradeValue.score==='9.5'||/\b(?:PRISTINE|GEM MINT)\b/i.test(String(item.grade??''));
  const cgcPristine=isCgc&&/\bpristine\b/i.test(String(item.grade??''));
  const certification=item.certification?String(item.certification):'UNVERIFIED';
  const cardName=slabCardName(item);
  const cardNumber=printingCardNumber(item);
  const rarity=fullRarity(item,game);
  const displayLanguage=language==='JA'?'JP':language;
  const visibleSetCode=labelSetCode&&!/^PK-/i.test(labelSetCode)?labelSetCode:'TCG';
  const slabSetDescriptor=[year,game==='pokemon'?'POKÉMON':'ONE PIECE',visibleSetCode].filter(Boolean).join(' ');
  const gameLabel=game==='pokemon'?'Pokémon':'One Piece';
  const languageLabel=displayLanguage==='JP'?'Japanese':displayLanguage==='ID'?'Indonesian':'English';
  const setName=selectedPrinting?.set_name||visibleSetCode;
  const archetype=slabArchetype(item,selectedPrinting);
  const fullPrintingCode=slabFullPrintingCode(item,selectedPrinting,game);
  const arsNumber=arsPrintingNumber(item,selectedPrinting,game);
  const arsRarity=rarity.toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase());
  const arsGameName=game==='pokemon'?(displayLanguage==='JP'?'ポケモンカードゲーム':'Pokémon Card Game'):(displayLanguage==='JP'?'ワンピースカードゲーム':'One Piece Card Game');
  const pokemonRarityCode=pokemonRarityLabel(pokemonPrintingRarity(selectedPrinting?.rarity??item.rarity??item.card.rarity,language,labelSetCode,selectedPrinting?.printing_code??item.printingCode),language).toUpperCase();
  const pokemonSlabNumber=pokemonCollectorNumber(item,selectedPrinting);
  const egsOnePieceLines=egsOnePieceDetails(item,selectedPrinting,rarity,archetype,fullPrintingCode);
  const gradeDescription=isBgs?`${bgsGradeValue.label} ${bgsGradeValue.score}`:(cgcPristine||isTagPristine?`PRISTINE ${grade.score}`:`${grade.label} ${grade.score}`);
  return <div className={`vault-slab-plate vault-slot-slab-plate${isPsa?' is-psa':''}${isCgc?' is-cgc':''}${isTag?' is-tag':''}${isArs?' is-ars':''}${isEgs?` is-egs is-egs-${egsLabelStyle}${egsPristine&&egsLabelStyle==='standard'?' is-egs-pristine':''}`:''}${isBgs?` is-bgs${bgsIsBlack?' is-bgs-black':bgsIsGold?' is-bgs-gold':' is-bgs-silver'}`:''}`} aria-label={`${item.provider||'PSA'} ${gradeDescription}, ${cardName}${rarity?`, ${rarity}`:''}, certificate ${certification}`}>
    {isPsa?<div className="vault-slot-psa-label">
      <div className="vault-slot-psa-left">
        <div className="vault-slot-psa-top" title={slabSetDescriptor}>
          <span>{slabSetDescriptor}</span>
          <b>{displayLanguage}</b>
        </div>
        <strong className="vault-slot-psa-name">{cardName}</strong>
        {rarity&&<span className="vault-slot-psa-rarity">{rarity}</span>}
        <span className="vault-slot-psa-barcode" style={{backgroundImage:psaBarcodeBackground(certification)}} aria-hidden="true"/>
      </div>
      <div className="vault-slot-psa-right">
        <b className="vault-slot-psa-number">#{cardNumber}</b>
        <span className="vault-slot-psa-grade-label">{grade.label}</span>
        <strong className="vault-slot-psa-grade-score">{grade.score}</strong>
        <span className="vault-slot-psa-cert-number">{certification}</span>
      </div>
      <span className="vault-slot-psa-stamp" aria-label="PSA"><b>P<span>S</span>A</b></span>
    </div>:isCgc?<div className="vault-slot-cgc-label">
      <header className="vault-slot-cgc-header">
        <span className="vault-slot-cgc-logo" aria-label="CGC">CGC</span>
        <strong>CERTIFIED GUARANTY COMPANY</strong>
      </header>
      <div className="vault-slot-cgc-content">
        <div className="vault-slot-cgc-details">
          <strong className="vault-slot-cgc-name">{cardName}</strong>
          <span>{gameLabel}{year?` (${year})`:''} {languageLabel}</span>
          <span>{[setName,cardNumber?`#${cardNumber}`:''].filter(Boolean).join(' ')}</span>
          {rarity&&<span>{rarity}</span>}
          <div className="vault-slot-cgc-cert-row">
            <i className="vault-slot-cgc-barcode" style={{backgroundImage:psaBarcodeBackground(certification)}} aria-hidden="true"/>
            <span>{certification==='UNVERIFIED'?'':certification}</span>
          </div>
        </div>
        <div className="vault-slot-cgc-grade">
          {cgcPristine&&<span className="vault-slot-cgc-pristine">PRISTINE</span>}
          {!cgcPristine&&<span>{grade.label||'GRADE'}</span>}
          <strong>{grade.score}</strong>
        </div>
      </div>
    </div>:isBgs?<div className="vault-slot-bgs-label">
      <div className="vault-slot-bgs-brand"><BgsMark /></div>
      <div className="vault-slot-bgs-details">
        <strong>{year?`${year} `:''}{game==='pokemon'?'POKÉMON':'ONE PIECE'}{visibleSetCode?` ${visibleSetCode}`:''} {displayLanguage}</strong>
        <span>{cardName}</span>
        <span>{[archetype,fullPrintingCode?`#${fullPrintingCode}`:''].filter(Boolean).join('  ')}</span>
        {rarity&&<span>{tagLabelDescriptor(item,selectedPrinting,game,rarity)}</span>}
        <div className="vault-slot-bgs-subgrades">
          {['Centering','Corners','Edges','Surface'].map(label=>{
            const value=Object.entries(item.subgrades??{}).find(([key])=>key.toLowerCase()===label.toLowerCase())?.[1];
            return value!==undefined?<span key={label}>{label}<b>{value}</b></span>:null;
          })}
        </div>
      </div>
      <div className="vault-slot-bgs-grade"><strong>{bgsGradeValue.score}</strong><span>{bgsGradeValue.label}</span><span className="vault-slot-bgs-cert">{certification==='UNVERIFIED'?'':certification}</span></div>
    </div>:isTag?<div className="vault-slot-tag-label">
      <header className="vault-slot-tag-header"><b>TAG</b></header>
      <div className="vault-slot-tag-content">
        <div className="vault-slot-tag-details">
          <strong>{cardName}</strong>
          <span>{year?`${year} `:''}{gameLabel} {languageLabel}</span>
          <span>{[archetype,fullPrintingCode?`#${fullPrintingCode}`:''].filter(Boolean).join(' ')}</span>
          {rarity&&<span>{tagLabelDescriptor(item,selectedPrinting,game,rarity)}</span>}
        </div>
        <TagQrMark />
        <span className="vault-slot-tag-cert">{certification==='UNVERIFIED'?'':certification}</span>
        <div className={`vault-slot-tag-grade${isTagPristine?' is-pristine':''}`}><strong>{grade.score}</strong><span>{isTagPristine?'PRISTINE':grade.label||'GRADE'}</span></div>
      </div>
    </div>:isEgs?<div className={`vault-slot-egs-label${egsLabelStyle==='clear'?' vault-slot-egs-clear':''}`}>
      {egsLabelStyle==='clear'?<>
        <div className="vault-slot-egs-clear-qr"><EgsQrMark/><span>{certification==='UNVERIFIED'?'':certification}</span></div>
        <div className="vault-slot-egs-details">
          <strong>{year?`${year} `:''}{game==='pokemon'?'POKÉMON':'ONE PIECE'}{visibleSetCode?` ${visibleSetCode}`:''} {displayLanguage}</strong>
          <strong>{cardName}</strong>
          {game==='pokemon'?<span>{pokemonRarityCode}{pokemonSlabNumber?` - ${pokemonSlabNumber}`:''}</span>:<>
            {egsOnePieceLines.map((line,index)=><span key={`${index}-${line}`}>{line}</span>)}
          </>}
        </div>
        <div className="vault-slot-egs-grade">
          <strong>{grade.score||item.grade||'—'}</strong>
          <span>{grade.label||'GRADE'}</span>
        </div>
        <b className="vault-slot-egs-clear-mark"><span className="vault-slot-egs-clear-logo">EGS</span></b>
      </>:<>
        <div className="vault-slot-egs-brand"><span className="vault-slot-egs-brand-logo"><svg viewBox="0 0 20 16" aria-hidden="true"><path d="M1.5 3.5 5.5 7 10 1.5 14.5 7l4-3.5-2 10H3.5l-2-10ZM4 15h12" fill="currentColor"/></svg><b>EGS</b></span>{certification!=='UNVERIFIED'&&<span>{certification}</span>}</div>
        <div className="vault-slot-egs-details">
          <strong>{year?`${year} `:''}{game==='pokemon'?'POKÉMON':'ONE PIECE'}{visibleSetCode?` ${visibleSetCode}`:''} {displayLanguage}</strong>
          <strong>{cardName}</strong>
          {game==='one-piece'?egsOnePieceLines.map((line,index)=><span key={`${index}-${line}`}>{line}</span>):<>
            {rarity&&<span>{tagLabelDescriptor(item,selectedPrinting,game,rarity)}</span>}
            <span>{[archetype,fullPrintingCode?`#${fullPrintingCode}`:''].filter(Boolean).join(' ')}</span>
          </>}
        </div>
        <div className="vault-slot-egs-grade">
          <strong>{grade.score||item.grade||'—'}</strong>
          <span className={egsPristine?'vault-slot-egs-pristine':''}>{egsPristine?'PRISTINE':grade.label||'GRADE'}</span>
        </div>
      </>}
    </div>:isArs?<div className="vault-slot-ars-label">
      <ArsPlaqueFrame />
      <ArsPlaqueSeal />
      <strong>{cardName}</strong>
      <span>{arsGameName}</span>
      <span>{[setName,year].filter(Boolean).join(' / ')}</span>
      <div className="vault-slot-ars-printing"><b>{arsNumber}</b>{game==='pokemon'&&/^ART RARE$/i.test(rarity)&&<span aria-hidden="true">★</span>}{arsRarity&&<span>{arsRarity}</span>}</div>
    </div>:<><div className="vault-slab-plate-left"><span className="vault-slab-provider">{item.provider}</span><span className="vault-slab-grade-num">{item.grade||'10'}</span></div><span className="vault-slab-cert-pill">#{item.certification?String(item.certification).slice(0,10):'UNVERIFIED'}</span></>}
  </div>;
}

export function VaultSlabCase({item,children,className='',showLabel=true}:{item:EnrichedCollectionItem;children:ReactNode;className?:string;showLabel?:boolean}){
  const isArs=(item.provider??'').trim().toUpperCase().startsWith('ARS');
  const art=<div className="vault-slab-case-art">{children}</div>;
  const label=showLabel?<VaultSlotSlabPlate item={item}/>:null;
  return <div className={`vault-slab-case is-display ${className}`.trim()}>
    {isArs?<>{art}{label}</>:<>{label}{art}</>}
  </div>;
}
