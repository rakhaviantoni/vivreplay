import {after} from 'next/server';
import {notifyListingWatchers} from '@/lib/server/market-watch-alerts';
import {user,db,errorResponse,guard,HttpError} from '@/lib/server/store';
import {getDynamicListingPolicy,computeListingExpiration} from '@/lib/market/policy';
import {z} from 'zod';
import {MARKET_MAX_COPIES_PER_CARD,MARKET_ABSOLUTE_MAX_LISTING_COPIES} from '@/lib/market/listing-limits';
import {enforceMarketListingLimits} from '@/lib/server/market-listing-limits';

const addItemsSchema=z.object({action:z.literal('add-items'),items:z.array(z.object({instanceId:z.string().uuid(),printingId:z.string().min(1),quantity:z.number().int().min(1).max(MARKET_MAX_COPIES_PER_CARD),unitAmount:z.number().int().min(1).max(100000000000)})).min(1).max(MARKET_ABSOLUTE_MAX_LISTING_COPIES)});

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    guard(req);
    const p=await user();
    const {id}=await params;

    const result=await db().prepare(
      "UPDATE listings SET status='CLOSED' WHERE id=? AND seller_id=? AND status!='SOLD'"
    ).bind(id,p.id).run();

    if(!result.meta.changes){
      throw new HttpError(404,'Listing not found, already sold, or you do not have permission to close it.');
    }

    return Response.json({ok:true,id,status:'CLOSED'});
  }catch(e){
    return errorResponse(e);
  }
}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    guard(req);
    const p=await user();
    const {id}=await params;
    const body=await req.json() as {action?:unknown;amount?:unknown;prices?:unknown;title?:unknown;negotiable?:unknown};
    if(body.action==='reorder-items'){
      const input=z.object({action:z.literal('reorder-items'),order:z.array(z.number().int().min(0).max(MARKET_ABSOLUTE_MAX_LISTING_COPIES-1)).min(2).max(MARKET_ABSOLUTE_MAX_LISTING_COPIES)}).parse(body);
      const d=db();
      const listing=await d.prepare("SELECT items FROM listings WHERE id=? AND seller_id=? AND type='WTS' AND status IN ('ACTIVE','PAUSED')").bind(id,p.id).first<{items:string|null}>();
      if(!listing)throw new HttpError(404,'Listing not found or unavailable to edit.');
      let entries:Array<Record<string,unknown>>=[];
      try{const parsed=JSON.parse(listing.items||'[]') as unknown;if(Array.isArray(parsed))entries=parsed as Array<Record<string,unknown>>}catch{}
      if(entries.length!==input.order.length||new Set(input.order).size!==entries.length||input.order.some(index=>index>=entries.length))throw new HttpError(409,'The listing cards changed. Refresh and try again.');
      const openCheckout=await d.prepare(`SELECT 1 AS found FROM checkout_orders o,json_each(o.items) j WHERE (json_extract(j.value,'$.listingId')=? OR (json_extract(j.value,'$.listingId') IS NULL AND o.listing_id=?)) AND o.status IN ('PENDING_PAYMENT','PROCESSING') AND (o.expires_at IS NULL OR o.expires_at>CURRENT_TIMESTAMP) LIMIT 1`).bind(id,id).first<{found:number}>();
      if(openCheckout)throw new HttpError(409,'Cards cannot be reordered while a buyer is checking out. Try again after checkout closes.');
      const reordered=JSON.stringify(input.order.map(index=>entries[index]));
      const changed=await d.prepare(`UPDATE listings SET items=? WHERE id=? AND seller_id=? AND type='WTS' AND status IN ('ACTIVE','PAUSED') AND (items=? OR (items IS NULL AND ? IS NULL))
        AND NOT EXISTS(SELECT 1 FROM checkout_orders o,json_each(o.items) j WHERE (json_extract(j.value,'$.listingId')=? OR (json_extract(j.value,'$.listingId') IS NULL AND o.listing_id=?)) AND o.status IN ('PENDING_PAYMENT','PROCESSING') AND (o.expires_at IS NULL OR o.expires_at>CURRENT_TIMESTAMP))`).bind(reordered,id,p.id,listing.items,listing.items,id,id).run();
      if(!changed.meta.changes)throw new HttpError(409,'The listing changed. Refresh and try again.');
      after(()=>notifyListingWatchers(id));
      return Response.json({ok:true,id});
    }
    if(body.action==='add-items'){
      const input=addItemsSchema.parse(body);
      const d=db();
      const listing=await d.prepare("SELECT id,instance_id AS instanceId,printing_id AS printingId,amount,quantity,condition,items,status FROM listings WHERE id=? AND seller_id=? AND type='WTS' AND status IN ('ACTIVE','PAUSED')").bind(id,p.id).first<{id:string;instanceId:string|null;printingId:string;amount:number;quantity:number;condition:string;items:string|null;status:string}>();
      if(!listing)throw new HttpError(404,'Listing not found or unavailable to edit.');
      const openCheckout=await d.prepare(`SELECT 1 AS found FROM checkout_orders o,json_each(o.items) j WHERE (json_extract(j.value,'$.listingId')=? OR (json_extract(j.value,'$.listingId') IS NULL AND o.listing_id=?)) AND o.status IN ('PENDING_PAYMENT','PROCESSING') AND (o.expires_at IS NULL OR o.expires_at>CURRENT_TIMESTAMP) LIMIT 1`).bind(id,id).first<{found:number}>();
      if(openCheckout)throw new HttpError(409,'Cards cannot be added while a buyer is checking out. Try again after that checkout closes.');
      let entries:Array<{instanceId?:string;printingId:string;quantity:number;condition?:string;unitAmount:number}> = [];
      try{const parsed=listing.items?JSON.parse(listing.items) as unknown:[];if(Array.isArray(parsed))entries=parsed.filter((entry):entry is {instanceId?:string;printingId:string;quantity:number;condition?:string;unitAmount:number}=>Boolean(entry&&typeof entry==='object'&&typeof entry.printingId==='string'&&Number.isInteger(entry.quantity)&&entry.quantity>0));}catch{}
      if(!entries.length)entries=[{instanceId:listing.instanceId??undefined,printingId:listing.printingId,quantity:listing.quantity,condition:listing.condition,unitAmount:Math.max(1,Math.round(listing.amount/listing.quantity))}];
      const addedByInstance=new Map<string,{printingId:string;quantity:number;condition:string;unitAmount:number}>();
      for(const item of input.items){
        const owned=await d.prepare("SELECT printing_id AS printingId,quantity,condition,type FROM collectible_instances WHERE id=? AND owner_id=? AND deleted_at IS NULL").bind(item.instanceId,p.id).first<{printingId:string;quantity:number;condition:string;type:string}>();
        if(!owned||owned.type!=='RAW'||owned.printingId!==item.printingId)throw new HttpError(400,'Choose an available card from your Vault.');
        const matching=entries.find(entry=>entry.printingId===item.printingId&&entry.condition===owned.condition);
        const unitAmount=matching?.unitAmount??item.unitAmount;
        const prior=addedByInstance.get(item.instanceId);
        addedByInstance.set(item.instanceId,{printingId:item.printingId,quantity:(prior?.quantity??0)+item.quantity,condition:owned.condition,unitAmount});
      }
      for(const [instanceId,addition] of addedByInstance){
        const existing=entries.find(entry=>entry.instanceId===instanceId);
        if(existing){
          if(existing.printingId!==addition.printingId||existing.condition!==addition.condition)throw new HttpError(400,'This Vault item does not match the listing entry.');
          existing.quantity+=addition.quantity;
        }else entries.push({instanceId,printingId:addition.printingId,quantity:addition.quantity,condition:addition.condition,unitAmount:addition.unitAmount});
      }
      const policy=await getDynamicListingPolicy(p.tier,d,p.pro_billing_period);
      await enforceMarketListingLimits(d,entries,policy);
      const quantity=entries.reduce((sum,entry)=>sum+entry.quantity,0);
      const amount=entries.reduce((sum,entry)=>sum+entry.quantity*entry.unitAmount,0);
      if(quantity>policy.maxListingCopies)throw new HttpError(400,`A listing can include up to ${policy.maxListingCopies} cards.`);
      if(!Number.isSafeInteger(amount)||amount<1||amount>100000000000)throw new HttpError(400,'The listing total is over the price limit.');
      const itemsJson=JSON.stringify(entries);
      const changed=await d.prepare(`UPDATE listings SET items=?,quantity=?,amount=?
        WHERE id=? AND seller_id=? AND type='WTS' AND status IN ('ACTIVE','PAUSED') AND quantity=? AND amount=? AND (items=? OR (items IS NULL AND ? IS NULL))
          AND NOT EXISTS(SELECT 1 FROM checkout_orders o,json_each(o.items) j WHERE (json_extract(j.value,'$.listingId')=? OR (json_extract(j.value,'$.listingId') IS NULL AND o.listing_id=?)) AND o.status IN ('PENDING_PAYMENT','PROCESSING') AND (o.expires_at IS NULL OR o.expires_at>CURRENT_TIMESTAMP))
          AND NOT EXISTS(
            SELECT 1 FROM (SELECT json_extract(value,'$.instanceId') AS instanceId,SUM(CAST(json_extract(value,'$.quantity') AS INTEGER)) AS quantity FROM json_each(?) GROUP BY json_extract(value,'$.instanceId')) requested
            LEFT JOIN collectible_instances owned ON owned.id=requested.instanceId AND owned.owner_id=? AND owned.deleted_at IS NULL
            WHERE owned.id IS NULL OR requested.quantity > owned.quantity
              - COALESCE((SELECT SUM(CASE WHEN l.items IS NULL THEN l.quantity ELSE 0 END) FROM listings l WHERE l.seller_id=? AND l.instance_id=requested.instanceId AND l.id<>? AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0)
              - COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM listings l,json_each(l.items) entry WHERE l.seller_id=? AND json_extract(entry.value,'$.instanceId')=requested.instanceId AND l.id<>? AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0)
              - COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM checkout_orders o,json_each(o.items) entry WHERE json_extract(entry.value,'$.instanceId')=requested.instanceId AND o.kind='MARKET' AND (o.status='PROCESSING' OR (o.status='PENDING_PAYMENT' AND o.expires_at>CURRENT_TIMESTAMP))),0)
          )`).bind(itemsJson,quantity,amount,id,p.id,listing.quantity,listing.amount,listing.items,listing.items,id,id,itemsJson,p.id,p.id,id,p.id,id).run();
      if(!changed.meta.changes)throw new HttpError(409,'The listing or available Vault quantity changed. Refresh and try again.');
      after(()=>notifyListingWatchers(id));
      return Response.json({ok:true,id,amount,quantity,items:entries});
    }
    if(body.action==='terms'){
      if(typeof body.negotiable!=='boolean')throw new HttpError(400,'Choose valid price terms.');
      const d=db();
      const listing=await d.prepare("SELECT negotiable FROM listings WHERE id=? AND seller_id=? AND type='WTS' AND status IN ('ACTIVE','PAUSED')").bind(id,p.id).first<{negotiable:number}>();
      if(!listing)throw new HttpError(404,'Listing not found or unavailable to edit.');
      const changed=await d.prepare(`UPDATE listings SET negotiable=? WHERE id=? AND seller_id=? AND type='WTS' AND negotiable=? AND status IN ('ACTIVE','PAUSED')
        AND NOT EXISTS(SELECT 1 FROM checkout_orders o,json_each(o.items) j WHERE (json_extract(j.value,'$.listingId')=? OR (json_extract(j.value,'$.listingId') IS NULL AND o.listing_id=?)) AND o.status IN ('PENDING_PAYMENT','PROCESSING') AND (o.expires_at IS NULL OR o.expires_at>CURRENT_TIMESTAMP))`).bind(Number(body.negotiable),id,p.id,listing.negotiable,id,id).run();
      if(!changed.meta.changes)throw new HttpError(409,'An active checkout is using this listing. Try again after it closes.');
      return Response.json({ok:true,id,negotiable:body.negotiable});
    }
    if(body.action==='details'){
      const d=db();
      const listing=await d.prepare("SELECT id,title,amount,quantity,type,status,items,negotiable FROM listings WHERE id=? AND seller_id=? AND status IN ('ACTIVE','PAUSED')").bind(id,p.id).first<{id:string;title:string;amount:number;quantity:number;type:string;status:string;items:string|null;negotiable:number}>();
      if(!listing)throw new HttpError(404,'Listing not found or unavailable to edit.');
      if(typeof body.title!=='string')throw new HttpError(400,'Enter a listing title.');
      const title=body.title.trim();
      if(title.length<3||title.length>100)throw new HttpError(400,'Title must be 3–100 characters.');
      if(body.negotiable!==undefined&&typeof body.negotiable!=='boolean')throw new HttpError(400,'Choose valid price terms.');
      let entries:Array<Record<string,unknown>>=[];
      try{const parsed=JSON.parse(listing.items||'[]') as unknown;if(Array.isArray(parsed))entries=parsed as Array<Record<string,unknown>>}catch{}
      const prices=body.prices;
      let amount=listing.amount;
      let items=listing.items;
      if(prices!==undefined){
        if(!Array.isArray(prices)||prices.some(value=>!Number.isSafeInteger(value)||Number(value)<1||Number(value)>100000000000))throw new HttpError(400,'Enter a valid unit price for every card.');
        if(entries.length){
          if(prices.length!==entries.length)throw new HttpError(400,'Enter a valid unit price for every card.');
          amount=entries.reduce((sum,entry,index)=>sum+Number(entry.quantity)*Number(prices[index]),0);
          items=JSON.stringify(entries.map((entry,index)=>({...entry,unitAmount:prices[index]})));
        }else{
          if(prices.length!==1)throw new HttpError(400,'Enter a valid price for this listing.');
          amount=Number(prices[0])*listing.quantity;
        }
      }
      if(!Number.isSafeInteger(amount)||amount<1||amount>100000000000)throw new HttpError(400,'The listing price is too large.');
      const negotiable=listing.type==='WTS'?(body.negotiable===undefined?listing.negotiable:Number(body.negotiable)):listing.negotiable;
      const changed=await d.prepare(`UPDATE listings SET title=?,amount=?,items=?,negotiable=?
        WHERE id=? AND seller_id=? AND title=? AND amount=? AND negotiable=? AND status IN ('ACTIVE','PAUSED')
        AND NOT EXISTS(SELECT 1 FROM checkout_orders o,json_each(o.items) j
          WHERE (json_extract(j.value,'$.listingId')=? OR (json_extract(j.value,'$.listingId') IS NULL AND o.listing_id=?))
          AND o.status IN ('PENDING_PAYMENT','PROCESSING') AND (o.expires_at IS NULL OR o.expires_at>CURRENT_TIMESTAMP))`).bind(title,amount,items,negotiable,id,p.id,listing.title,listing.amount,listing.negotiable,id,id).run();
      if(!changed.meta.changes)throw new HttpError(409,'An active checkout is using this listing. Try again after it closes.');
      if(amount!==listing.amount)after(()=>notifyListingWatchers(id,amount<listing.amount));
      return Response.json({ok:true,id,title,amount,negotiable:Boolean(negotiable),prices:Array.isArray(prices)?prices:[]});
    }
    if(body.action==='price'){
      const d=db();const listing=await d.prepare("SELECT amount,quantity,items FROM listings WHERE id=? AND seller_id=? AND type='WTS' AND status IN ('ACTIVE','PAUSED')").bind(id,p.id).first<{amount:number;quantity:number;items:string|null}>();if(!listing)throw new HttpError(404,'Listing not found.');
      let entries:Array<Record<string,unknown>>=[];try{entries=JSON.parse(listing.items||'[]')}catch{};
      let amount:number;let items:string|null=listing.items;
      if(Array.isArray(body.prices)&&entries.length){const prices=body.prices;if(prices.length!==entries.length||prices.some(v=>!Number.isSafeInteger(v)||Number(v)<1||Number(v)>100000000000))throw new HttpError(400,'Enter a valid unit price for every card.');amount=entries.reduce((sum,e,i)=>sum+Number(e.quantity)*Number(prices[i]),0);items=JSON.stringify(entries.map((e,i)=>({...e,unitAmount:prices[i]})));}
      else{if(entries.length>1)throw new HttpError(400,'Set a unit price for every card.');if(!Number.isSafeInteger(body.amount)||Number(body.amount)<1)throw new HttpError(400,'Enter a valid listing price.');amount=Number(body.amount);if(amount%listing.quantity!==0)throw new HttpError(400,'The total must divide evenly across card copies.');if(entries.length)items=JSON.stringify(entries.map(e=>({...e,unitAmount:amount/listing.quantity})));}
      if(!Number.isSafeInteger(amount)||amount>100000000000)throw new HttpError(400,'The listing price is too large.');
      const changed=await d.prepare("UPDATE listings SET amount=?,items=? WHERE id=? AND seller_id=? AND amount=? AND type='WTS' AND status IN ('ACTIVE','PAUSED') AND NOT EXISTS(SELECT 1 FROM checkout_orders o,json_each(o.items) j WHERE (json_extract(j.value,'$.listingId')=? OR (json_extract(j.value,'$.listingId') IS NULL AND o.listing_id=?)) AND o.status IN ('PENDING_PAYMENT','PROCESSING') AND (o.expires_at IS NULL OR o.expires_at>CURRENT_TIMESTAMP))").bind(amount,items,id,p.id,listing.amount,id,id).run();if(!changed.meta.changes)throw new HttpError(409,'The listing changed or an active checkout reserves its price. Refresh and try again.');
      after(()=>notifyListingWatchers(id,amount<listing.amount));return Response.json({ok:true,amount});
    }
    if(body.action!=='pause'&&body.action!=='resume')throw new HttpError(400,'Choose pause or resume.');
    const d=db();
    const listing=await d.prepare('SELECT id,status,expires_at,printing_id AS printingId,instance_id AS instanceId,sealed_product_id AS sealedProductId,quantity,items FROM listings WHERE id=? AND seller_id=?').bind(id,p.id).first<{id:string;status:string;expires_at:string|null;printingId:string|null;instanceId:string|null;sealedProductId:string|null;quantity:number;items:string|null}>();
    if(!listing)throw new HttpError(404,'Listing not found or you do not have permission to manage it.');
    if(body.action==='pause'){
      if(listing.status!=='ACTIVE')throw new HttpError(400,'Only active listings can be paused.');
      const changed=await d.prepare("UPDATE listings SET status='PAUSED' WHERE id=? AND seller_id=? AND status='ACTIVE'").bind(id,p.id).run();
      if(!changed.meta.changes)throw new HttpError(409,'This listing changed before it could be paused. Refresh and try again.');
      return Response.json({ok:true,id,status:'PAUSED'});
    }
    if(listing.status!=='PAUSED'&&listing.status!=='CLOSED')throw new HttpError(400,'Only paused or closed listings can be resumed.');
    const policy=await getDynamicListingPolicy(p.tier,d,p.pro_billing_period);
    const activeCount=await d.prepare("SELECT COUNT(*) AS total FROM listings WHERE seller_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) AND id<>?").bind(p.id,id).first<{total:number}>();
    if((activeCount?.total??0)>=policy.maxActiveListings)throw new HttpError(400,`You have reached the limit of ${policy.maxActiveListings} active listings for your account.`);
    const entries=listing.items?JSON.parse(listing.items) as {instanceId?:string;printingId?:string;quantity?:number;sealedProductId?:string}[]:[];
    const cardEntries=entries.filter((entry):entry is {instanceId?:string;printingId:string;quantity:number;sealedProductId?:string}=>!entry.sealedProductId&&typeof entry.printingId==='string'&&Number.isInteger(entry.quantity));
    if(cardEntries.length)await enforceMarketListingLimits(d,cardEntries,policy);
    else if(!listing.sealedProductId&&listing.quantity>policy.maxCopiesPerCard)throw new HttpError(400,`A listing can include up to ${policy.maxCopiesPerCard} copy of this card.`);
    const needed=new Map<string,number>();
    for(const entry of cardEntries){if(entry.instanceId&&entry.quantity)needed.set(entry.instanceId,(needed.get(entry.instanceId)??0)+entry.quantity)}
    if(!needed.size&&listing.instanceId)needed.set(listing.instanceId,listing.quantity);
    for(const [instanceId,quantity] of needed){
      const owned=await d.prepare('SELECT quantity FROM collectible_instances WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(instanceId,p.id).first<{quantity:number}>();
      if(!owned||quantity>owned.quantity)throw new HttpError(409,'The Vault no longer has enough copies to resume this listing.');
      const reserved=await d.prepare(`SELECT
        COALESCE((SELECT SUM(CASE WHEN items IS NULL THEN quantity ELSE 0 END) FROM listings WHERE instance_id=? AND status='ACTIVE' AND id!=? AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)),0)
        + COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM listings l,json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=? AND l.status='ACTIVE' AND l.id!=? AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0)
        + COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM checkout_orders o,json_each(o.items) entry WHERE json_extract(entry.value,'$.instanceId')=? AND o.kind='MARKET' AND (o.status='PROCESSING' OR (o.status='PENDING_PAYMENT' AND o.expires_at>CURRENT_TIMESTAMP))),0) AS quantity`).bind(instanceId,id,instanceId,id,instanceId).first<{quantity:number}>();
      if(quantity+(reserved?.quantity??0)>owned.quantity)throw new HttpError(409,'Some copies are already reserved by another active listing.');
    }
    const expiresAt=listing.expires_at&&new Date(`${listing.expires_at.replace(' ','T')}Z`).getTime()>Date.now()?listing.expires_at:computeListingExpiration(policy.durationDays);
    const requested=JSON.stringify([...needed].map(([instanceId,quantity])=>({instanceId,quantity})));
    const changed=await d.prepare(`UPDATE listings SET status='ACTIVE',expires_at=?
      WHERE id=? AND seller_id=? AND status IN ('PAUSED','CLOSED')
      AND NOT EXISTS(
        SELECT 1 FROM json_each(?) requested
        WHERE CAST(json_extract(requested.value,'$.quantity') AS INTEGER) >
          COALESCE((SELECT c.quantity FROM collectible_instances c
            WHERE c.id=json_extract(requested.value,'$.instanceId') AND c.owner_id=? AND c.deleted_at IS NULL),0)
          - COALESCE((SELECT SUM(CASE WHEN l.items IS NULL THEN l.quantity ELSE 0 END)
            FROM listings l WHERE l.seller_id=? AND l.instance_id=json_extract(requested.value,'$.instanceId')
              AND l.status='ACTIVE' AND l.id!=? AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0)
          - COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER))
            FROM listings l,json_each(l.items) entry
            WHERE l.seller_id=? AND json_extract(entry.value,'$.instanceId')=json_extract(requested.value,'$.instanceId')
              AND l.status='ACTIVE' AND l.id!=? AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0)
          - COALESCE((SELECT SUM(CAST(json_extract(order_item.value,'$.quantity') AS INTEGER))
            FROM checkout_orders o,json_each(o.items) order_item
            WHERE (json_extract(order_item.value,'$.instanceId')=json_extract(requested.value,'$.instanceId')
              OR (json_extract(order_item.value,'$.instanceId') IS NULL AND (json_extract(order_item.value,'$.listingId')=?
                OR (json_extract(order_item.value,'$.listingId') IS NULL AND o.listing_id=?))))
              AND o.kind='MARKET' AND (o.status='PROCESSING' OR (o.status='PENDING_PAYMENT' AND o.expires_at>CURRENT_TIMESTAMP))),0)
      )`).bind(expiresAt,id,p.id,requested,p.id,p.id,id,p.id,id,id,id).run();
    if(!changed.meta.changes)throw new HttpError(409,'Some copies are no longer available to resume this listing. Refresh and try again.');
    after(()=>notifyListingWatchers(id));
    return Response.json({ok:true,id,status:'ACTIVE',expiresAt});
  }catch(error){return errorResponse(error)}
}
