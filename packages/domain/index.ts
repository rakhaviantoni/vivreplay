import { z } from 'zod';
import { cards, cardFor, type Card } from '../card-data/catalog';
export const BRAND='PROJECT_NAME';
export const featureFlags={marketplaceCheckout:false,ranked:false,aiOpponent:false,advancedMeta:false,tournaments:false,slabVerification:false,priceAlerts:false};
export type CollectionItem={
  id:string;
  printingId:string;
  type:'RAW'|'GRADED';
  quantity:number;
  condition:string;
  provider:string|null;
  grade:string|null;
  certification:string|null;
  visibility:'private'|'public'|'marketplace-only';
  acquisitionAmount:number;
  currency:string;
  acquiredAt?:string|null;
  notes?:string|null;
  subgrades?:Record<string,number|string>|null;
  population?:Record<string,number>|null;
  verificationStatus?:string|null;
  verificationSource?:string|null;
  favorite?:boolean;
  card?:any;
};
export type DeckEntry={cardId:string;quantity:number};
export type SavedDeck={id:string;name:string;leaderId:string;visibility:'public'|'private';version:number;versionId:string;cards:DeckEntry[]};
export type ListingItem={
  printingId:string;
  quantity:number;
  /** Condition and price belong to an individual card line in a multi-card listing. */
  condition?:string;
  unitAmount?:number;
};
export type Listing={id:string;printingId:string;title:string;amount:number;currency:string;quantity:number;condition:string;type:string;seller:string;city:string;createdAt?:string;expiresAt?:string;card?:Card;language?:string;items?:ListingItem[]};
const catalogCardInput=z.object({code:z.string().trim().min(2).max(40),name:z.string().trim().min(1).max(140),color:z.string().trim().max(80),type:z.enum(['Leader','Character','Event']),cost:z.number().int().min(0).max(99),power:z.number().int().min(0).max(999999),rarity:z.string().trim().max(40),effect:z.string().max(4000),setCode:z.string().trim().max(40).optional(),language:z.enum(['EN','JP']).optional(),imageUrl:z.string().url().max(2048).optional()});
export const collectionInput=z.object({
  id:z.string().uuid().optional(),
  printingId:z.string().uuid(),
  catalogCard:catalogCardInput.optional(),
  type:z.enum(['RAW','GRADED']),
  quantity:z.number().int().min(1).max(999),
  condition:z.enum(['NM','LP','MP','HP','DMG']).default('NM'),
  provider:z.string().trim().min(1).max(40).nullable(),
  grade:z.string().trim().min(1).max(20).nullable(),
  certification:z.string().trim().min(1).max(100).nullable(),
  visibility:z.enum(['private','public','marketplace-only']).default('private'),
  acquisitionAmount:z.number().int().nonnegative().max(100000000000),
  currency:z.enum(['IDR','USD','JPY']),
  acquiredAt:z.string().optional().nullable(),
  notes:z.string().max(2000).optional().nullable(),
  subgrades:z.record(z.string(),z.union([z.number(),z.string()])).optional().nullable(),
  favorite:z.boolean().optional(),
}).superRefine((v,ctx)=>{if(v.type==='GRADED'&&(v.quantity!==1||!v.provider||!v.grade||!v.certification))ctx.addIssue({code:'custom',message:'A slab requires quantity 1, provider, grade, and certification.'});});
export const deckInput=z.object({id:z.string().uuid().optional(),name:z.string().trim().min(2).max(80),leaderId:z.string().uuid(),visibility:z.enum(['private','public']),cards:z.array(z.object({cardId:z.string().uuid(),quantity:z.number().int().min(1).max(4)})).max(50)});
export function validateDeck(leaderId:string,entries:DeckEntry[]){const leader=cards.find(c=>c.id===leaderId);const issues:string[]=[];if(!leader||leader.type!=='Leader')issues.push('Choose a leader.');const total=entries.reduce((n,e)=>n+e.quantity,0);if(total!==50)issues.push(`${total}/50 main-deck cards. Add ${Math.max(0,50-total)} more.`);if(new Set(entries.map(e=>e.cardId)).size!==entries.length)issues.push('Duplicate card entries.');for(const e of entries){const c=cards.find(c=>c.id===e.cardId);if(!c||c.type==='Leader')issues.push('Main deck contains an invalid card.');if(e.quantity>4||e.quantity<1)issues.push('A card may have 1–4 copies.');if(c&&leader&&c.color!==leader.color)issues.push(`${c.name} does not match your leader color.`);}return [...new Set(issues)];}
export function ownership(entries:DeckEntry[],collection:CollectionItem[]){return entries.map(e=>{const owned=collection.filter(x=>x.type==='RAW'&&cardFor(x.printingId)?.id===e.cardId).reduce((n,x)=>n+x.quantity,0);return {...e,owned:Math.min(owned,e.quantity),missing:Math.max(0,e.quantity-owned)};});}
export function formatMoney(amount:number,currency='IDR'){return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:currency==='IDR'||currency==='JPY'?0:2}).format(amount/(currency==='USD'?100:1));}
export function formatCompactMoney(amount:number,currency='IDR'):string{
  if(currency==='IDR'){
    if(amount>=1_000_000_000)return `Rp${(amount/1_000_000_000).toFixed(1).replace(/\.0$/,'')}b`;
    if(amount>=1_000_000)return `Rp${(amount/1_000_000).toFixed(1).replace(/\.0$/,'')}m`;
    if(amount>=1_000)return `Rp${Math.round(amount/1_000)}k`;
    return `Rp${amount.toLocaleString()}`;
  }
  if(currency==='USD'){
    const dollars=amount/100;
    if(dollars>=1_000_000)return `$${(dollars/1_000_000).toFixed(1).replace(/\.0$/,'')}M`;
    if(dollars>=1_000)return `$${(dollars/1_000).toFixed(1).replace(/\.0$/,'')}k`;
    return `$${dollars.toFixed(dollars%1===0?0:2)}`;
  }
  if(currency==='JPY'){
    if(amount>=10_000)return `¥${(amount/10_000).toFixed(1).replace(/\.0$/,'')}万`;
    if(amount>=1_000)return `¥${(amount/1_000).toFixed(0)}k`;
    return `¥${amount.toLocaleString()}`;
  }
  return formatMoney(amount,currency);
}
export const GRADING_PROVIDERS=[
  {id:'PSA',name:'PSA',shortName:'PSA',hasSubgrades:false,website:'https://www.psacard.com/cert/'},
  {id:'BGS',name:'Beckett (BGS)',shortName:'BGS',hasSubgrades:true,website:'https://www.beckett.com/grading/card-lookup'},
  {id:'CGC',name:'CGC Cards',shortName:'CGC',hasSubgrades:true,website:'https://www.cgccards.com/certlookup/'},
  {id:'TAG',name:'TAG Grading',shortName:'TAG',hasSubgrades:true,website:'https://taggrading.com/verify'},
  {id:'ESG',name:'ESG Grading',shortName:'ESG',hasSubgrades:true,website:'https://esggrading.com/lookup'},
  {id:'ARS',name:'ARS',shortName:'ARS',hasSubgrades:false,website:'https://ars-grading.com'},
  {id:'SGC',name:'SGC',shortName:'SGC',hasSubgrades:false,website:'https://gosgc.com/cert-code-lookup'},
] as const;
export type PriceObservation={amount:number;currency:string;saleType:'completed_sale'|'active_listing'|'marketplace_ask'|'marketplace_bid';observedAt:string;grader:string|null;grade:string|null;printingId:string};
export function valueFromObservations(observations:PriceObservation[],key:Pick<PriceObservation,'printingId'|'grader'|'grade'|'currency'>){const rows=observations.filter(x=>x.printingId===key.printingId&&x.grader===key.grader&&x.grade===key.grade&&x.currency===key.currency&&x.saleType==='completed_sale').sort((a,b)=>a.amount-b.amount);if(!rows.length)return null;const n=rows.length;return {estimatedValue:Math.round((rows[Math.floor((n-1)/2)].amount+rows[Math.ceil((n-1)/2)].amount)/2),lowEstimate:rows[0].amount,highEstimate:rows[n-1].amount,sampleSize:n,confidence:n>=20?'high':n>=5?'medium':'low',lastUpdatedAt:rows.map(x=>x.observedAt).sort().at(-1)};}
