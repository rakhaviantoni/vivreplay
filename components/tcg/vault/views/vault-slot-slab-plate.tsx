import {useEffect,useState} from 'react';
import {versionedCardCatalogUrl} from '@/lib/card-catalog-cache';
import {pokemonPrintingRarity} from '@/lib/pokemon-rarity';
import type {EnrichedCollectionItem} from '../types';

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
  return withoutPrintSuffix.split(/[-/]/).filter(Boolean).at(-1)??withoutPrintSuffix;
}

function slabCardName(item:EnrichedCollectionItem){
  const code=String(item.card.code??'').trim();
  return item.card.name.replace(/\s*\(([^)]+)\)\s*$/,(_match,inside:string)=>inside.trim().toUpperCase()===code.toUpperCase()?'':' '+`(${inside})`);
}

function selectedVaultPrinting(item:EnrichedCollectionItem){
  const printings=item.card.availablePrintings??[];
  return printings.find(printing=>String(printing.id)===String(item.printingId))
    ??printings.find(printing=>
      (item.language??item.card.language)===(printing.language)
      &&normalizeSetCode(item.setCode??item.card.setCode??'')===normalizeSetCode(printing.set_code??'')
      &&String(item.printingCode??item.card.printingCode??'')===String(printing.printing_code??'')
      &&String(item.variant??item.card.variant??'')===String(printing.variant??'')
    );
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
  return normalized==='sr'?'SPECIAL ART RARE':value.toUpperCase();
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

export function VaultSlotSlabPlate({item}:{item:EnrichedCollectionItem}){
  const isPsa=(item.provider||'PSA').toUpperCase()==='PSA';
  const game=(item.card.gameSlug??(/^PK-/i.test(item.card.code)?'pokemon':'one-piece')) as 'one-piece'|'pokemon';
  const setCode=item.setCode??item.card.setCode??'';
  const selectedPrinting=selectedVaultPrinting(item);
  const labelSetCode=selectedPrinting?.set_code??setCode;
  const language=item.language??item.card.language??'EN';
  const year=useSetYear({enabled:isPsa,game,language,setCode:labelSetCode});
  const grade=psaGrade(item.grade,isPsa);
  const certification=item.certification?String(item.certification):'UNVERIFIED';
  const cardName=slabCardName(item);
  const cardNumber=printingCardNumber(item);
  const rarity=fullRarity(item,game);
  const displayLanguage=language==='JA'?'JP':language;
  const visibleSetCode=labelSetCode&&!/^PK-/i.test(labelSetCode)?labelSetCode:'TCG';
  const slabSetDescriptor=[year,game==='pokemon'?'POKÉMON':'ONE PIECE',visibleSetCode].filter(Boolean).join(' ');
  return <div className={`vault-slab-plate vault-slot-slab-plate${isPsa?' is-psa':''}`} aria-label={`${item.provider||'PSA'} ${grade.label} ${grade.score}, ${cardName}${rarity?`, ${rarity}`:''}, certificate ${certification}`}>
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
    </div>:<><div className="vault-slab-plate-left"><span className="vault-slab-provider">{item.provider}</span><span className="vault-slab-grade-num">{item.grade||'10'}</span></div><span className="vault-slab-cert-pill">#{item.certification?String(item.certification).slice(0,10):'UNVERIFIED'}</span></>}
  </div>;
}
