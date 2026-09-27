const filenamePattern=/^[A-Za-z0-9_-]+\.webp$/;
const bucket='tcg-card-images';

export async function serveCardImage(setCode:string,language:string,filename:string,variant='small'){
  if(!filenamePattern.test(filename)) return new Response('Not found',{status:404});
  const origin=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!origin||!key) return new Response('Asset storage is unavailable',{status:503});
  const normalizedSet=setCode.toUpperCase().replaceAll('-','');
  const objectKey=`one-piece/${normalizedSet}/${language.toLowerCase()}/${variant}/${filename}`;
  const response=await fetch(`${origin}/storage/v1/object/${bucket}/${objectKey}`,{headers:{accept:'image/webp,image/*;q=0.8',authorization:`Bearer ${key}`,apikey:key},cf:{cacheTtl:31_536_000,cacheEverything:true}});
  if(!response.ok||!response.body) return new Response('Not found',{status:404});
  return new Response(response.body,{headers:{'Content-Type':response.headers.get('content-type')||'image/webp','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
}

export async function GET(_request:Request,{params}:{params:Promise<{setCode:string;language:string;filename:string}>}) {
  const {setCode,language,filename}=await params;
  return serveCardImage(setCode,language,filename,'small');
}
