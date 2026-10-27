export const productConditions=['SEALED','SEALED_DAMAGED','NEW','LIKE_NEW','USED_GOOD','USED_FAIR'] as const;
export type ProductCondition=typeof productConditions[number];

const labels:Record<ProductCondition,[string,string]>={
  SEALED:['Factory sealed','Segel pabrik'],
  SEALED_DAMAGED:['Seal intact, packaging damaged','Segel utuh, kemasan rusak'],
  NEW:['New, unused','Baru, belum dipakai'],
  LIKE_NEW:['Like new','Seperti baru'],
  USED_GOOD:['Used, good condition','Bekas, kondisi baik'],
  USED_FAIR:['Used, visible wear','Bekas, ada tanda pemakaian'],
};
export const isAccessoryKind=(kind:string|undefined)=>['SLEEVE','PLAYMAT','STORAGE','BINDER','OTHER'].includes(kind??'');
export const productConditionOptions=(kind:string|undefined):readonly ProductCondition[]=>isAccessoryKind(kind)?productConditions:['SEALED','SEALED_DAMAGED'];
export const productConditionLabel=(condition:string|undefined,locale:string='EN')=>labels[condition as ProductCondition]?.[locale==='ID'?1:0]??condition??'';
export const validProductCondition=(kind:string|undefined,condition:string|undefined)=>productConditionOptions(kind).some(value=>value===condition);
