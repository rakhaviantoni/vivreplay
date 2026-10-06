import {enabledShippingCouriers} from '@/lib/shipping/couriers';
import {db,errorResponse,guard,HttpError,optionalUser} from '@/lib/server/store';
import {biteshipDestination,isBiteshipAreaId} from '@/lib/shipping/biteship-area';
import {shippingRateOptions} from '@/lib/server/shipping-quote-cache';

type QuoteRequest={listingId?:unknown;destinationPostalCode?:unknown;destinationAreaId?:unknown;items?:unknown;cacheOnly?:unknown};
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
    const row=await db().prepare(`SELECT l.title,l.amount,l.quantity,l.items AS itemsJson,l.printing_id AS printingId,o.area_id AS originAreaId,o.postal_code AS originPostalCode,o.label AS originLabel,o.latitude AS originLatitude,o.longitude AS originLongitude FROM listings l JOIN seller_shipping_origins o ON o.owner_id=l.seller_id WHERE l.id=? AND l.status='ACTIVE'`).bind(listingId).first<{title:string;amount:number;quantity:number;itemsJson:string|null;printingId:string;originAreaId:string|null;originPostalCode:string;originLabel:string|null;originLatitude:number|null;originLongitude:number|null}>();
    if(!row)throw new HttpError(404,'This listing does not have a shipping origin yet.');

    let listedItems:{printingId:string;quantity:number;unitAmount:number}[];
    try{
      const parsed=row.itemsJson?JSON.parse(row.itemsJson) as {printingId?:string;quantity?:number;unitAmount?:number}[]:[];
      const valid=parsed.map(item=>({printingId:String(item.printingId||''),quantity:Number(item.quantity)||0,unitAmount:Number(item.unitAmount)||0})).filter(item=>item.printingId&&item.quantity>0);
      const totalQuantity=valid.reduce((sum,item)=>sum+item.quantity,0)||row.quantity;
      const fallbackUnitAmount=Math.max(1,Math.floor(row.amount/Math.max(1,totalQuantity)));
      listedItems=valid.length?valid.map(item=>({...item,unitAmount:item.unitAmount>0?item.unitAmount:fallbackUnitAmount})):[{printingId:row.printingId,quantity:row.quantity,unitAmount:Math.max(1,Math.round(row.amount/row.quantity))}];
    }catch{listedItems=[{printingId:row.printingId,quantity:row.quantity,unitAmount:Math.round(row.amount/row.quantity)}]}
    const requested=Array.isArray(body.items)?body.items as {printingId?:unknown;quantity?:unknown}[]:[];
    let selectedItems=listedItems;
    if(requested.length){
      const quantities=new Map<string,number>();
      for(const item of requested){
        const printingId=typeof item.printingId==='string'?item.printingId:'';
        const quantity=Number(item.quantity);
        if(!printingId||!Number.isInteger(quantity)||quantity<1)throw new HttpError(400,'Choose a valid card quantity.');
        quantities.set(printingId,(quantities.get(printingId)??0)+quantity);
      }
      selectedItems=Array.from(quantities,([printingId,quantity])=>{
        const available=listedItems.filter(item=>item.printingId===printingId).reduce((total,item)=>total+item.quantity,0);
        if(!available||quantity>available)throw new HttpError(400,'The requested cards exceed this listing.');
        const unitAmount=listedItems.find(item=>item.printingId===printingId)?.unitAmount??0;
        return {printingId,quantity,unitAmount};
      });
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
    const packageItems=[{name:row.title,value:declaredValue,length:18,width:13,height:2,weight:Math.max(100,totalQuantity*100),quantity:1}];
    const quote=await shippingRateOptions(buyer?.id??null,listingId,{couriers:finalCouriers,origin,destination,originLatitude:row.originLatitude,originLongitude:row.originLongitude,destinationLatitude,destinationLongitude,items:packageItems,cacheOnly:body.cacheOnly===true});
    return Response.json({...quote,couriers:finalCouriers},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
