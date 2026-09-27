export type SearchRule={name?:string;trait?:string;color?:string;cardType?:string};
export type SearchRestriction=SearchRule&{alternatives?:SearchRule[];excludeName?:string};
export function matchesSearch(card:{name?:string;traits?:string[];color?:string;type?:string},rule:SearchRestriction):boolean{
 const name=(value:string)=>value.replace(/\s*\([^)]*\)\s*$/,'').trim().toLowerCase();
 const matches=(part:SearchRule)=>(!part.name||name(card.name??'')===name(part.name))&&(!part.trait||Boolean(card.traits?.some(trait=>trait.toLowerCase()===part.trait!.toLowerCase())))&&(!part.color||Boolean(card.color?.toLowerCase().split(/[\s/]+/).includes(part.color.toLowerCase())))&&(!part.cardType||card.type===part.cardType);
 return (!rule.excludeName||name(card.name??'')!==name(rule.excludeName))&&(rule.alternatives?.length?rule.alternatives.some(matches):matches(rule));
}
