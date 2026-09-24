import {env} from 'cloudflare:workers';
import {user,HttpError,errorResponse} from '@/lib/server/store';

const encoder=new TextEncoder();
const base64Url=(value:Uint8Array)=>btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');

export async function POST(request:Request){try{
  const origin=env.ARENA_SERVICE_ORIGIN as string|undefined;const secret=env.ARENA_TICKET_SECRET as string|undefined;
  if(!origin||!secret)throw new HttpError(503,'Online Arena is not available yet.');
  const body=await request.json() as {roomId?:string};const roomId=body.roomId?.trim();
  if(!roomId||!/^[-a-zA-Z0-9_]{6,80}$/.test(roomId))throw new HttpError(400,'Choose a valid room code.');
  const account=await user();const payload=base64Url(encoder.encode(JSON.stringify({roomId,playerId:account.id,name:account.email?.split('@')[0]||'Collector',expiresAt:Date.now()+5*60_000})));
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=base64Url(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(payload))));
  return Response.json({url:`${origin.replace(/\/$/,'')}/rooms/${encodeURIComponent(roomId)}?ticket=${payload}.${signature}`,expiresIn:300});
}catch(error){return errorResponse(error)}}
