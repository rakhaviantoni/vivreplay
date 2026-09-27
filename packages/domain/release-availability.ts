/** Sets withheld from player-facing tools until their catalog import and rules audit are complete. */
export const DEFERRED_SET_CODES=new Set(['OP18','OP-18','EB05','EB-05']);
export type PlayQueue='ranked'|'casual'|'new-cards'|'extended';
export const PREVIEW_CARD_CODES=new Set(['P-163']);

export function isPlayableSet(setCode:string|undefined|null){
 return !DEFERRED_SET_CODES.has((setCode??'').trim().toUpperCase());
}

/** Preview cards are intentionally available only in non-Ranked queues until their release data is finalized. */
export function isCardEligible(code:string|undefined|null,setCode:string|undefined|null,queue:PlayQueue='ranked'){
 const normalizedCode=(code??'').trim().toUpperCase();
 if(PREVIEW_CARD_CODES.has(normalizedCode))return queue==='casual'||queue==='new-cards'||queue==='extended';
 return isPlayableSet(setCode);
}
