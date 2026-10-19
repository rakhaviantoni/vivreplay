import {env} from 'cloudflare:workers';

const assetKeys = {
  'back-card': 'one-piece/game-assets/back-card.webp',
  'don-back': 'one-piece/game-assets/don-back.webp',
} as const;

export async function GET(_request:Request,{params}:{params:Promise<{asset:string}>}) {
  const {asset} = await params;
  const objectKey = assetKeys[asset as keyof typeof assetKeys];
  if (!objectKey) return new Response('Not found',{status:404});
  const cacheHeaders={'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'};
  const object=await env.CARD_IMAGES?.get(objectKey).catch(()=>null);
  if(object)return new Response(object.body,{headers:{...cacheHeaders,'Content-Type':object.httpMetadata?.contentType??'image/webp'}});

  // Keep face-down zones legible if a local R2 mirror has not been populated.
  return new Response(null,{status:307,headers:{Location:new URL('/assets/one-piece-leader-back.jpg',_request.url).href,'Cache-Control':'no-store'}});
}
