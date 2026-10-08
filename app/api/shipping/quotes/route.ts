import {enabledShippingCouriers} from '@/lib/shipping/couriers';
import {db,errorResponse,guard,HttpError,optionalUser} from '@/lib/server/store';
import {biteshipDestination,isBiteshipAreaId} from '@/lib/shipping/biteship-area';
import {shippingRateOptions} from '@/lib/server/shipping-quote-cache';

type QuoteRequest={listingId?:unknown;listingIds?:unknown;lines?:unknown;destinationPostalCode?:unknown;destinationAreaId?:unknown;items?:unknown;cacheOnly?:unknown;refresh?:unknown};
export async function POST(request:Request){
  try{
    guard(request);
    const body=await request.json() as QuoteRequest;
    const listingId=typeof body.listingId==='string'?body.listingId:'';
    let destinationPostalCode=typeof body.destinationPostalCode==='string'?body.destinationPostalCode.trim():'';
    let destinationAreaId=typeof body.destinationAreaId==='string'?body.destinationAreaId.trim():'';
    let destinationLatitude:number|null=null;let destinationLongitude:number|null=null;
    if(!listingId)throw new HttpError(400,'Choose a listing.');
    const buyer=await optionalUser();
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
    const ids=lines.map(line=>typeof line.listingId==='string'?line.listingId:'');if(ids.some(id=>!id)||new Set(ids).size!==ids.length)throw new HttpError(400,'Choose valid listings.');
    const result=await db().prepare(`SELECT l.id,l.seller_id AS sellerId,l.title,l.amount,l.quantity,l.items AS itemsJson,l.printing_id AS printingId,l.status,o.area_id AS originAreaId,o.postal_code AS originPostalCode,o.label AS originLabel,o.latitude AS originLatitude,o.longitude AS originLongitude FROM listings l JOIN seller_shipping_origins o ON o.owner_id=l.seller_id WHERE l.id IN (${ids.map(()=>'?').join(',')}) AND l.status='ACTIVE'`).bind(...ids).all<{id:string;sellerId:string;title:string;amount:number;quantity:number;itemsJson:string|null;printingId:string;status:string;originAreaId:string|null;originPostalCode:string;originLabel:string|null;originLatitude:number|null;originLongitude:number|null}>();
    if(result.results.length!==ids.length)throw new HttpError(404,'One or more listings are unavailable.');
    const sellerId=result.results[0].sellerId;if(result.results.some(row=>row.sellerId!==sellerId))throw new HttpError(400,'A cart can only include listings from one seller.');
    const row=result.results[0];const selectedItems:{printingId:string;quantity:number;unitAmount:number}[]=[];let combinedTitle='';
    for(const line of lines){const id=line.listingId as string;const listingRow=result.results.find(item=>item.id===id)!;let listedItems:{printingId:string;quantity:number;unitAmount:number}[];try{const parsed=listingRow.itemsJson?JSON.parse(listingRow.itemsJson) as {printingId?:string;quantity?:number;unitAmount?:number}[]:[];const valid=parsed.map(item=>({printingId:String(item.printingId||''),quantity:Number(item.quantity)||0,unitAmount:Number(item.unitAmount)||0})).filter(item=>item.printingId&&item.quantity>0);const total=valid.reduce((sum,item)=>sum+item.quantity,0)||listingRow.quantity;const fallback=Math.max(1,Math.floor(listingRow.amount/Math.max(1,total)));listedItems=valid.length?valid.map(item=>({...item,unitAmount:item.unitAmount>0?item.unitAmount:fallback})):[{printingId:listingRow.printingId,quantity:listingRow.quantity,unitAmount:Math.max(1,Math.round(listingRow.amount/listingRow.quantity))}]}catch{listedItems=[{printingId:listingRow.printingId,quantity:listingRow.quantity,unitAmount:Math.round(listingRow.amount/listingRow.quantity)}]}
      const requested=Array.isArray(line.items)?line.items as {printingId?:unknown;quantity?:unknown}[]:[];if(!requested.length)throw new HttpError(400,'Choose at least one card per listing.');const quantities=new Map<string,number>();for(const item of requested){const printingId=typeof item.printingId==='string'?item.printingId:'';const quantity=Number(item.quantity);if(!printingId||!Number.isInteger(quantity)||quantity<1)throw new HttpError(400,'Choose a valid card quantity.');quantities.set(printingId,(quantities.get(printingId)??0)+quantity)}for(const [printingId,quantity] of quantities){const matches=listedItems.filter(item=>item.printingId===printingId);const available=matches.reduce((total,item)=>total+item.quantity,0);if(!available||quantity>available)throw new HttpError(400,'The requested cards exceed a listing.');selectedItems.push({printingId,quantity,unitAmount:matches[0].unitAmount})}combinedTitle+=(combinedTitle?', ':'')+listingRow.title;
    }
    const totalQuantity=selectedItems.reduce((total,item)=>total+item.quantity,0);
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
    if(finalCouriers.length===0)return Response.json({pricing:[],couriers:[],destinationRequired:false});

    if(!destinationPostalCode&&!destinationAreaId){
      return Response.json({pricing:[],couriers:finalCouriers,destinationRequired:true});
    }

    const origin=biteshipDestination(row.originPostalCode,row.originAreaId);
    const destination=biteshipDestination(destinationPostalCode,destinationAreaId);
    if(!origin.areaId&&!origin.postalCode)throw new HttpError(400,'The seller needs a valid 5-digit pickup postal code.');
    if(!destination.areaId&&!destination.postalCode)throw new HttpError(400,'Choose a delivery area with a valid 5-digit postal code.');
    const packageItems=[{name:combinedTitle,value:declaredValue,length:18,width:13,height:2,weight:Math.max(100,totalQuantity*100),quantity:1}];
    const quote=await shippingRateOptions(buyer?.id??null,ids.sort().join(','),{couriers:finalCouriers,origin,destination,originLatitude:row.originLatitude,originLongitude:row.originLongitude,destinationLatitude,destinationLongitude,items:packageItems,cacheOnly:body.cacheOnly===true,refresh:body.refresh===true&&body.cacheOnly!==true});
    return Response.json({...quote,couriers:finalCouriers},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
