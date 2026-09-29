import {db,errorResponse,HttpError} from '@/lib/server/store';

type QuoteRequest={listingId?:unknown;destinationPostalCode?:unknown;destinationAreaId?:unknown};
export async function POST(request:Request){
  try{
    const body=await request.json() as QuoteRequest;
    const listingId=typeof body.listingId==='string'?body.listingId:'';
    const destinationPostalCode=typeof body.destinationPostalCode==='string'?body.destinationPostalCode.trim():'';
    const destinationAreaId=typeof body.destinationAreaId==='string'?body.destinationAreaId.trim():'';
    if(!listingId)throw new HttpError(400,'Choose a listing.');
    const row=await db().prepare(`SELECT l.title,l.amount,l.quantity,o.area_id AS originAreaId,o.postal_code AS originPostalCode,o.label AS originLabel FROM listings l JOIN seller_shipping_origins o ON o.owner_id=l.seller_id WHERE l.id=? AND l.status='ACTIVE'`).bind(listingId).first<{title:string;amount:number;quantity:number;originAreaId:string|null;originPostalCode:string;originLabel:string|null}>();
    if(!row)throw new HttpError(404,'This listing does not have a shipping origin yet.');

    let methods = ['instant', 'regular'];
    if(row.originLabel && row.originLabel.startsWith('{')){
      try{
        const parsed = JSON.parse(row.originLabel);
        if(Array.isArray(parsed.methods) && parsed.methods.length > 0){
          methods = parsed.methods;
        }
      }catch{}
    }

    const key=process.env.BITESHIP_API_KEY;
    if(!key){
      const fallbackPricing = [];
      if(methods.includes('regular')){
        fallbackPricing.push({courier_name:'jnt',courier_service_name:'J&T EZ',price:0});
      }
      if(methods.includes('instant')){
        fallbackPricing.push(
          {courier_name:'grab_instant',courier_service_name:'Grab Instant',price:0,max_km:40},
          {courier_name:'gojek_instant',courier_service_name:'Gojek Instant',price:0,max_km:40}
        );
      }
      return Response.json({pricing:fallbackPricing});
    }

    if(!destinationPostalCode&&!destinationAreaId)throw new HttpError(400,'Enter a destination postcode or area.');
    const couriersList: string[] = [];
    if(methods.includes('regular')) couriersList.push('jne','jnt','sicepat','anteraja','tiki');
    if(methods.includes('instant')) couriersList.push('grab','gojek');

    const payload={origin_area_id:row.originAreaId||undefined,origin_postal_code:row.originAreaId?undefined:Number(row.originPostalCode),destination_area_id:destinationAreaId||undefined,destination_postal_code:destinationAreaId?undefined:Number(destinationPostalCode),couriers:couriersList.join(','),items:[{name:row.title,value:row.amount*row.quantity,length:18,width:13,height:2,weight:100,quantity:row.quantity}]};
    const response=await fetch('https://api.biteship.com/v1/rates/couriers',{method:'POST',headers:{authorization:key,'content-type':'application/json'},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>null) as {pricing?:unknown;error?:{message?:string};message?:string}|null;
    if(!response.ok)throw new HttpError(response.status,data?.error?.message??data?.message??'Shipping quotes could not be loaded.');
    return Response.json({pricing:data?.pricing??[]});
  }catch(error){return errorResponse(error)}
}
