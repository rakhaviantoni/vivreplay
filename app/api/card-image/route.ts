const CARD_IMAGE_HOST='cards.oplaytcg.com';

export async function GET(request:Request){
  const source=new URL(request.url).searchParams.get('url');
  if(!source)return Response.json({error:'Missing card image URL.'},{status:400});
  let remote:URL;
  try{remote=new URL(source);}catch{return Response.json({error:'Invalid card image URL.'},{status:400});}
  if(remote.protocol!=='https:'||remote.hostname!==CARD_IMAGE_HOST)return Response.json({error:'Unsupported card image source.'},{status:400});
  const response=await fetch(remote.toString(),{headers:{accept:'image/avif,image/webp,image/*;q=0.8,*/*;q=0.5'}});
  if(!response.ok||!response.body)return Response.json({error:'Card image is unavailable.'},{status:response.status===404?404:502});
  return new Response(response.body,{headers:{'content-type':response.headers.get('content-type')||'image/webp','cache-control':'public, max-age=86400, s-maxage=604800'}});
}
