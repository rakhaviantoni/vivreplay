import {z} from 'zod';
import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {offerContext,parseOfferItems,validateListingOfferItems} from '@/lib/server/market-offers';

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
    if(value.action!=='decline'&&(offer.listingStatus!=='ACTIVE'||(offer.expiresAt&&new Date(`${offer.expiresAt.replace(' ','T')}Z`).getTime()<=Date.now())))throw new HttpError(409,'This listing is no longer available.');
    let items:ReturnType<typeof parseOfferItems>|undefined;let currency=offer.currency;
    if(value.action==='counter'||value.action==='accept'){
      items=value.action==='counter'?(value.items??parseOfferItems(offer.items)):parseOfferItems(offer.items);
      const supplierId=offer.listingType==='WTB'&&actor.id===offer.sellerId?offer.actorId:actor.id;
      await validateListingOfferItems(offer,supplierId,items);
    }
    if(value.action==='counter'){
      currency=value.currency??offer.currency;if(currency!==offer.currency)throw new HttpError(400,'Counteroffers must use the listing currency.');
    }
    const nowStatus=value.action==='accept'?'ACCEPTED':value.action==='decline'?'DECLINED':'COUNTERED';
    const update=db().prepare("UPDATE listing_offers SET status=? WHERE id=? AND status='PENDING'").bind(nowStatus,offerId);
    if(value.action==='counter'){
      const nextId=crypto.randomUUID();
      const results=await db().batch([
        update,
        db().prepare("INSERT INTO listing_offers (id,listing_id,actor_id,type,items,amount,currency,status,thread_id,parent_offer_id) SELECT ?,?,?,?,?,?,?, 'PENDING',?,? WHERE changes()=1").bind(nextId,offer.listingId,actor.id,offer.type,JSON.stringify(items),value.amount,currency,offer.threadId,offerId),
        db().prepare("INSERT INTO listing_offer_messages (id,thread_id,offer_id,actor_id,kind,body) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM listing_offers WHERE id=?)").bind(crypto.randomUUID(),offer.threadId,nextId,actor.id,'OFFER_COUNTERED',null,nextId),
      ]);
      if(!results[0]?.meta.changes)throw new HttpError(409,'This offer has already been answered.');
      return Response.json({status:'COUNTERED',offerId:nextId},{headers:{'Cache-Control':'private, no-store'}});
    }
    const results=await db().batch([
      update,
      db().prepare("INSERT INTO listing_offer_messages (id,thread_id,offer_id,actor_id,kind,body) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),offer.threadId,offerId,actor.id,`OFFER_${value.action.toUpperCase()}`,null),
    ]);
    if(!results[0]?.meta.changes)throw new HttpError(409,'This offer has already been answered.');
    return Response.json({status:nowStatus},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
