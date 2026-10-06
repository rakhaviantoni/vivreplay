import {db,HttpError} from './store';
import {biteshipApiKey,biteshipRates,validCoordinates} from './biteship';

type Rate={courier_code:string;courier_service_code:string;price:number;courier_name:string;courier_service_name:string;company:string;type:string;[key:string]:unknown};
type Quote={pricing:Rate[]};
const pending=new Map<string,Promise<Quote>>();

function canonical(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  return value;
}

export async function cachedShippingRates(buyerId:string|null,listingId:string,payload:Record<string,unknown>,context:unknown=null):Promise<Quote>{
  const load=async()=>{
    const data=await biteshipRates<{pricing?:Rate[]}>(payload);
    const enabled=new Set(String(payload.couriers??'').split(','));
    const unique=new Map<string,Rate>();
    for(const rate of data.pricing??[]){
      if(!enabled.has(rate.courier_code)||!Number.isFinite(rate.price)||rate.price<0)continue;
      unique.set(`${rate.courier_code}:${rate.courier_service_code}`,rate);
    }
    return {pricing:[...unique.values()].sort((a,b)=>a.price-b.price)};
  };
  if(!buyerId)return load();
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical({version:1,buyerId,listingId,payload,context,key:biteshipApiKey()}))));
  const key=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
  const existing=pending.get(key);if(existing)return existing;
  const work=(async()=>{
    const database=db();
    for(let attempt=0;attempt<80;attempt++){
      const now=Date.now();
      const hit=await database.prepare('SELECT quote_json AS json,expires_at AS expiresAt FROM shipping_quote_cache WHERE cache_key=?').bind(key).first<{json:string|null;expiresAt:number}>();
      if(hit?.json&&hit.expiresAt>now)return JSON.parse(hit.json) as Quote;
      const claimed=await database.prepare(`INSERT INTO shipping_quote_cache(cache_key,lease_until) VALUES (?,?) ON CONFLICT(cache_key) DO UPDATE SET lease_until=excluded.lease_until WHERE shipping_quote_cache.expires_at<=? AND shipping_quote_cache.lease_until<=? RETURNING cache_key`).bind(key,now+60_000,now,now).first();
      if(claimed){
        try{
          const quote=await load();
          const instant=String(payload.couriers).split(',').some(code=>['grab','gojek'].includes(code));
          const ttl=quote.pricing.length?(instant?3:15)*60_000:60_000;
          await database.prepare('UPDATE shipping_quote_cache SET quote_json=?,expires_at=?,lease_until=0 WHERE cache_key=?').bind(JSON.stringify(quote),Date.now()+ttl,key).run();
          await database.prepare('DELETE FROM shipping_quote_cache WHERE expires_at<? AND lease_until<?').bind(now-86_400_000,now).run();
          return quote;
        }catch(error){await database.prepare('UPDATE shipping_quote_cache SET lease_until=0 WHERE cache_key=?').bind(key).run();throw error;}
      }
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    throw new HttpError(503,'Shipping rates are being refreshed. Please try again.');
  })();
  pending.set(key,work);
  try{return await work;}finally{pending.delete(key);}
}

export async function shippingRateOptions(buyerId:string|null,listingId:string,options:{couriers:string[];origin:{areaId?:string;postalCode?:number};destination:{areaId?:string;postalCode?:number};originLatitude:number|null;originLongitude:number|null;destinationLatitude:number|null;destinationLongitude:number|null;items:unknown[]}){
  const {couriers,origin,destination,items}=options;
  const from=validCoordinates(options.originLatitude,options.originLongitude);const to=validCoordinates(options.destinationLatitude,options.destinationLongitude);
  const coordinates=from&&to?{origin_latitude:from.latitude,origin_longitude:from.longitude,destination_latitude:to.latitude,destination_longitude:to.longitude}:null;
  // Coordinates cover standard couriers too, avoiding a second billable request.
  if(coordinates)return cachedShippingRates(buyerId,listingId,{...coordinates,couriers:[...couriers].sort().join(','),items},{origin,destination});
  const regular=couriers.filter(code=>!['grab','gojek'].includes(code));
  if(!regular.length)return {pricing:[]};
  return cachedShippingRates(buyerId,listingId,{origin_area_id:origin.areaId,origin_postal_code:origin.postalCode,destination_area_id:destination.areaId,destination_postal_code:destination.postalCode,couriers:[...regular].sort().join(','),items});
}
