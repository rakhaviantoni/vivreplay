import {db,errorResponse,HttpError} from '@/lib/server/store';

type QuoteRequest={listingId?:unknown;destinationPostalCode?:unknown;destinationAreaId?:unknown};
export async function POST(request:Request){
  try{
    const key=process.env.BITESHIP_API_KEY;
    if(!key)throw new HttpError(503,'Shipping quotes are not configured yet.');
    const body=await request.json() as QuoteRequest;
    const listingId=typeof body.listingId==='string'?body.listingId:'';
    const destinationPostalCode=typeof body.destinationPostalCode==='string'?body.destinationPostalCode.trim():'';
    const destinationAreaId=typeof body.destinationAreaId==='string'?body.destinationAreaId.trim():'';
    if(!listingId||(!destinationPostalCode&&!destinationAreaId))throw new HttpError(400,'Choose a listing and enter a destination postcode or area.');
    const row=await db().prepare(`SELECT l.title,l.amount,l.quantity,o.area_id AS originAreaId,o.postal_code AS originPostalCode FROM listings l JOIN seller_shipping_origins o ON o.owner_id=l.seller_id WHERE l.id=? AND l.status='ACTIVE'`).bind(listingId).first<{title:string;amount:number;quantity:number;originAreaId:string|null;originPostalCode:string}>();
    if(!row)throw new HttpError(404,'This listing does not have a shipping origin yet.');
    const payload={origin_area_id:row.originAreaId||undefined,origin_postal_code:row.originAreaId?undefined:Number(row.originPostalCode),destination_area_id:destinationAreaId||undefined,destination_postal_code:destinationAreaId?undefined:Number(destinationPostalCode),couriers:'jne,jnt,sicepat,anteraja,tiki',items:[{name:row.title,value:row.amount*row.quantity,length:18,width:13,height:2,weight:100,quantity:row.quantity}]};
    const response=await fetch('https://api.biteship.com/v1/rates/couriers',{method:'POST',headers:{authorization:key,'content-type':'application/json'},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>null) as {pricing?:unknown;error?:{message?:string};message?:string}|null;
    if(!response.ok)throw new HttpError(response.status,data?.error?.message??data?.message??'Shipping quotes could not be loaded.');
    return Response.json({pricing:data?.pricing??[]});
  }catch(error){return errorResponse(error)}
}
