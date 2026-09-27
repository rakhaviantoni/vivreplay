import {createClient} from '@supabase/supabase-js';

const allowedKinds=new Set(['small']);

export async function GET(request:Request,{params}:{params:Promise<{printingId:string}>}) {
  const {printingId}=await params;
  const kind=new URL(request.url).searchParams.get('kind')??'small';
  if(!/^[0-9a-f-]{36}$/i.test(printingId)||!allowedKinds.has(kind)) return new Response('Not found',{status:404});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return new Response('Asset storage is unavailable',{status:503});
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:asset,error:assetError}=await supabase.from('tcg_card_assets').select('object_key').eq('printing_id',printingId).eq('kind',kind).maybeSingle();
  if(assetError||!asset?.object_key)return new Response('Not found',{status:404});
  const {data,error}=await supabase.storage.from('tcg-card-images').download(asset.object_key);
  if(error||!data)return new Response('Not found',{status:404});
  return new Response(data.stream(),{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
}
