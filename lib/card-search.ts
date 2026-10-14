export type ParsedCardSearch={
  terms:string[];
  code?:string;
  setCode?:string;
  cardType?:'Leader'|'Character'|'Event'|'Stage'|'DON!!';
  rarity?:string;
  color?:string;
  cost?:number;
};

const colors=new Map([['red','Red'],['blue','Blue'],['green','Green'],['purple','Purple'],['black','Black'],['yellow','Yellow']]);
const types=new Map<string,ParsedCardSearch['cardType']>([['leader','Leader'],['leaders','Leader'],['character','Character'],['characters','Character'],['event','Event'],['events','Event'],['stage','Stage'],['stages','Stage'],['don','DON!!'],['don!!','DON!!']]);
const rarities=new Set(['C','UC','R','SR','SEC','PSEC','SP','L','TR']);
const normalize=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]/gu,'');

export function parseCardSearch(value:string):ParsedCardSearch{
  const words=value.trim().split(/\s+/).filter(Boolean);
  const removed=new Set<number>();
  let code:string|undefined,setCode:string|undefined,cardType:ParsedCardSearch['cardType'],rarity:string|undefined,color:string|undefined,cost:number|undefined;
  const codePattern=/^(OP|EB|ST|PRB|DON|P)[- ]?0*\d{1,3}-\d{1,3}$/i;
  const setPattern=/^(OP|EB|ST|PRB|DON|P)[- ]?0*\d{1,3}$/i;
  words.forEach((word,index)=>{
    const cleaned=word.replace(/[.,]/g,'');
    if(codePattern.test(cleaned)){
      const match=cleaned.toUpperCase().match(/^(OP|EB|ST|PRB|DON|P)[- ]?0*(\d{1,3})-0*(\d{1,3})$/);
      if(match){const setNumber=Number(match[2]);code=`${match[1]}${String(setNumber).padStart(2,'0')}-${String(Number(match[3])).padStart(3,'0')}`;setCode=`${match[1]}${setNumber}`;}
      removed.add(index);
    }
  });
  words.forEach((word,index)=>{
    if(removed.has(index))return;
    const cleaned=word.replace(/[.,]/g,'');
    const set=cleaned.match(setPattern);
    if(set){setCode=cleaned.toUpperCase().replace(/[- ]/g,'').replace(/^(OP|EB|ST|PRB|DON|P)0*(\d+)$/,'$1$2');removed.add(index);return;}
    const compactCost=cleaned.toLowerCase().match(/^(\d{1,2})c$/);
    if(compactCost){cost=Number(compactCost[1]);removed.add(index);return;}
    if(/^\d{1,2}$/.test(cleaned)&&words[index+1]?.toLowerCase()==='cost'){cost=Number(cleaned);removed.add(index);removed.add(index+1);return;}
    if(cleaned.toLowerCase()==='cost'&&/^\d{1,2}$/.test(words[index+1]??'')){cost=Number(words[index+1]);removed.add(index);removed.add(index+1);return;}
    const type=types.get(cleaned.toLowerCase());
    if(type){cardType=type;removed.add(index);return;}
    const colour=colors.get(cleaned.toLowerCase());
    if(colour){color=colour;removed.add(index);return;}
    const upper=cleaned.toUpperCase();
    if(rarities.has(upper)&&(upper.length>1||cleaned===upper)){rarity=upper;removed.add(index);}
  });
  const terms=words.filter((_,index)=>!removed.has(index)).map(normalize).filter(Boolean);
  return {terms,code,setCode,cardType,rarity,color,cost};
}

export function cardMatchesSearch(card:{name:string;code:string;setCode?:string;color?:string;type?:string;rarity?:string;cost?:number},filters:ParsedCardSearch){
  const name=normalize(card.name),code=normalize(card.code),set=normalize(card.setCode??'');
  return (!filters.code||code===normalize(filters.code))
    &&(!filters.setCode||set.startsWith(normalize(filters.setCode))||code.startsWith(normalize(filters.setCode)))
    &&(!filters.cardType||card.type?.toLowerCase()===filters.cardType.toLowerCase())
    &&(!filters.rarity||card.rarity?.toUpperCase()===filters.rarity)
    &&(!filters.color||card.color?.toLowerCase().includes(filters.color.toLowerCase()))
    &&(filters.cost===undefined||card.cost===filters.cost)
    &&filters.terms.every(term=>`${name} ${code}`.includes(term));
}
