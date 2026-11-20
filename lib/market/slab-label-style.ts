export type SlabLabelStyle='clear'|'standard';

/** Reads the EGS label style stored with a Vault slab's subgrades JSON. */
export function slabLabelStyleFromSubgrades(value:string|Record<string,unknown>|null|undefined):SlabLabelStyle{
  try{
    const subgrades=typeof value==='string'?JSON.parse(value) as Record<string,unknown>|null:value;
    return String(subgrades?.__labelStyle??'').toLowerCase()==='clear'?'clear':'standard';
  }catch{return 'standard'}
}

export function normalizeSlabLabelStyle(value:unknown):SlabLabelStyle|undefined{
  return value==='clear'||value==='standard'?value:undefined;
}
