import {db,HttpError} from '@/lib/server/store';

export type OfferContext={id:string;threadId:string;parentOfferId:string|null;listingId:string;actorId:string;type:string;items:string;amount:number;currency:string;status:string;sellerId:string;listingStatus:string;listingType:string;quantity:number;printingId:string;listingItems:string|null;expiresAt:string|null;initialActorId:string;buyerId:string;supplierId:string};

export async function offerContext(offerId:string,profileId:string){
  const offer=await db().prepare(`SELECT o.id,COALESCE(o.thread_id,o.id) AS threadId,o.parent_offer_id AS parentOfferId,o.listing_id AS listingId,o.actor_id AS actorId,o.type,o.items,o.amount,o.currency,o.status,l.seller_id AS sellerId,l.status AS listingStatus,l.type AS listingType,l.quantity,l.printing_id AS printingId,l.items AS listingItems,l.expires_at AS expiresAt,(SELECT initial.actor_id FROM listing_offers initial WHERE COALESCE(initial.thread_id,initial.id)=COALESCE(o.thread_id,o.id) ORDER BY initial.created_at,initial.rowid LIMIT 1) AS initialActorId
    FROM listing_offers o JOIN listings l ON l.id=o.listing_id WHERE o.id=?`).bind(offerId).first<OfferContext>();
  if(!offer)throw new HttpError(404,'Offer not found.');
  const participant=offer.sellerId===profileId||Boolean(await db().prepare('SELECT 1 AS ok FROM listing_offers WHERE COALESCE(thread_id,id)=? AND actor_id=? LIMIT 1').bind(offer.threadId,profileId).first());
  if(!participant)throw new HttpError(404,'Offer not found.');
  const buyerId=offer.listingType==='WTB'?offer.sellerId:offer.initialActorId;
  const supplierId=offer.listingType==='WTB'?offer.initialActorId:offer.sellerId;
  return {...offer,buyerId,supplierId};
}

export function parseOfferItems(raw:string){
  try{
    const value=JSON.parse(raw) as unknown;
    if(!Array.isArray(value))return [];
    return value.filter((item):item is {printingId:string;quantity:number;unitAmount?:number}=>Boolean(item&&typeof item==='object'&&typeof (item as {printingId?:unknown}).printingId==='string'&&Number.isInteger((item as {quantity?:unknown}).quantity)&&Number((item as {quantity:number}).quantity)>0));
  }catch{return []}
}

export async function validateListingOfferItems(offer:OfferContext,actorId:string,items:Array<{printingId:string;quantity:number;unitAmount?:number}>){
  if(items.length<1||items.length>30)throw new HttpError(400,'Choose at least one card.');
  if(offer.listingType==='WTS'){
    let available=new Map<string,number>([[offer.printingId,offer.quantity]]);
    try{
      const bundle=JSON.parse(offer.listingItems??'[]') as Array<{printingId?:unknown;quantity?:unknown}>;
      if(bundle.length){available=new Map();for(const item of bundle)if(typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&Number(item.quantity)>0)available.set(item.printingId,(available.get(item.printingId)??0)+Number(item.quantity));}
    }catch{}
    const requested=new Map<string,number>();for(const item of items)requested.set(item.printingId,(requested.get(item.printingId)??0)+item.quantity);
    if([...requested].some(([printingId,count])=>count>(available.get(printingId)??0)))throw new HttpError(400,'A counteroffer can include only the cards available in this listing.');
  }else{
    const supplierId=actorId===offer.sellerId?offer.actorId:actorId;
    for(const item of items){const owned=await db().prepare("SELECT COALESCE(SUM(quantity),0) AS quantity FROM collectible_instances WHERE owner_id=? AND printing_id=? AND deleted_at IS NULL").bind(supplierId,item.printingId).first<{quantity:number}>();if((owned?.quantity??0)<item.quantity)throw new HttpError(400,'The offered cards are no longer available in the supplier’s Vault.');}
  }
}
