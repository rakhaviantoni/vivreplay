import type { CollectionItem } from '@/packages/domain';

export type PriceChartingFallback={amount:number;currency:'USD';url:string;label:string};
export const PRICECHARTING_USD_TO_IDR_RATE=16500;

// Explicit product mapping: this PriceCharting page is the Japanese SP
// version of OP09-119, which matches the catalog's p3 parallel printing.
const OP09_LUFFY_SP_URL='https://www.pricecharting.com/game/one-piece-japanese-carrying-on-his-will/monkeydluffy-sp-op09-119';
const OP09_LUFFY_SP_PRICE=180;

export function priceChartingFallback(item:Pick<CollectionItem,'language'|'setCode'|'printingCode'|'variant'>):PriceChartingFallback|undefined{
  const language=String(item.language??'').toUpperCase();
  const setCode=String(item.setCode??'').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const printingCode=String(item.printingCode??'').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const variant=String(item.variant??'').toLowerCase();
  if(language!=='JP'||setCode!=='OP09'||printingCode!=='OP09119P3'||!/(alt|parallel|sp)/i.test(variant))return;
  return {amount:OP09_LUFFY_SP_PRICE,currency:'USD',url:OP09_LUFFY_SP_URL,label:'PriceCharting · ungraded'};
}
