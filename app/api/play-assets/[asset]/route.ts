import {createClient} from '@supabase/supabase-js';

const assetKeys = {
  'back-card': 'one-piece/game-assets/back-card.webp',
  'don-back': 'one-piece/game-assets/don-back.webp',
} as const;

export async function GET(_request:Request,{params}:{params:Promise<{asset:string}>}) {
  const {asset} = await params;
  const objectKey = assetKeys[asset as keyof typeof assetKeys];
  if (!objectKey) return new Response('Not found',{status:404});
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return new Response('Asset storage is unavailable',{status:503});
  const supabase = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error} = await supabase.storage.from('tcg-card-images').download(objectKey);
  if (error || !data) return new Response('Not found',{status:404});
  return new Response(data.stream(),{headers:{
    'Content-Type':'image/webp',
    'Cache-Control':'public, max-age=31536000, immutable',
    'X-Content-Type-Options':'nosniff',
  }});
}
