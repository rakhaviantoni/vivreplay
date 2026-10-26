import {enabledShippingCouriers} from '@/lib/shipping/couriers';
import {db,errorResponse,guard,HttpError,optionalUser} from '@/lib/server/store';
import {biteshipDestination,isBiteshipAreaId} from '@/lib/shipping/biteship-area';
import {shippingRateOptions} from '@/lib/server/shipping-quote-cache';
import {marketParcel} from '@/lib/market/sealed-products';

type QuoteRequest={listingId?:unknown;offerId?:unknown;listingIds?:unknown;lines?:unknown;destinationPostalCode?:unknown;destinationAreaId?:unknown;items?:unknown;cacheOnly?:unknown;refresh?:unknown;estimateForWantedListing?:unknown};
export async function POST(request:Request){
  try{
    guard(request);
    const body=await request.json() as QuoteRequest;
    const listingId=typeof body.listingId==='string'?body.listingId:'';
    const estimateForWantedListing=body.estimateForWantedListing===true;
    let destinationPostalCode=typeof body.destinationPostalCode==='string'?body.destinationPostalCode.trim():'';
    let destinationAreaId=typeof body.destinationAreaId==='string'?body.destinationAreaId.trim():'';
    let destinationLatitude:number|null=null;let destinationLongitude:number|null=null;
    if(!listingId)throw new HttpError(400,'Choose a listing.');
    const buyer=await optionalUser();
    if(estimateForWantedListing&&!buyer)throw new HttpError(401,'Sign in and add a shipping address to estimate delivery.');
    let acceptedSealedOffer:{supplierId:string;items:string}|null=null;
    if(typeof body.offerId==='string'&&body.offerId){
      if(!buyer)throw new HttpError(401,'Sign in to check delivery for this offer.');
      acceptedSealedOffer=await db().prepare(`SELECT (SELECT first.actor_id FROM listing_offers first WHERE COALESCE(first.thread_id,first.id)=COALESCE(current.thread_id,current.id) ORDER BY first.created_at,first.rowid LIMIT 1) AS supplierId,current.items
        FROM listing_offers current JOIN listings listing ON listing.id=current.listing_id
        WHERE current.id=? AND current.listing_id=? AND current.status='ACCEPTED' AND listing.type='WTB' AND listing.sealed_product_id IS NOT NULL AND listing.seller_id=?`).bind(body.offerId,listingId,buyer.id).first<{supplierId:string;items:string}>();
      if(!acceptedSealedOffer)throw new HttpError(409,'This accepted offer is no longer available for delivery quotes.');
    }
    if(buyer){
      const address=await db().prepare('SELECT postal_code AS postalCode,area_id AS areaId,latitude,longitude FROM seller_shipping_origins WHERE owner_id=?').bind(buyer.id).first<{postalCode:string|null;areaId:string|null;latitude:number|null;longitude:number|null}>();
      const usesSavedAddress=(!destinationPostalCode&&!destinationAreaId)||(destinationPostalCode===address?.postalCode&&(!destinationAreaId||destinationAreaId===address?.areaId));
      if(!destinationPostalCode&&!destinationAreaId){
        destinationPostalCode=address?.postalCode??'';
        destinationAreaId=isBiteshipAreaId(address?.areaId)?address.areaId:'';
      }
      if(usesSavedAddress){destinationLatitude=address?.latitude??null;destinationLongitude=address?.longitude??null;}
    }
    const lines=Array.isArray(body.lines)?body.lines as {listingId?:unknown;items?:unknown}[]:[{listingId,items:body.items}];
    if(lines.length<1||lines.length>10)throw new HttpError(400,'Choose up to 10 listings from one seller.');
    if(estimateForWantedListing&&lines.length!==1)throw new HttpError(400,'Choose one buying request to estimate delivery.');
    const ids=lines.map(line=>typeof line.listingId==='string'?line.listingId:'');if(ids.some(id=>!id)||new Set(ids).size!==ids.length)throw new HttpError(400,'Choose valid listings.');
    if(acceptedSealedOffer&&lines.length!==1)throw new HttpError(400,'Choose one accepted product offer.');
    const originJoin=acceptedSealedOffer?'JOIN seller_shipping_origins o ON o.owner_id=?':estimateForWantedListing?'LEFT JOIN seller_shipping_origins o ON o.owner_id=?':'JOIN seller_shipping_origins o ON o.owner_id=l.seller_id';
    const bindings=acceptedSealedOffer?[acceptedSealedOffer.supplierId,...ids]:estimateForWantedListing?[buyer!.id,...ids]:ids;
    const result=await db().prepare(`SELECT l.id,l.seller_id AS sellerId,l.type,l.title,l.amount,l.quantity,l.items AS itemsJson,COALESCE(l.printing_id,l.sealed_product_id) AS printingId,l.status,o.area_id AS originAreaId,o.postal_code AS originPostalCode,o.label AS originLabel,o.latitude AS originLatitude,o.longitude AS originLongitude FROM listings l ${originJoin} WHERE l.id IN (${ids.map(()=>'?').join(',')}) AND l.status='ACTIVE'`).bind(...bindings).all<{id:string;sellerId:string;type:string;title:string;amount:number;quantity:number;itemsJson:string|null;printingId:string;status:string;originAreaId:string|null;originPostalCode:string|null;originLabel:string|null;originLatitude:number|null;originLongitude:number|null}>();
    if(result.results.length!==ids.length)throw new HttpError(404,'One or more listings are unavailable.');
    const sellerId=result.results[0].sellerId;if(result.results.some(row=>row.sellerId!==sellerId))throw new HttpError(400,'A cart can only include listings from one seller.');
    const row=result.results[0];const selectedItems:{printingId:string;quantity:number;unitAmount:number;sealedProductId?:string;parcel?:{weight:number;length:number;width:number;height:number}}[]=[];let combinedTitle='';
    if(estimateForWantedListing&&(row.type!=='WTB'||row.sellerId===buyer?.id))throw new HttpError(400,'Delivery estimates are available to sellers viewing a buying request.');
    if(acceptedSealedOffer&&(row.type!=='WTB'||row.sellerId!==buyer?.id))throw new HttpError(409,'This buying request is no longer available.');
    for(const line of lines){
      const id=line.listingId as string;
      const listingRow=result.results.find(item=>item.id===id)!;
      type ListedItem={printingId:string;quantity:number;unitAmount:number;sealedProductId?:string;parcel?:{weight:number;length:number;width:number;height:number}};
      let listedItems:ListedItem[];
      try{
        const parsed=listingRow.itemsJson?JSON.parse(listingRow.itemsJson) as Array<Partial<ListedItem>>:[];
        const valid=parsed.map(item=>({printingId:String(item.printingId||''),quantity:Number(item.quantity)||0,unitAmount:Number(item.unitAmount)||0,sealedProductId:item.sealedProductId,parcel:item.parcel})).filter(item=>item.printingId&&item.quantity>0);
        const total=valid.reduce((sum,item)=>sum+item.quantity,0)||listingRow.quantity;
        const fallback=Math.max(1,Math.floor(listingRow.amount/Math.max(1,total)));
        listedItems=valid.length?valid.map(item=>({...item,unitAmount:item.unitAmount>0?item.unitAmount:fallback})):[{printingId:listingRow.printingId,quantity:listingRow.quantity,unitAmount:Math.max(1,Math.round(listingRow.amount/listingRow.quantity))}];
      }catch{listedItems=[{printingId:listingRow.printingId,quantity:listingRow.quantity,unitAmount:Math.round(listingRow.amount/listingRow.quantity)}]}
      const requested=Array.isArray(line.items)?line.items as {printingId?:unknown;quantity?:unknown}[]:[];
      if(!requested.length)throw new HttpError(400,'Choose at least one item per listing.');
      if(acceptedSealedOffer){
        let offered:Array<{printingId:string;quantity:number;unitAmount:number;sealedProductId?:string;parcel?:{weight:number;length:number;width:number;height:number}}> = [];
        try{const parsed=JSON.parse(acceptedSealedOffer.items) as Array<Record<string,unknown>>;offered=parsed.filter(item=>typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&Number(item.quantity)>0&&Number.isSafeInteger(item.unitAmount)&&Number(item.unitAmount)>0).map(item=>({printingId:String(item.printingId),quantity:Number(item.quantity),unitAmount:Number(item.unitAmount),sealedProductId:typeof item.sealedProductId==='string'?item.sealedProductId:undefined,parcel:item.parcel as {weight:number;length:number;width:number;height:number}|undefined}));}catch{}
        const requestedCounts=new Map<string,number>();for(const item of requested){if(typeof item.printingId!=='string'||!Number.isInteger(item.quantity)||Number(item.quantity)<1)throw new HttpError(400,'Choose a valid item quantity.');requestedCounts.set(item.printingId,(requestedCounts.get(item.printingId)??0)+Number(item.quantity));}
        const offeredCounts=new Map<string,number>();for(const item of offered)offeredCounts.set(item.printingId,(offeredCounts.get(item.printingId)??0)+item.quantity);
        if(JSON.stringify([...requestedCounts].sort(([a],[b])=>a.localeCompare(b)))!==JSON.stringify([...offeredCounts].sort(([a],[b])=>a.localeCompare(b)))||offered.some(item=>item.sealedProductId!==item.printingId||!item.parcel))throw new HttpError(409,'The accepted product details are incomplete. Ask the seller to update the offer.');
        selectedItems.push(...offered);combinedTitle+=listingRow.title;continue;
      }
      const quantities=new Map<string,number>();
      for(const item of requested){const printingId=typeof item.printingId==='string'?item.printingId:'';const quantity=Number(item.quantity);if(!printingId||!Number.isInteger(quantity)||quantity<1)throw new HttpError(400,'Choose a valid item quantity.');quantities.set(printingId,(quantities.get(printingId)??0)+quantity)}
      for(const [printingId,quantity] of quantities){const matches=listedItems.filter(item=>item.printingId===printingId);const available=matches.reduce((total,item)=>total+item.quantity,0);if(!available||quantity>available)throw new HttpError(400,'The requested items exceed a listing.');selectedItems.push({printingId,quantity,unitAmount:matches[0].unitAmount,sealedProductId:matches[0].sealedProductId,parcel:matches[0].parcel})}
      combinedTitle+=(combinedTitle?', ':'')+listingRow.title;
    }
    const declaredValue=selectedItems.reduce((total,item)=>total+item.quantity*item.unitAmount,0);

    let methods: string[] = [];
    if(row.originLabel && row.originLabel.startsWith('{')){
      try{
        const parsed = JSON.parse(row.originLabel);
        if(Array.isArray(parsed.methods)){
          methods = parsed.methods;
        }
      }catch{}
    }

    const finalCouriers=enabledShippingCouriers(methods);
    if(estimateForWantedListing&&!row.originAreaId&&!row.originPostalCode)throw new HttpError(400,'Add a shipping address to your profile before estimating delivery.');
    if(estimateForWantedListing&&finalCouriers.length===0)throw new HttpError(400,'Choose a courier in your profile before estimating delivery.');
    if(finalCouriers.length===0)return Response.json({pricing:[],couriers:[],destinationRequired:false});

    if(!destinationPostalCode&&!destinationAreaId){
      return Response.json({pricing:[],couriers:finalCouriers,destinationRequired:true});
    }

    const origin=biteshipDestination(row.originPostalCode,row.originAreaId);
    const destination=biteshipDestination(destinationPostalCode,destinationAreaId);
    if(!origin.areaId&&!origin.postalCode)throw new HttpError(400,estimateForWantedListing?'Add a shipping address to your profile before estimating delivery.':'The seller needs a valid 5-digit pickup postal code.');
    if(!destination.areaId&&!destination.postalCode)throw new HttpError(400,'Choose a delivery area with a valid 5-digit postal code.');
    const parcel=marketParcel(selectedItems);
    const packageItems=[{name:selectedItems.some(item=>item.sealedProductId)?'Sealed products':combinedTitle,value:declaredValue,length:parcel.length,width:parcel.width,height:parcel.height,weight:Math.max(100,parcel.weight),quantity:1}];
    const quote=await shippingRateOptions(buyer?.id??null,`${ids.sort().join(',')}${acceptedSealedOffer?`:${String(body.offerId)}`:''}`,{couriers:finalCouriers,origin,destination,originLatitude:row.originLatitude,originLongitude:row.originLongitude,destinationLatitude,destinationLongitude,items:packageItems,cacheOnly:body.cacheOnly===true,refresh:body.refresh===true&&body.cacheOnly!==true});
    return Response.json({...quote,couriers:finalCouriers},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
