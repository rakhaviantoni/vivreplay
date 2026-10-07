import {db,HttpError} from './store';
import {biteshipApiKey,biteshipRates,validCoordinates} from './biteship';

type Rate={courier_code:string;courier_service_code:string;price:number;courier_name:string;courier_service_name:string;company:string;type:string;[key:string]:unknown};
type Quote={pricing:Rate[];cacheMiss?:boolean;regularExpiresAt?:number;instantExpiresAt?:number};
const REGULAR_RATE_TTL_MS=7*24*60*60_000;
const INSTANT_RATE_TTL_MS=3*60_000;
const isInstant=(code:string)=>['grab','gojek'].includes(code);
function freshRates(quote:Quote,now:number){return quote.pricing.filter(rate=>((isInstant(rate.courier_code)?quote.instantExpiresAt:quote.regularExpiresAt)??0)>now);}
function requestedRatesFresh(quote:Quote,couriers:string[],now:number){return couriers.every(code=>((isInstant(code)?quote.instantExpiresAt:quote.regularExpiresAt)??0)>now);}
const pending=new Map<string,Promise<Quote>>();

function canonical(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  return value;
}

export async function cachedShippingRates(buyerId:string|null,listingId:string,payload:Record<string,unknown>,context:unknown=null,cacheOnly=false,refresh=false):Promise<Quote>{
  const requested=String(payload.couriers??'').split(',');
  const load=async(codes=requested)=>{
    const data=await biteshipRates<{pricing?:Rate[]}>({...payload,couriers:codes.join(',')});
    const enabled=new Set(codes);
    const unique=new Map<string,Rate>();
    for(const rate of data.pricing??[]){
      if(!enabled.has(rate.courier_code)||!Number.isFinite(rate.price)||rate.price<0)continue;
      unique.set(`${rate.courier_code}:${rate.courier_service_code}`,rate);
    }
    return {pricing:[...unique.values()].sort((a,b)=>a.price-b.price)};
  };
  if(!buyerId)return cacheOnly?{pricing:[],cacheMiss:true}:load();
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical({version:2,buyerId,listingId,payload,context,key:biteshipApiKey()}))));
  const key=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(cacheOnly){
    const hit=await db().prepare('SELECT quote_json AS json,expires_at AS expiresAt FROM shipping_quote_cache WHERE cache_key=?').bind(key).first<{json:string|null;expiresAt:number}>();
    const quote=hit?.json?JSON.parse(hit.json) as Quote:null;
    const pricing=quote?freshRates(quote,Date.now()):[];
    return pricing.length?{pricing}:{pricing:[],cacheMiss:true};
  }
  const pendingKey=`${key}:${refresh?'fresh':'cached'}`;
  const existing=pending.get(pendingKey);if(existing)return existing;
  const work=(async()=>{
    const database=db();
    for(let attempt=0;attempt<80;attempt++){
      const now=Date.now();
      const hit=await database.prepare('SELECT quote_json AS json,expires_at AS expiresAt FROM shipping_quote_cache WHERE cache_key=?').bind(key).first<{json:string|null;expiresAt:number}>();
      const previous=hit?.json?JSON.parse(hit.json) as Quote:null;
      if(!refresh&&previous&&requestedRatesFresh(previous,requested,now))return previous;
      const claimed=await database.prepare(`INSERT INTO shipping_quote_cache(cache_key,lease_until) VALUES (?,?) ON CONFLICT(cache_key) DO UPDATE SET lease_until=excluded.lease_until WHERE (shipping_quote_cache.expires_at<=? OR ?=1) AND shipping_quote_cache.lease_until<=? RETURNING cache_key`).bind(key,now+60_000,now,refresh?1:0,now).first();
      if(claimed){
        try{
          const stale=requested.filter(code=>refresh||!previous||((isInstant(code)?previous.instantExpiresAt:previous.regularExpiresAt)??0)<=now);
          const fetched=await load(stale);
          const retained=previous&&!refresh?freshRates(previous,now).filter(rate=>!stale.includes(rate.courier_code)):[];
          const pricing=[...retained,...fetched.pricing].sort((a,b)=>a.price-b.price);
          const regularExpiresAt=stale.some(code=>!isInstant(code))?now+(fetched.pricing.some(rate=>!isInstant(rate.courier_code))?REGULAR_RATE_TTL_MS:60_000):previous?.regularExpiresAt??0;
          const instantExpiresAt=stale.some(isInstant)?now+(fetched.pricing.some(rate=>isInstant(rate.courier_code))?INSTANT_RATE_TTL_MS:60_000):previous?.instantExpiresAt??0;
          const quote={pricing,regularExpiresAt,instantExpiresAt};
          const expiresAt=Math.max(...[requested.some(code=>!isInstant(code))?regularExpiresAt:0,requested.some(isInstant)?instantExpiresAt:0]);
          await database.prepare('UPDATE shipping_quote_cache SET quote_json=?,expires_at=?,lease_until=0 WHERE cache_key=?').bind(JSON.stringify(quote),expiresAt,key).run();
          await database.prepare('DELETE FROM shipping_quote_cache WHERE expires_at<? AND lease_until<?').bind(now-86_400_000,now).run();
          return quote;
        }catch(error){await database.prepare('UPDATE shipping_quote_cache SET lease_until=0 WHERE cache_key=?').bind(key).run();throw error;}
      }
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    throw new HttpError(503,'Shipping rates are being refreshed. Please try again.');
  })();
  pending.set(pendingKey,work);
  try{return await work;}finally{pending.delete(pendingKey);}
}

export async function shippingRateOptions(buyerId:string|null,listingId:string,options:{couriers:string[];origin:{areaId?:string;postalCode?:number};destination:{areaId?:string;postalCode?:number};originLatitude:number|null;originLongitude:number|null;destinationLatitude:number|null;destinationLongitude:number|null;items:unknown[];cacheOnly?:boolean;refresh?:boolean}){
  const {couriers,origin,destination,items}=options;
  const from=validCoordinates(options.originLatitude,options.originLongitude);const to=validCoordinates(options.destinationLatitude,options.destinationLongitude);
  const coordinates=from&&to?{origin_latitude:from.latitude,origin_longitude:from.longitude,destination_latitude:to.latitude,destination_longitude:to.longitude}:null;
  // Coordinates cover standard couriers too, avoiding a second billable request.
  if(coordinates)return cachedShippingRates(buyerId,listingId,{...coordinates,couriers:[...couriers].sort().join(','),items},{origin,destination},options.cacheOnly,options.refresh);
  const regular=couriers.filter(code=>!['grab','gojek'].includes(code));
  if(!regular.length)return {pricing:[]};
  const pickup=origin.areaId?{origin_area_id:origin.areaId}:from?{origin_latitude:from.latitude,origin_longitude:from.longitude}:{origin_postal_code:origin.postalCode};
  const dropoff=destination.areaId?{destination_area_id:destination.areaId}:to?{destination_latitude:to.latitude,destination_longitude:to.longitude}:{destination_postal_code:destination.postalCode};
  return cachedShippingRates(buyerId,listingId,{...pickup,...dropoff,couriers:[...regular].sort().join(','),items},{origin,destination},options.cacheOnly,options.refresh);
}
