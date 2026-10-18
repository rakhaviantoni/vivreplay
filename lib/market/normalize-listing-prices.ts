export type PricedListingItem={quantity:number;unitAmount?:number|null;[key:string]:unknown};

/** Fills legacy bundle rows that predate per-item prices from the saved listing total. */
export function normalizeListingItemPrices<T extends PricedListingItem>(items:T[],listingAmount:number):T[]{
  const valid=items.filter(item=>Number.isInteger(item.quantity)&&item.quantity>0);
  const knownTotal=valid.reduce((sum,item)=>sum+(Number.isSafeInteger(item.unitAmount)&&Number(item.unitAmount)>0?Number(item.unitAmount)*item.quantity:0),0);
  const missing=valid.filter(item=>!Number.isSafeInteger(item.unitAmount)||Number(item.unitAmount)<=0);
  const missingCopies=missing.reduce((sum,item)=>sum+item.quantity,0);
  if(listingAmount<=knownTotal||missingCopies===0)return valid;
  let remaining=listingAmount-knownTotal;
  let copiesLeft=missingCopies;
  return valid.map(item=>{
    if(Number.isSafeInteger(item.unitAmount)&&Number(item.unitAmount)>0)return item;
    const unitAmount=copiesLeft>0?Math.floor(remaining/copiesLeft):0;
    remaining-=unitAmount*item.quantity;
    copiesLeft-=item.quantity;
    return {...item,unitAmount};
  });
}
