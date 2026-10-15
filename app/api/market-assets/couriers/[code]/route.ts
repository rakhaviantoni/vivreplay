import {env} from 'cloudflare:workers';

const courierCodes=new Set(['anteraja','grab','jne','jnt','gojek','lion','ninja','pos','sicepat','tiki','wahana']);

export async function GET(_request:Request,{params}:{params:Promise<{code:string}>}){
  const {code}=await params;
  if(!courierCodes.has(code))return new Response('Not found',{status:404});
  const object=await env.CARD_IMAGES?.get(`market/couriers/${code}.webp`);
  if(!object)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
  return new Response(object.body,{headers:{
    'Content-Type':object.httpMetadata?.contentType??'image/webp',
    'Cache-Control':object.httpMetadata?.cacheControl??'public, max-age=31536000, immutable',
    'ETag':object.httpEtag,
    'X-Content-Type-Options':'nosniff',
  }});
}
