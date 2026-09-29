/** Sets withheld from player-facing tools until their catalog import and rules audit are complete. */
export const DEFERRED_SET_CODES=new Set(['OP19','OP-19','EB06','EB-06']);
export const PREVIEW_SET_CODES=new Set(['OP18','OP-18','EB05','EB-05']);
export type PlayQueue='ranked'|'casual'|'new-cards'|'extended';
export const PREVIEW_CARD_CODES=new Set([
  'P-163',
]);

export function isPlayableSet(setCode:string|undefined|null){
 return !DEFERRED_SET_CODES.has((setCode??'').trim().toUpperCase());
}

export function isPreviewCard(code?:string|null,setCode?:string|null,variant?:string|null):boolean{
 const normCode=(code??'').trim().toUpperCase();
 const normSet=(setCode??'').trim().toUpperCase();
 return (
   PREVIEW_SET_CODES.has(normSet) ||
   normCode.startsWith('OP18-') ||
   normCode.startsWith('EB05-') ||
   PREVIEW_CARD_CODES.has(normCode) ||
   variant==='Preview'
 );
}

/** Preview cards are intentionally available only in non-Ranked queues until their release data is finalized. */
export function isCardEligible(code:string|undefined|null,setCode:string|undefined|null,queue:PlayQueue='ranked'){
 const normalizedCode=(code??'').trim().toUpperCase();
 if(PREVIEW_CARD_CODES.has(normalizedCode))return queue==='casual'||queue==='new-cards'||queue==='extended';
 return isPlayableSet(setCode);
}
