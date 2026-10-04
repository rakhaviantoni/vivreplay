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

export const GET=handler.GET;
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
