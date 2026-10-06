import {isBiteshipAreaId} from '@/lib/shipping/biteship-area';
import {HttpError} from '@/lib/server/store';

const API='https://api.biteship.com/v1';

export type BiteshipArea={id:string;name:string;postal_code?:number|string;administrative_division_level_1_name?:string;administrative_division_level_2_name?:string;administrative_division_level_3_name?:string;administrative_division_level_4_name?:string;latitude?:number;longitude?:number};
export type BiteshipResponse={success?:boolean;code?:number;message?:string;error?:string|{message?:string};[key:string]:unknown};

export class BiteshipError extends HttpError{
  constructor(message:string,status:number,readonly code?:number){super(status,message);this.name='BiteshipError';}
}

export function biteshipApiKey(){return process.env.BITESHIP_API_KEY?.trim()??'';}

function errorMessage(payload:BiteshipResponse|null,status:number){
  const upstream=typeof payload?.error==='string'?payload.error:payload?.error?.message??payload?.message;
  if(payload?.code===40001001)return 'Biteship could not match this postal code. Search for and select the exact delivery area, then try again.';
  if(status===401||status===403)return 'Biteship rejected the API key. Check the configured Biteship environment key.';
  return upstream||'Biteship could not complete the shipping request.';
}

type BiteshipRequestInit=RequestInit;
export async function biteshipRequest<T extends BiteshipResponse>(path:string,init:BiteshipRequestInit={}):Promise<T>{
  const key=biteshipApiKey();
  if(!key)throw new BiteshipError('Biteship shipping is not configured.',503);
  let response:Response;
  try{
    response=await fetch(`${API}${path}`,{
      ...init,
      headers:{authorization:key,'content-type':'application/json',...init.headers},
      signal:init.signal??AbortSignal.timeout(15_000),
      cache:init.cache==='no-cache'?'no-cache':'no-store',
    });
  }catch(error){
    if(error instanceof BiteshipError)throw error;
    throw new BiteshipError('Biteship is not responding. Try again shortly.',502);
  }
  const payload=await response.json().catch(()=>null) as T|null;
  if(!response.ok||payload?.success===false)throw new BiteshipError(errorMessage(payload,response.status),response.status,payload?.code);
  return (payload??{}) as T;
}

export async function searchBiteshipAreas(query:string){
  const value=query.trim();
  if(value.length<2||!biteshipApiKey())return [] as BiteshipArea[];
  const params=new URLSearchParams({countries:'ID',input:value,type:'single'});
  const data=await biteshipRequest<BiteshipResponse&{areas?:BiteshipArea[]}>(`/maps/areas?${params}`);
  return Array.isArray(data.areas)?data.areas:[];
}

export async function verifyBiteshipPostal(postalCode:string){
  const postal=postalCode.trim();
  if(!/^\d{5}$/.test(postal))throw new BiteshipError('Enter a five-digit Indonesian postal code.',400);
  if(!biteshipApiKey())return null;
  const areas=await searchBiteshipAreas(postal);
  const matched=areas.find(area=>String(area.postal_code??'')===postal);
  if(!matched)throw new BiteshipError(`Biteship has no delivery area for postal code ${postal}. Search for your district and select a matching area.`,400);
  return matched;
}

export async function biteshipRates<T extends BiteshipResponse>(payload:Record<string,unknown>):Promise<T>{
  try{return await biteshipRequest<T>('/rates/couriers',{method:'POST',body:JSON.stringify(payload)})}
  catch(error){
    if(!(error instanceof BiteshipError)||error.code!==40001001)throw error;
    const fallback={...payload};let changed=false;
    if(fallback.origin_area_id&&fallback.origin_postal_code){delete fallback.origin_area_id;changed=true;}
    if(fallback.destination_area_id&&fallback.destination_postal_code){delete fallback.destination_area_id;changed=true;}
    if(!changed)throw error;
    return biteshipRequest<T>('/rates/couriers',{method:'POST',body:JSON.stringify(fallback)});
  }
}

export function postalNumber(value:string|null|undefined){
  const postal=typeof value==='string'?value.trim():'';
  return /^\d{5}$/.test(postal)?Number(postal):undefined;
}

export function validCoordinates(latitude:number|null|undefined,longitude:number|null|undefined){
  return typeof latitude==='number'&&Number.isFinite(latitude)&&Math.abs(latitude)<=90&&typeof longitude==='number'&&Number.isFinite(longitude)&&Math.abs(longitude)<=180
    ?{latitude,longitude}:undefined;
}

export function cleanAreaId(value:string|null|undefined){return isBiteshipAreaId(value)?value.trim():undefined;}
