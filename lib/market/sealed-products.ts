import products from '@/packages/card-data/one-piece-products.json';
import accessories from '@/packages/card-data/one-piece-accessories.json';
import type {Card} from '@/packages/card-data/catalog';

export type SealedProductKind='BOOSTER_PACK'|'BOOSTER_BOX'|'STARTER_DECK'|'DOUBLE_PACK'|'MINI_TIN'|'SLEEVE'|'PLAYMAT'|'STORAGE'|'BINDER'|'CARD_COLLECTION'|'PREMIUM_COLLECTION'|'OTHER';
export type SealedProduct={id:string;name:string;displayName?:string;kind:SealedProductKind;setCode:string;language:string;edition:'global'|'asia';imageUrl:string;sourceUrl:string;releaseDate?:string;design?:string;contents?:string};
export const sealedProductKinds:Record<SealedProductKind,string>={BOOSTER_PACK:'Booster pack',BOOSTER_BOX:'Booster box',STARTER_DECK:'Starter deck',DOUBLE_PACK:'Double pack',MINI_TIN:'Mini tin',SLEEVE:'Card sleeves',PLAYMAT:'Playmat',STORAGE:'Storage',BINDER:'Binder',CARD_COLLECTION:'Card collection',PREMIUM_COLLECTION:'Premium collection',OTHER:'Other products'};
export const normalizeSealedProductQuery=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const matchesSealedProductQuery=(text:string,query:string)=>{const normalizedText=normalizeSealedProductQuery(text);const normalizedQuery=normalizeSealedProductQuery(query);return !normalizedQuery||normalizedText.includes(normalizedQuery)||normalizedText.replace(/\s/g,'').includes(normalizedQuery.replace(/\s/g,''));};
export const sealedProductDisplayName=(product:Pick<SealedProduct,'name'|'displayName'>)=>product.displayName??product.name;
export const sealedProductPublicCode=(product:Pick<SealedProduct,'setCode'>)=>/^(?:OP|ST|EB|PRB|DP|TS|SPC|TC|AC|IB)\d+(?:-EB\d+)?$/i.test(product.setCode)?product.setCode:'';
const setProducts:SealedProduct[]=products.flatMap(product=>{
  const edition=product.edition as SealedProduct['edition'];
  const language='EN' as const;
  const title=product.title.replace(/\s*[−｜|].*$/,'').replace(/\s*\[[^\]]+\]/g,'').replace(/^(?:BOOSTER PACK|EXTRA BOOSTER|PREMIUM BOOSTER|STARTER DECK EX|STARTER DECK|ULTIMATE DECK)\s*-?\s*/i,'').replace(/-\s*$/,'').trim();
  const images=product.images as {pack?:string;box?:string};
  const kinds:Array<[SealedProduct['kind'],string|undefined]>=product.kind==='deck'?[['STARTER_DECK',images.pack]]:[['BOOSTER_PACK',images.pack],['BOOSTER_BOX',images.box]];
  const releaseDate=Date.parse(product.facts?.['Release Date']??'');
  return kinds.flatMap(([kind,imageUrl])=>imageUrl?[{id:`sealed:${product.edition}:${product.code}:${kind}`,name:`${title||product.code} ${sealedProductKinds[kind]}`,displayName:title||product.code,kind,setCode:product.code,language,edition,imageUrl,sourceUrl:product.sourceUrl,releaseDate:Number.isFinite(releaseDate)?new Date(releaseDate).toISOString().slice(0,10):undefined} as SealedProduct]:[]);
});
export const sealedProducts:SealedProduct[]=[...setProducts,...accessories.map(product=>({...product,name:[product.name,product.design].filter(Boolean).join(' '),setCode:product.code,kind:product.kind as SealedProductKind,edition:product.edition as SealedProduct['edition'],language:product.language as SealedProduct['language']}))].sort((a,b)=>(b.releaseDate??'').localeCompare(a.releaseDate??'')||a.name.localeCompare(b.name));
const byId=new Map(sealedProducts.map(product=>[product.id,product]));
export const sealedProductById=(id:string|null|undefined)=>id?byId.get(id):undefined;
export function sealedDisplayCard(id:string):Card|undefined{
  const product=sealedProductById(id);
  return product?{id:product.id,code:sealedProductPublicCode(product),name:product.name,color:'',type:'Character',cost:0,power:0,rarity:'',art:0,effect:'',imageUrl:product.imageUrl,imageSource:'external',setCode:sealedProductPublicCode(product),language:product.language,variant:sealedProductKinds[product.kind],sealedProduct:product}:undefined;
}

export type Parcel={weight:number;length:number;width:number;height:number};
export function marketParcel(items:Array<{quantity:number;parcel?:Parcel}>):Parcel{
  return items.reduce((parcel,item)=>({weight:parcel.weight+(item.parcel?.weight??100)*item.quantity,length:Math.max(parcel.length,item.parcel?.length??18),width:Math.max(parcel.width,item.parcel?.width??13),height:parcel.height+(item.parcel?.height??2)*item.quantity}),{weight:0,length:0,width:0,height:0});
}
