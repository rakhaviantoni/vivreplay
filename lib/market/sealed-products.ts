import products from '@/packages/card-data/one-piece-products.json';
import type {Card} from '@/packages/card-data/catalog';

export type SealedProduct={id:string;name:string;kind:'BOOSTER_PACK'|'BOOSTER_BOX'|'STARTER_DECK';setCode:string;language:'EN'|'JP';imageUrl:string;sourceUrl:string};
export const sealedProductKinds={BOOSTER_PACK:'Booster pack',BOOSTER_BOX:'Booster box',STARTER_DECK:'Starter deck'};
export const sealedProducts:SealedProduct[]=products.flatMap(product=>{
  const language=product.edition==='global'?'EN':'JP';
  const title=product.title.replace(/\s*[−｜|].*$/,'').replace(/\s*\[[^\]]+\]/g,'').replace(/^(?:BOOSTER PACK|EXTRA BOOSTER|PREMIUM BOOSTER|STARTER DECK EX|STARTER DECK|ULTIMATE DECK)\s*-?\s*/i,'').replace(/-\s*$/,'').trim();
  const images=product.images as {pack?:string;box?:string};
  const kinds:Array<[SealedProduct['kind'],string|undefined]>=product.kind==='deck'?[['STARTER_DECK',images.pack]]:[['BOOSTER_PACK',images.pack],['BOOSTER_BOX',images.box]];
  return kinds.flatMap(([kind,imageUrl])=>imageUrl?[{id:`sealed:${product.edition}:${product.code}:${kind}`,name:`${title||product.code} ${sealedProductKinds[kind]}`,kind,setCode:product.code,language,imageUrl,sourceUrl:product.sourceUrl} as SealedProduct]:[]);
});
const byId=new Map(sealedProducts.map(product=>[product.id,product]));
export const sealedProductById=(id:string|null|undefined)=>id?byId.get(id):undefined;
export function sealedDisplayCard(id:string):Card|undefined{
  const product=sealedProductById(id);
  return product?{id:product.id,code:product.setCode,name:product.name,color:'',type:'Character',cost:0,power:0,rarity:'',art:0,effect:'',imageUrl:product.imageUrl,imageSource:'external',setCode:product.setCode,language:product.language,variant:sealedProductKinds[product.kind],sealedProduct:product}:undefined;
}

export type Parcel={weight:number;length:number;width:number;height:number};
export function marketParcel(items:Array<{quantity:number;parcel?:Parcel}>):Parcel{
  return items.reduce((parcel,item)=>({weight:parcel.weight+(item.parcel?.weight??100)*item.quantity,length:Math.max(parcel.length,item.parcel?.length??18),width:Math.max(parcel.width,item.parcel?.width??13),height:parcel.height+(item.parcel?.height??2)*item.quantity}),{weight:0,length:0,width:0,height:0});
}
