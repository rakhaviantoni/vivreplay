import {z} from 'zod';
import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {computeOfferExpiration,isOfferExpired,offerContext,parseOfferItems,priceOfferItems,validateListingOfferItems} from '@/lib/server/market-offers';
import {sendMarketEmail} from '@/lib/server/market-notifications';

const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('accept')}),
  z.object({action:z.literal('decline')}),
  z.object({action:z.literal('counter'),amount:z.number().int().positive(),currency:z.string().length(3).optional(),items:z.array(z.object({printingId:z.string().min(1),quantity:z.number().int().positive().max(99),unitAmount:z.number().int().positive().optional()})).min(1).max(30).optional()}),
]);

export async function POST(request:Request,{params}:{params:Promise<{offerId:string}>}){
  try{
    guard(request);const actor=await user();const {offerId}=await params;const offer=await offerContext(offerId,actor.id);const value=schema.parse(await request.json());
    if(actor.id===offer.actorId)throw new HttpError(403,'You can respond only to the other person’s offer.');
    if(offer.status!=='PENDING')throw new HttpError(409,'This offer has already been answered.');
    if(isOfferExpired(offer.expiresAt)||offer.listingStatus!=='ACTIVE'||(offer.listingExpiresAt&&new Date(`${offer.listingExpiresAt.replace(' ','T')}Z`).getTime()<=Date.now())){
      await db().prepare("UPDATE listing_offers SET status='EXPIRED' WHERE id=? AND status='PENDING'").bind(offerId).run();
      throw new HttpError(409,'This offer has expired.');
    }
    let items:ReturnType<typeof parseOfferItems>|undefined;let currency=offer.currency;
    if(value.action==='counter'||value.action==='accept'){
      if(value.action==='counter'&&value.items?.every(item=>Number.isSafeInteger(item.unitAmount)&&Number(item.unitAmount)>0)){
        const pricedTotal=value.items.reduce((sum,item)=>sum+item.quantity*Number(item.unitAmount),0);
        if(pricedTotal!==value.amount)throw new HttpError(400,'Counteroffer card prices must add up to the counteroffer total.');
        items=value.items as Array<{printingId:string;quantity:number;unitAmount:number}>;
      }else items=value.action==='counter'?priceOfferItems(value.items??parseOfferItems(offer.items),value.amount):parseOfferItems(offer.items);
      const supplierId=offer.listingType==='WTB'&&actor.id===offer.sellerId?offer.actorId:actor.id;
      await validateListingOfferItems(offer,supplierId,items);
    }
    if(value.action==='counter'){
      if(offer.listingType==='WTS'&&!offer.negotiable)throw new HttpError(409,'The seller set a firm price. Counteroffers are closed for this listing.');
      currency=value.currency??offer.currency;if(currency!==offer.currency)throw new HttpError(400,'Counteroffers must use the listing currency.');
      const sent=await db().prepare("SELECT COUNT(*) AS total FROM listing_offers WHERE COALESCE(thread_id,id)=? AND actor_id=? AND parent_offer_id IS NOT NULL").bind(offer.threadId,actor.id).first<{total:number}>();
      if((sent?.total??0)>=3)throw new HttpError(409,'You have reached the three-counteroffer limit for this conversation.');
    }
    const nowStatus=value.action==='accept'?'ACCEPTED':value.action==='decline'?'DECLINED':'COUNTERED';
    const update=db().prepare(`UPDATE listing_offers SET status=? WHERE id=? AND status='PENDING'
      AND (expires_at IS NULL OR datetime(expires_at)>CURRENT_TIMESTAMP)
      AND EXISTS(SELECT 1 FROM listings l WHERE l.id=listing_offers.listing_id AND l.status='ACTIVE' AND (l.expires_at IS NULL OR datetime(l.expires_at)>CURRENT_TIMESTAMP))`).bind(nowStatus,offerId);
    if(value.action==='counter'){
      const nextId=crypto.randomUUID();
      const results=await db().batch([
        update,
        db().prepare("INSERT INTO listing_offers (id,listing_id,actor_id,type,items,amount,currency,status,thread_id,parent_offer_id,expires_at) SELECT ?,?,?,?,?,?,?, 'PENDING',?,?,? WHERE changes()=1").bind(nextId,offer.listingId,actor.id,offer.type,JSON.stringify(items),value.amount,currency,offer.threadId,offerId,computeOfferExpiration(offer.listingExpiresAt)),
        db().prepare("INSERT INTO listing_offer_messages (id,thread_id,offer_id,actor_id,kind,body) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM listing_offers WHERE id=?)").bind(crypto.randomUUID(),offer.threadId,nextId,actor.id,'OFFER_COUNTERED',null,nextId),
      ]);
      if(!results[0]?.meta.changes)throw new HttpError(409,'This offer has already been answered.');
      await sendMarketEmail(offer.actorId,'counteroffer',offer.listingTitle,nextId);
      return Response.json({status:'COUNTERED',offerId:nextId},{headers:{'Cache-Control':'private, no-store'}});
    }
    const results=await db().batch([
      update,
      db().prepare("INSERT INTO listing_offer_messages (id,thread_id,offer_id,actor_id,kind,body) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),offer.threadId,offerId,actor.id,`OFFER_${value.action.toUpperCase()}`,null),
    ]);
    if(!results[0]?.meta.changes)throw new HttpError(409,'This offer has already been answered.');
    if(value.action==='accept'||value.action==='decline')await sendMarketEmail(offer.actorId,value.action==='accept'?'accepted':'declined',offer.listingTitle,offer.threadId);
    return Response.json({status:nowStatus},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
