export type SearchRule={name?:string;trait?:string;color?:string;cardType?:string;minCost?:number;maxCost?:number;exactCost?:number;minPower?:number;maxPower?:number;exactPower?:number;triggerOnly?:boolean;choose?:number};
export type SearchRestriction=SearchRule&{alternatives?:SearchRule[];excludeName?:string};
type SearchableCard={name?:string;traits?:string[];color?:string;type?:string;cost?:number;power?:number;effect?:string;effectText?:string;keywords?:string[]};
const normalizedName=(value:string)=>value.replace(/\s*\([^)]*\)\s*$/,'').trim().toLowerCase();
export function cardNameAliases(card:Pick<SearchableCard,'effect'|'effectText'>):string[]{
 const text=card.effectText??card.effect??'';
 return [...text.matchAll(/also treat this card's name as\s+\[([^\]]+)\]\s+according to the rules\.?/gi)].map(match=>match[1].trim()).filter(Boolean);
}
export function matchesCardName(card:SearchableCard,expected:string):boolean{
 const wanted=normalizedName(expected);
 return normalizedName(card.name??'')===wanted||cardNameAliases(card).some(alias=>normalizedName(alias)===wanted);
}
export function matchesSearch(card:SearchableCard,rule:SearchRestriction):boolean{
 const matches=(part:SearchRule)=>(!part.name||matchesCardName(card,part.name))&&(!part.trait||Boolean(card.traits?.some(trait=>trait.toLowerCase()===part.trait!.toLowerCase())))&&(!part.color||Boolean(card.color?.toLowerCase().split(/[\s/]+/).includes(part.color.toLowerCase())))&&(!part.cardType||card.type===part.cardType)&&(part.minCost===undefined||(card.cost??-Infinity)>=part.minCost)&&(part.maxCost===undefined||(card.cost??Infinity)<=part.maxCost)&&(part.exactCost===undefined||card.cost===part.exactCost)&&(part.minPower===undefined||(card.power??-Infinity)>=part.minPower)&&(part.maxPower===undefined||(card.power??Infinity)<=part.maxPower)&&(part.exactPower===undefined||card.power===part.exactPower)&&(!part.triggerOnly||Boolean(card.keywords?.includes('trigger')||/^\s*\[Trigger\]/im.test(card.effectText??card.effect??'')));
 return (!rule.excludeName||!matchesCardName(card,rule.excludeName))&&matches(rule)&&(rule.alternatives?.length?rule.alternatives.some(matches):true);
}
export function matchesSearchSelection(cards:SearchableCard[],rule:SearchRestriction):boolean{
 if(cards.some(card=>!matchesSearch(card,rule)))return false;
 const limited=rule.alternatives?.filter(alternative=>alternative.choose!==undefined);
 if(!limited?.length)return true;
 const assigned=Array.from({length:limited.length},()=>0),ordered=cards.map(card=>limited.map((alternative,index)=>({alternative,index})).filter(({alternative})=>matchesSearch(card,{...rule,alternatives:[alternative]})).map(({index})=>index)).sort((a,b)=>a.length-b.length);
 const assign=(position:number):boolean=>{if(position===ordered.length)return true;for(const index of ordered[position]){const limit=limited[index].choose??Infinity;if(assigned[index]>=limit)continue;assigned[index]++;if(assign(position+1))return true;assigned[index]--;}return false;};
 return assign(0);
}
