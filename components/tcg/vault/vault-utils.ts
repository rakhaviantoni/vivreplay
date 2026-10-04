import { cards, printings, cardFor, SETS_CATALOG } from '@/packages/card-data/catalog';
import type { CollectionItem } from '@/packages/domain';
import type { EnrichedCollectionItem, VaultStats, SetProgress, VaultCard, VaultMarketPrice, VaultStackGroup } from './types';
import { priceChartingFallback, PRICECHARTING_USD_TO_IDR_RATE } from '@/lib/market/pricecharting';

function priceInIdr(amount:number,currency:string,rate:number):number|null{
  if(currency==='JPY')return Math.round(amount*rate);
  if(currency==='IDR')return Math.round(amount);
  if(currency==='USD')return Math.round(amount*PRICECHARTING_USD_TO_IDR_RATE);
  return null;
}

export function estimateItemValue(item:CollectionItem,price:VaultMarketPrice|undefined,rate:number){
  if(item.type!=='RAW'||!price)return {value:0,previousValue:null,perCard:null,observations:0,hasEstimate:false};
  const perCard=priceInIdr(price.amount,price.currency,rate);
  if(perCard===null||perCard<=0)return {value:0,previousValue:null,perCard:null,observations:price.observationCount,hasEstimate:false};
  const previousPerCard=price.previousAmount!==null&&price.previousCurrency?priceInIdr(price.previousAmount,price.previousCurrency,rate):null;
  return {value:perCard*item.quantity,previousValue:previousPerCard===null?null:previousPerCard*item.quantity,perCard,observations:price.observationCount,hasEstimate:true};
}

