import {env} from 'cloudflare:workers';

const assetKeys = {
  'back-card': 'one-piece/game-assets/back-card.webp',
  'don-back': 'one-piece/game-assets/don-back.webp',
} as const;

export async function GET(_request:Request,{params}:{params:Promise<{asset:string}>}) {
  const {asset} = await params;
  const objectKey = assetKeys[asset as keyof typeof assetKeys];
  if (!objectKey) return new Response('Not found',{status:404});
  const object=await env.CARD_IMAGES?.get(objectKey);
  if(!object)return new Response('Not found',{status:404});
  return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType??'image/webp','Cache-Control':object.httpMetadata?.cacheControl??'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
}
