import {env} from 'cloudflare:workers';
import {db,user,guard,errorResponse,HttpError} from '@/lib/server/store';

export async function POST(request:Request){
  let key:string|undefined;
  try{
    guard(request);const profile=await user();
    if(Number(request.headers.get('content-length'))>6_000_000)throw new HttpError(413,'Use a photo smaller than 5 MB.');
    const count=await db().prepare("SELECT COUNT(*) AS n FROM market_product_photos WHERE owner_id=? AND created_at>datetime('now','-1 day')").bind(profile.id).first<{n:number}>();
    if((count?.n??0)>=30)throw new HttpError(429,'You have reached today’s photo upload limit.');
    const file=(await request.formData()).get('photo');
    if(!(file instanceof File)||file.size<12||file.size>5_000_000)throw new HttpError(400,'Choose a photo smaller than 5 MB.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    const mime=bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
    if(!mime)throw new HttpError(400,'Choose a JPG, PNG, or WebP photo.');
    const id=crypto.randomUUID();key=`market-products/${profile.id}/${id}`;
    if(!env.CARD_IMAGES)throw new HttpError(503,'Photo uploads are unavailable.');
    await env.CARD_IMAGES.put(key,bytes,{httpMetadata:{contentType:mime}});
    await db().prepare('INSERT INTO market_product_photos(id,owner_id,object_key,mime) VALUES (?,?,?,?)').bind(id,profile.id,key,mime).run();
    return Response.json({id},{status:201});
  }catch(error){if(key)await env.CARD_IMAGES?.delete(key).catch(()=>{});return errorResponse(error);}
}