export function enrichCollectionItem(item: CollectionItem, favoritesSet: Set<string>, prices:Record<string,VaultMarketPrice>={}, rate=110): EnrichedCollectionItem {
  const storedCard = item.card as VaultCard | undefined;
  const storedPrinting=storedCard?.availablePrintings?.find(printing=>String(printing.id)===String(item.printingId));
  const catalogCard = cards.find(card => card.code === storedCard?.code) || cardFor(item.printingId) || cards.find(c => c.id === item.printingId);
  const storedImage = storedPrinting?.card_image_url??storedCard?.imageUrl;
  const usableStoredImage = storedImage && (/^https?:\/\//i.test(storedImage) || storedImage.startsWith('/'));
  const card = storedCard
    ? { ...catalogCard, ...storedCard,
      language:storedPrinting?.language??item.language??storedCard.language,
      variant:storedPrinting?.variant??item.variant??storedCard.variant,
      setCode:storedPrinting?.set_code??item.setCode??storedCard.setCode,
      printingCode:storedPrinting?.printing_code??item.printingCode??storedCard.printingCode,
      rarity:storedPrinting?.rarity??item.rarity??storedCard.rarity,
      imageUrl:usableStoredImage?storedImage:catalogCard?.imageUrl,
      // Identity catalog assets can point at the standard art, so only the
      // selected printing's URL is allowed to drive Vault card artwork.
      assetPath:undefined,
    }
    : catalogCard || {
    id: item.printingId,
    code: 'CARD-UNKNOWN',
    name: 'Unknown Card',
    color: 'Red',
    type: 'Character',
    cost: 0,
    power: 0,
    rarity: 'C',
    art: 0,
    effect: '',
    setCode: item.setCode
  };

  const price=prices[item.printingId]??(()=>{const fallback=priceChartingFallback({language:storedPrinting?.language??item.language??storedCard?.language,setCode:storedPrinting?.set_code??item.setCode??storedCard?.setCode,printingCode:storedPrinting?.printing_code??item.printingCode??storedCard?.printingCode,variant:storedPrinting?.variant??item.variant??storedCard?.variant});return fallback?{amount:fallback.amount,currency:fallback.currency,observedAt:'',observationCount:0,previousAmount:null,previousCurrency:null,previousObservedAt:null,source:'pricecharting' as const,sourceUrl:fallback.url}:undefined})();
  const { value, previousValue, perCard, observations, hasEstimate } = estimateItemValue(item,price,rate);
  const cost = item.acquisitionAmount || 0;
  const gainLossAmount = hasEstimate ? value - cost : 0;
  const gainLossPercent = hasEstimate&&cost > 0 ? (gainLossAmount / cost) * 100 : 0;

  return {
    ...item,
    card,
    estimatedValue: value,
    gainLossAmount,
    gainLossPercent,
    hasMarketEstimate:hasEstimate,
    marketPricePerCard:perCard,
    marketPriceCurrency:price?.currency??null,
    marketPriceSource:price?.source??(price?'yuyutei':null),
    marketPriceUrl:price?.sourceUrl??null,
    marketObservedAt:price?.observedAt??null,
    marketObservationsCount:observations,
    marketPreviousValue:previousValue,
    observationsCount: observations,
    isFavorite: favoritesSet.has(item.id) || item.favorite === true,
  };
}

export function groupVaultStacks(items:EnrichedCollectionItem[]):VaultStackGroup[]{
  const grouped=new Map<string,EnrichedCollectionItem[]>();
  for(const item of items){
    // A Vault slot represents one exact printing. Copies of the same printing
    // can stack, while alternate art and languages remain separate slots.
    const key=item.type==='RAW'?`RAW:${item.card.code==='CARD-UNKNOWN'?item.id:item.card.code}:${item.printingId}:${item.condition||'NM'}`:`GRADED:${item.id}`;
    const group=grouped.get(key)??[];
    group.push(item);
    grouped.set(key,group);
  }
  return [...grouped.values()].map(stack=>{
    const item=stack[0];
    const languages=[...new Set(stack.map(copy=>copy.language??copy.card.language??'EN'))];
    const conditions=[...new Set(stack.map(copy=>copy.condition||'NM'))];
    const printLabels=[...new Set(stack.map(copy=>`${copy.language??copy.card.language??'EN'} · ${copy.variant??'Standard'}`))];
    return {
      item,
      items:stack,
      quantity:stack.reduce((sum,copy)=>sum+(copy.type==='RAW'?copy.quantity:1),0),
      estimatedValue:stack.reduce((sum,copy)=>sum+copy.estimatedValue,0),
      languageLabel:languages.length>1?'MULTI':languages[0],
      conditionLabel:conditions.length>1?'MIXED':conditions[0],
      printingLabel:printLabels.length>1?`${printLabels.length} printings`:printLabels[0]??'Standard',
    };
  });
}

export function calculateVaultStats(items: EnrichedCollectionItem[]): VaultStats {
  const totalCards = items.reduce((sum, item) => sum + (item.type === 'RAW' ? item.quantity : 1), 0);
  const uniqueIdentities = new Set(items.map(item => item.card.code)).size;
  const slabsCount = items.filter(item => item.type === 'GRADED').length;
  const rawCount = items.filter(item => item.type === 'RAW').length;

  const totalAcquisitionCost = items.reduce((sum, item) => sum + (item.acquisitionAmount || 0), 0);
  const estimatedValue = items.reduce((sum, item) => sum + item.estimatedValue, 0);

  const pricedItems=items.filter(item=>item.hasMarketEstimate);
  const valuedAcquisitionCost=pricedItems.reduce((sum,item)=>sum+(item.acquisitionAmount||0),0);
  const unrealizedChangeAmount = pricedItems.filter(item=>(item.acquisitionAmount||0)>0).reduce((sum,item)=>sum+item.gainLossAmount,0);
  const unrealizedChangePercent = valuedAcquisitionCost > 0 ? (unrealizedChangeAmount / valuedAcquisitionCost) * 100 : null;
  const indexedItems=pricedItems.filter(item=>item.marketPreviousValue!==null);
  const priorIndexValue=indexedItems.reduce((sum,item)=>sum+(item.marketPreviousValue||0),0);
  const currentIndexValue=indexedItems.reduce((sum,item)=>sum+item.estimatedValue,0);
  const change30DayPercent=priorIndexValue>0?(currentIndexValue-priorIndexValue)/priorIndexValue*100:null;
  const observationCount = [...new Map(pricedItems.map(item=>[item.printingId,item.marketObservationsCount])).values()].reduce((sum,count)=>sum+count,0);
  const lastUpdated=pricedItems.map(item=>item.marketObservedAt).filter((value):value is string=>Boolean(value)).sort().at(-1)??null;

  return {
    totalCards,
    uniqueIdentities,
    slabsCount,
    rawCount,
    totalAcquisitionCost,
    estimatedValue,
    valuedAcquisitionCost,
    unrealizedChangeAmount,
    unrealizedChangePercent,
    change30DayPercent,
    change30DayCount:new Set(indexedItems.map(item=>item.printingId)).size,
    marketPricedCount:new Set(pricedItems.map(item=>item.printingId)).size,
    observationCount,
    lastUpdated,
  };
}

export function calculateSetProgressList(items: EnrichedCollectionItem[]): SetProgress[] {
  const ownedCodesBySet: Record<string, Set<string>> = {};
  const ownedParallelsBySet: Record<string, Set<string>> = {};

  items.forEach(item => {
    const setCode = item.setCode || item.card.setCode;
    if (!setCode) return;
    if (!ownedCodesBySet[setCode]) ownedCodesBySet[setCode] = new Set();
    ownedCodesBySet[setCode].add(item.card.code);

    const printing = printings.find(p => p.id === item.printingId);
    if (/parallel|manga|alt/i.test(item.variant || item.card.variant || printing?.variant || '')) {
      if (!ownedParallelsBySet[setCode]) ownedParallelsBySet[setCode] = new Set();
      ownedParallelsBySet[setCode].add(item.card.code);
    }
  });

  return SETS_CATALOG.map(set => {
    const ownedCodes = ownedCodesBySet[set.code] || new Set();
    const ownedParallels = ownedParallelsBySet[set.code] || new Set();

    const mainSetOwned = ownedCodes.size;
    const parallelsOwned = ownedParallels.size;
    const totalOwned = mainSetOwned;
    const percentage = Math.min(100, Number(((totalOwned / set.mainCount) * 100).toFixed(1)));

    return {
      code: set.code,
      name: set.name,
      releaseYear: set.releaseYear,
      totalCards: set.mainCount,
      ownedCount: totalOwned,
      percentage,
      mainSetOwned,
      mainSetTotal: set.mainCount,
      parallelsOwned,
      parallelsTotal: set.parallelCount,
      isComplete: percentage >= 100,
    };
  });
}
