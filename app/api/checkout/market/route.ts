import {z} from 'zod';
import {db,errorResponse,guard,user,HttpError} from '@/lib/server/store';
import {getCurrentUser} from '@/lib/server/auth';
import {createAzekhaIntent,hasAzekhaPaymentConfig} from '@/lib/server/azekha-payments';
import {verifyTurnstile} from '@/lib/server/turnstile';
import {biteshipDestination,isBiteshipAreaId} from '@/lib/shipping/biteship-area';

const schema=z.object({listingId:z.string().min(1),items:z.array(z.object({printingId:z.string().min(1),quantity:z.number().int().positive().max(99)})).min(1).max(30),courierName:z.string().min(1),courierServiceName:z.string().min(1)});
type BundleEntry={instanceId?:string;printingId:string;quantity:number;condition?:string;unitAmount:number};
type Rate={courier_name:string;courier_service_name:string;price:number};

export async function GET(){
  const available=process.env.VIVREPLAY_MARKET_CHECKOUT_ENABLED==='true'&&process.env.VIVREPLAY_MARKET_SELLER_OPERATIONS_READY==='true'&&hasAzekhaPaymentConfig()&&Boolean(process.env.BITESHIP_API_KEY?.trim());
  return Response.json({available});
}

export async function POST(request:Request){
  try{
    guard(request);
    const rejected=await verifyTurnstile(request);if(rejected)return rejected;
    if(process.env.VIVREPLAY_MARKET_CHECKOUT_ENABLED!=='true'||process.env.VIVREPLAY_MARKET_SELLER_OPERATIONS_READY!=='true')throw new HttpError(503,'Market checkout is not available yet.');
    if(!hasAzekhaPaymentConfig())throw new HttpError(503,'Online payment is temporarily unavailable.');
    const profile=await user();
    const account=await getCurrentUser();
    if(!account?.email)throw new HttpError(401,'Sign in with an email address to continue.');
    const input=schema.parse(await request.json());
    const database=db();
    const listing=await database.prepare(`SELECT l.id,l.seller_id AS sellerId,l.printing_id AS printingId,l.title,l.amount,l.currency,l.quantity,l.type,l.status,l.items,l.expires_at AS expiresAt,o.area_id AS originAreaId,o.postal_code AS originPostalCode,o.label AS originLabel FROM listings l JOIN seller_shipping_origins o ON o.owner_id=l.seller_id WHERE l.id=?`).bind(input.listingId).first<{id:string;sellerId:string;printingId:string;title:string;amount:number;currency:string;quantity:number;type:string;status:string;items:string|null;expiresAt:string|null;originAreaId:string|null;originPostalCode:string;originLabel:string|null}>();
    if(!listing||listing.status!=='ACTIVE'||(listing.expiresAt&&new Date(`${listing.expiresAt.replace(' ','T')}Z`).getTime()<=Date.now()))throw new HttpError(404,'This listing is no longer available.');
    if(listing.type!=='WTS')throw new HttpError(400,'Only cards listed for sale can be checked out.');
    if(listing.sellerId===profile.id)throw new HttpError(403,'You cannot purchase from your own listing.');
    if(listing.currency!=='IDR')throw new HttpError(400,'Checkout currently supports IDR listings only.');

    const address=await database.prepare('SELECT recipient_name AS recipientName,phone,address_line AS addressLine,city,postal_code AS postalCode,area_id AS areaId,label FROM seller_shipping_origins WHERE owner_id=?').bind(profile.id).first<{recipientName:string|null;phone:string|null;addressLine:string;city:string;postalCode:string;areaId:string|null;label:string|null}>();
    if(!address?.addressLine||!address.city||!address.phone||(!/^\d{5}$/.test(address.postalCode)&&!isBiteshipAreaId(address.areaId)))throw new HttpError(400,'Save a delivery address, valid postal code or delivery area, and mobile number in your profile before checkout.');
    let addressDetail='';
    try{const metadata=JSON.parse(address.label??'{}') as {addressDetail?:unknown};if(typeof metadata.addressDetail==='string')addressDetail=metadata.addressDetail.trim().slice(0,180)}catch{}
    const seller=await database.prepare('SELECT area_id AS areaId,postal_code AS postalCode,label FROM seller_shipping_origins WHERE owner_id=?').bind(listing.sellerId).first<{areaId:string|null;postalCode:string;label:string|null}>();
    if(!seller)throw new HttpError(400,'The seller has not set a shipping address.');
    let sellerMethods:string[]=[];
    try{const parsed=JSON.parse(seller.label??'{}');if(Array.isArray(parsed.methods))sellerMethods=parsed.methods.filter((item:unknown):item is string=>typeof item==='string')}catch{}
    const regular=['jnt','jne','sicepat','anteraja','tiki','pos','lion','ninja','wahana'];
    const instant=['grab','gojek'];
    const couriers=[...new Set(sellerMethods.flatMap(method=>method==='regular'?regular:method==='instant'?instant:[...regular,...instant].includes(method)?[method]:[]))];
    if(!couriers.length)throw new HttpError(400,'The seller has not enabled a delivery method.');

    let bundle:BundleEntry[];
    try{
      const parsed=listing.items?JSON.parse(listing.items) as BundleEntry[]:[];
      const valid=parsed.filter(item=>typeof item.printingId==='string'&&item.printingId&&Number.isInteger(item.quantity)&&item.quantity>0);
      const totalQuantity=valid.reduce((sum,item)=>sum+item.quantity,0)||listing.quantity;
      const fallbackUnitAmount=Math.max(1,Math.floor(listing.amount/Math.max(1,totalQuantity)));
      bundle=valid.length?valid.map(item=>({...item,unitAmount:Number.isSafeInteger(item.unitAmount)&&item.unitAmount>0?item.unitAmount:fallbackUnitAmount})): [{instanceId:undefined,printingId:listing.printingId,quantity:listing.quantity,unitAmount:Math.max(1,Math.round(listing.amount/listing.quantity))}];
    }catch{bundle=[{printingId:listing.printingId,quantity:listing.quantity,unitAmount:Math.round(listing.amount/listing.quantity)}]}
    const wanted=new Map<string,number>();
    for(const item of input.items)wanted.set(item.printingId,(wanted.get(item.printingId)??0)+item.quantity);
    const orderItems:BundleEntry[]=[];
    let subtotal=0;
    for(const [printingId,quantity] of wanted){
      const entries=bundle.filter(item=>item.printingId===printingId);
      const listed=entries.reduce((sum,item)=>sum+item.quantity,0);
      if(!listed||quantity>listed)throw new HttpError(400,'One or more selected cards are not in this listing.');
      let remaining=quantity;
      for(const entry of entries){
        if(remaining<=0)break;
        const reservedQuery=entry.instanceId
          ?database.prepare(`SELECT COALESCE(SUM(CAST(json_extract(j.value,'$.quantity') AS INTEGER)),0) AS quantity FROM checkout_orders o,json_each(o.items) j WHERE o.listing_id=? AND o.kind='MARKET' AND o.status='PENDING_PAYMENT' AND o.expires_at>CURRENT_TIMESTAMP AND json_extract(j.value,'$.instanceId')=?`).bind(listing.id,entry.instanceId)
          :database.prepare(`SELECT COALESCE(SUM(CAST(json_extract(j.value,'$.quantity') AS INTEGER)),0) AS quantity FROM checkout_orders o,json_each(o.items) j WHERE o.listing_id=? AND o.kind='MARKET' AND o.status='PENDING_PAYMENT' AND o.expires_at>CURRENT_TIMESTAMP AND json_extract(j.value,'$.printingId')=?`).bind(listing.id,printingId);
        const reserved=await reservedQuery.first<{quantity:number}>();
        const held=reserved?.quantity??0;
        const available=Math.max(0,entry.quantity-held);
        const take=Math.min(available,remaining);
        if(take>0){const unitAmount=Number.isSafeInteger(entry.unitAmount)&&entry.unitAmount>0?entry.unitAmount:Math.max(1,Math.round(listing.amount/listing.quantity));orderItems.push({...entry,quantity:take,unitAmount});subtotal+=take*unitAmount;remaining-=take;}
      }
      if(remaining>0)throw new HttpError(409,'Some selected cards are currently reserved by another checkout.');
    }

    const apiKey=process.env.BITESHIP_API_KEY;
    if(!apiKey)throw new HttpError(503,'Live shipping quotes are not configured yet.');
    const pickup=biteshipDestination(seller.postalCode,seller.areaId);
    const dropoff=biteshipDestination(address.postalCode,isBiteshipAreaId(address.areaId)?address.areaId:null);
    if(!pickup.areaId&&!pickup.postalCode)throw new HttpError(400,'The seller needs a valid 5-digit pickup postal code.');
    if(!dropoff.areaId&&!dropoff.postalCode)throw new HttpError(400,'Save a valid 5-digit delivery postal code in your profile.');
    const quoteResponse=await fetch('https://api.biteship.com/v1/rates/couriers',{method:'POST',headers:{authorization:apiKey,'content-type':'application/json'},body:JSON.stringify({origin_area_id:pickup.areaId,origin_postal_code:pickup.postalCode,destination_area_id:dropoff.areaId,destination_postal_code:dropoff.postalCode,couriers:couriers.join(','),items:[{name:listing.title,value:subtotal,length:18,width:13,height:2,weight:Math.max(100,orderItems.reduce((sum,item)=>sum+item.quantity,0)*100),quantity:orderItems.reduce((sum,item)=>sum+item.quantity,0)}]})});
    const quoteBody=await quoteResponse.json().catch(()=>null) as {pricing?:Rate[];message?:string;error?:{message?:string}}|null;
    if(!quoteResponse.ok)throw new HttpError(quoteResponse.status,quoteBody?.error?.message??quoteBody?.message??'Shipping rates could not be loaded.');
    const rate=(quoteBody?.pricing??[]).find(item=>item.courier_name===input.courierName&&item.courier_service_name===input.courierServiceName);
    if(!rate||!Number.isSafeInteger(rate.price)||rate.price<0)throw new HttpError(409,'That delivery service is no longer available. Choose an updated quote.');

    const id=crypto.randomUUID();
    const amount=subtotal+rate.price;
    const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString().replace('T',' ').slice(0,19);
    const shipping={recipientName:address.recipientName,addressLine:[address.addressLine,addressDetail].filter(Boolean).join(', '),city:address.city,postalCode:address.postalCode,phone:address.phone,courierName:rate.courier_name,courierServiceName:rate.courier_service_name};
    await database.prepare(`INSERT INTO checkout_orders (id,kind,buyer_id,seller_id,listing_id,items,details,subtotal,shipping_fee,amount,currency,status,expires_at) VALUES (?,'MARKET',?,?,?,?,?,?,?,?,?,'PENDING_PAYMENT',?)`).bind(id,profile.id,listing.sellerId,listing.id,JSON.stringify(orderItems),JSON.stringify(shipping),subtotal,rate.price,amount,'IDR',expiresAt).run();
    const siteOrigin=new URL(request.url).origin;
    let intent;
    try{
      intent=await createAzekhaIntent({orderId:`vivreplay-market-${id}`,amount,customer:{name:address.recipientName||profile.display_name,email:account.email,mobile:address.phone},successUrl:`${siteOrigin}/checkout/order/${id}`,cancelUrl:`${siteOrigin}/market/${encodeURIComponent(listing.id)}`});
    }catch(error){
      await database.prepare("UPDATE checkout_orders SET status='FAILED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT'").bind(id).run();
      throw error;
    }
    if(intent.order_id!==`vivreplay-market-${id}`||intent.amount!==amount||intent.currency!=='IDR'){
      await database.prepare("UPDATE checkout_orders SET status='FAILED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT'").bind(id).run();
      throw new HttpError(502,'The payment service returned mismatched checkout details.');
    }
    await database.prepare("UPDATE checkout_orders SET payment_id=?,amount=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING_PAYMENT'").bind(intent.payment_id,intent.amount,id).run();
    return Response.json({id,checkoutUrl:`/checkout/order/${id}`,subtotal,shippingFee:rate.price,total:intent.amount},{status:201});
  }catch(error){return errorResponse(error)}
}
