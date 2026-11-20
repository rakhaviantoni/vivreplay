import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import {verifyTurnstile} from '@/lib/server/turnstile';

const handler=toNextJsHandler(auth);
const protectedAuthActions=new Set([
  '/sign-in/email',
  '/sign-in/social',
  '/sign-up/email',
  '/request-password-reset',
  '/reset-password',
  '/send-verification-email',
]);

export async function GET(request:Request){
  const response=await handler.GET(request);
  const path=new URL(request.url).pathname.replace(/^\/api\/auth/,'');
  if(path.startsWith('/callback/')&&response.headers.getSetCookie?.().some(c=>c.startsWith('__Secure-better-auth.session_token='))){
    const headers=new Headers(response.headers);
    headers.append('Set-Cookie','__Secure-better-auth.session_token=; Domain=vivreplay.com; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
  return response;
}
export const PATCH=handler.PATCH;
export const PUT=handler.PUT;
export const DELETE=handler.DELETE;

export async function POST(request:Request){
  const path=new URL(request.url).pathname.replace(/^\/api\/auth/,'');
  if(protectedAuthActions.has(path)){
    const rejected=await verifyTurnstile(request);
    if(rejected)return rejected;
  }
  return handler.POST(request);
}
