export function uniquePrintingIds<T extends {id:string;language:string}>(items:T[]):T[]{
  const seen=new Set<string>();
  return items.filter(item=>{
    const id=item.id.trim().toLowerCase();
    if(!id||!item.language||seen.has(id))return false;
    seen.add(id);
    return true;
  });
}

export function matchingPrintingCopies<T extends {printingId:string}>(copies:T[],printingId:string):T[]{
  return printingId?copies.filter(copy=>copy.printingId===printingId):[];
}

export function selectedPrintingCopy<T extends {id:string;printingId:string}>(copies:T[],printingId:string,copyId:string):T|undefined{
  const matching=matchingPrintingCopies(copies,printingId);
  return matching.find(copy=>copy.id===copyId)??matching[0];
}
