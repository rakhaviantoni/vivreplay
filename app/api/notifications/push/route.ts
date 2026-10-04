import {z} from 'zod';
import {db,errorResponse,guard,user} from '@/lib/server/store';
import {env} from 'cloudflare:workers';

const subscriptionSchema=z.object({endpoint:z.string().url().max(2048),expirationTime:z.number().int().positive().nullable().optional(),keys:z.object({p256dh:z.string().min(80).max(200),auth:z.string().min(20).max(100)})});
const removeSchema=z.object({endpoint:z.string().url().max(2048)});

export async function GET(){
  try{
    const profile=await user();
    const subscriptions=await db().prepare('SELECT COUNT(*) AS count FROM market_push_subscriptions WHERE profile_id=?').bind(profile.id).first<{count:number}>();
    return Response.json({enabled:Boolean(env.VAPID_PUBLIC_KEY),publicKey:env.VAPID_PUBLIC_KEY??null,subscriptionCount:subscriptions?.count??0},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}

export async function POST(request:Request){
  try{
    guard(request);const profile=await user();
    if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_JWK) return Response.json({error:'Push notifications are not configured yet.'},{status:503});
    const value=subscriptionSchema.parse(await request.json());
    const endpoint=new URL(value.endpoint);
    if(endpoint.protocol!=='https:')return Response.json({error:'Invalid push service endpoint.'},{status:400});
    await db().prepare(`INSERT INTO market_push_subscriptions (id,profile_id,endpoint,p256dh,auth,expiration_time,updated_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(profile_id,endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,expiration_time=excluded.expiration_time,updated_at=CURRENT_TIMESTAMP`)
      .bind(crypto.randomUUID(),profile.id,value.endpoint,value.keys.p256dh,value.keys.auth,value.expirationTime??null).run();
    return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return errorResponse(error)}
}

export async function DELETE(request:Request){
  try{
    guard(request);const profile=await user();const value=removeSchema.parse(await request.json());
    await db().prepare('DELETE FROM market_push_subscriptions WHERE profile_id=? AND endpoint=?').bind(profile.id,value.endpoint).run();
    return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return errorResponse(error)}
}
