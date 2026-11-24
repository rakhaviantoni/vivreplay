import {user,db,errorResponse,guard,HttpError} from '@/lib/server/store';
import {getDynamicListingPolicy,computeListingExpiration} from '@/lib/market/policy';
import {listingLimitMessage} from '@/lib/market/listing-limits';
import {enforceMarketListingLimits} from '@/lib/server/market-listing-limits';
import {computeInitialAuctionEndsAtMs,type AuctionDurationMode} from '@/lib/market/auction';
import {ensureAuctionSchema,getAuctionRoomStub} from '@/lib/server/auctions';

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    guard(req);
    const p=await user();
    const {id}=await params;
    const d=db();
    const policy=await getDynamicListingPolicy(p.tier,d,p.pro_billing_period);

    const listing=await d.prepare(
      'SELECT id,seller_id,type,status,created_at AS createdAt,expires_at,instance_id AS instanceId,sealed_product_id AS sealedProductId,quantity,items FROM listings WHERE id=? AND seller_id=?'
    ).bind(id,p.id).first<{id:string;seller_id:string;type:string;status:string;createdAt:string|null;expires_at:string|null;instanceId:string|null;sealedProductId:string|null;quantity:number;items:string|null}>();

    if(!listing){
      throw new HttpError(404,'Listing not found or you are not authorized to renew it.');
    }

    if(listing.status==='SOLD'){
      throw new HttpError(400,'Sold listings cannot be renewed.');
    }

    type AuctionSlotRow={itemKey:string;startingBid:number;buyNowPrice:number|null;minIncrement:number;bidCount:number;durationMode:string;startsAt:string|null;endsAt:string;status:string};
    let auctionSlots:AuctionSlotRow[]=[];
    let hasEndedZeroBidAuction=false;
    if(listing.type==='WTA'){
      await ensureAuctionSchema(d);
      auctionSlots=(await d.prepare(
        `SELECT item_key AS itemKey,starting_bid AS startingBid,buy_now_price AS buyNowPrice,min_increment AS minIncrement,
          bid_count AS bidCount,duration_mode AS durationMode,starts_at AS startsAt,ends_at AS endsAt,status
         FROM market_auctions WHERE listing_id=?`
      ).bind(id).all<AuctionSlotRow>()).results??[];
      const nowMs=Date.now();
      if(auctionSlots.some(slot=>Number(slot.bidCount)>0&&(slot.status!=='ACTIVE'||Date.parse(slot.endsAt)<=nowMs))){
        throw new HttpError(409,'An ended auction with bids cannot be renewed.');
      }
      hasEndedZeroBidAuction=auctionSlots.length>0&&auctionSlots.every(slot=>Number(slot.bidCount)===0&&(slot.status!=='ACTIVE'||Date.parse(slot.endsAt)<=nowMs));
    }

    const currentExpires = listing.expires_at ? new Date(listing.expires_at.includes('T') ? listing.expires_at : `${listing.expires_at.replace(' ', 'T')}Z`).getTime() : 0;
    const msLeft = currentExpires - Date.now();
    const maxEarlyExtendDays = policy.tier === 'pro' ? 5 : 2;
    const maxEarlyRenewMs = maxEarlyExtendDays * 24 * 60 * 60 * 1000;

    if (listing.status === 'ACTIVE' && msLeft > maxEarlyRenewMs && !hasEndedZeroBidAuction) {
      const daysRemaining = Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
      throw new HttpError(400, `Listings can only be extended when nearing expiration (${maxEarlyExtendDays} days or less remaining). This listing currently has ${daysRemaining} days left.`);
    }

    const activeCount=await d.prepare("SELECT COUNT(*) AS total FROM listings WHERE seller_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) AND id<>?").bind(p.id,id).first<{total:number}>();
    if((activeCount?.total??0)>=policy.maxActiveListings)throw new HttpError(400,`You have reached the limit of ${policy.maxActiveListings} active listings for your account.`);

    const entries=listing.items?JSON.parse(listing.items) as {instanceId?:string;printingId?:string;quantity?:number;sealedProductId?:string}[]:[];
    const cardEntries=entries.filter((entry):entry is {instanceId?:string;printingId:string;quantity:number;sealedProductId?:string}=>!entry.sealedProductId&&typeof entry.printingId==='string'&&Number.isInteger(entry.quantity));
    if(cardEntries.length)await enforceMarketListingLimits(d,cardEntries,policy);
    else if(!listing.sealedProductId&&listing.quantity>policy.maxCopiesPerCard)throw new HttpError(400,listingLimitMessage('too-many-copies-of-card','EN',policy));
    const needed=new Map<string,number>();
    for(const entry of cardEntries){if(entry.instanceId&&entry.quantity)needed.set(entry.instanceId,(needed.get(entry.instanceId)??0)+entry.quantity)}
    if(!needed.size&&listing.instanceId)needed.set(listing.instanceId,listing.quantity);
    for(const [instanceId,quantity] of needed){
      const owned=await d.prepare('SELECT quantity FROM collectible_instances WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(instanceId,p.id).first<{quantity:number}>();
      if(!owned||quantity>owned.quantity)throw new HttpError(409,'The Vault no longer has enough copies to renew this listing.');
      const reserved=await d.prepare(`SELECT
        COALESCE((SELECT SUM(CASE WHEN items IS NULL THEN quantity ELSE 0 END) FROM listings WHERE instance_id=? AND status='ACTIVE' AND id!=? AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)),0)
        + COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM listings l,json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=? AND l.status='ACTIVE' AND l.id!=? AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0) AS quantity`).bind(instanceId,id,instanceId,id).first<{quantity:number}>();
      if(quantity+(reserved?.quantity??0)>owned.quantity)throw new HttpError(409,'Some copies are already reserved by another active listing.');
    }

    let finalExpiresAt=computeListingExpiration(policy.durationDays);
    let durationHours:number|undefined;

    if(listing.type==='WTA'&&auctionSlots.length>0){
      const nowMs=Date.now();
      const createdMs=listing.createdAt?Date.parse(listing.createdAt.includes('T')?listing.createdAt:`${listing.createdAt.replace(' ','T')}Z`):NaN;
      const slotEndsAtList:string[]=[];
      for(const slot of auctionSlots){
        if(Number(slot.bidCount)>0){
          slotEndsAtList.push(slot.endsAt);
          continue;
        }
        const mode=(slot.durationMode==='ROLLING_48H'||slot.durationMode==='FIXED'?slot.durationMode:'ROLLING_24H') as AuctionDurationMode;
        let fixedHours:number|undefined;
        if(mode==='FIXED'){
          const prevStartMs=slot.startsAt?Date.parse(slot.startsAt):createdMs;
          const prevEndMs=Date.parse(slot.endsAt);
          if(Number.isFinite(prevStartMs)&&Number.isFinite(prevEndMs)&&prevEndMs>prevStartMs){
            fixedHours=Math.round((prevEndMs-prevStartMs)/(60*60*1000));
          }
        }
        const endsAtMs=computeInitialAuctionEndsAtMs(mode,nowMs,fixedHours);
        const endsAtIso=new Date(endsAtMs).toISOString();
        slotEndsAtList.push(endsAtIso);
        await d.prepare(
          `UPDATE market_auctions
           SET status='ACTIVE', starts_at=NULL, winner_order_id=NULL, ends_at=?, updated_at=CURRENT_TIMESTAMP
           WHERE listing_id=? AND item_key=? AND bid_count=0`
        ).bind(endsAtIso,id,slot.itemKey).run();
        const stub=getAuctionRoomStub(id,slot.itemKey);
        if(stub){
          await stub.fetch('https://auction.internal/init',{
            method:'POST',
            headers:{'content-type':'application/json'},
            body:JSON.stringify({
              listingId:id,
              itemKey:slot.itemKey,
              sellerId:p.id,
              startingBid:Number(slot.startingBid),
              buyNowPrice:slot.buyNowPrice??null,
              minIncrement:Number(slot.minIncrement),
              currentBid:0,
              highestBidderId:null,
              highestBidderName:null,
              bidCount:0,
              durationMode:mode,
              startsAt:null,
              endsAt:endsAtIso,
              endsAtMs,
              status:'ACTIVE',
            }),
          }).catch(()=>undefined);
        }
      }
      const latestEndsAt=slotEndsAtList.sort().at(-1);
      if(latestEndsAt){
        finalExpiresAt=latestEndsAt;
        durationHours=Math.max(1,Math.round((Date.parse(latestEndsAt)-nowMs)/(60*60*1000)));
      }
    }

    await d.prepare(
      "UPDATE listings SET status='ACTIVE', expires_at=? WHERE id=? AND seller_id=?"
    ).bind(finalExpiresAt,id,p.id).run();

    return Response.json({
      ok:true,
      id,
      status:'ACTIVE',
      expiresAt:finalExpiresAt,
      durationDays:durationHours?Math.max(1,Math.round(durationHours/24)):policy.durationDays,
      ...(durationHours?{durationHours}:{}),
      tier:policy.tier,
    });
  }catch(e){
    return errorResponse(e);
  }
}
