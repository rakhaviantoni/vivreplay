export type MarketOrderInventoryLine={instanceId?:string;quantity:number};

export function sellerVaultDebits(items:MarketOrderInventoryLine[]):Map<string,number>{
  const debits=new Map<string,number>();
  for(const item of items){
    if(item.instanceId&&Number.isInteger(item.quantity)&&item.quantity>0){
      debits.set(item.instanceId,(debits.get(item.instanceId)??0)+item.quantity);
    }
  }
  return debits;
}
