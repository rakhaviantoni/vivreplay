import 'server-only';
import {headers} from 'next/headers';

export const ADMIN_SESSION_COOKIE='vp_admin_session';
const SESSION_SECONDS=8*60*60;

function base64Url(bytes:Uint8Array){
  let binary='';
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function fromBase64Url(value:string){
  const base64=value.replace(/-/g,'+').replace(/_/g,'/');
  const binary=atob(base64+'='.repeat((4-base64.length%4)%4));
  return Uint8Array.from(binary,character=>character.charCodeAt(0));
}

async function signature(payload:string,secret:string){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload))));
}

function constantTimeEqual(left:Uint8Array,right:Uint8Array){
  let difference=left.length^right.length;
  const length=Math.max(left.length,right.length);
  for(let index=0;index<length;index++)difference|=(left[index]??0)^(right[index]??0);
  return difference===0;
}

export async function verifyAdminPassword(candidate:string){
  const expected=process.env.ADMIN_PASSWORD;
  if(!expected||!candidate)return false;
  const [candidateDigest,expectedDigest]=await Promise.all([
    crypto.subtle.digest('SHA-256',new TextEncoder().encode(candidate)),
    crypto.subtle.digest('SHA-256',new TextEncoder().encode(expected)),
  ]);
  return constantTimeEqual(new Uint8Array(candidateDigest),new Uint8Array(expectedDigest));
}

export async function createAdminSession(){
  const secret=process.env.ADMIN_PASSWORD;
  if(!secret)throw new Error('ADMIN_PASSWORD is not configured.');
  const issuedAt=Math.floor(Date.now()/1000);
  const payload=`${issuedAt}.${crypto.randomUUID()}`;
  return `${payload}.${await signature(payload,secret)}`;
}

export async function isValidAdminSession(value:string|undefined){
  const secret=process.env.ADMIN_PASSWORD;
  if(!secret||!value)return false;
  const parts=value.split('.');
  if(parts.length!==3)return false;
  const [issuedAtText,nonce,suppliedSignature]=parts;
  if(!/^\d{10}$/.test(issuedAtText)||!nonce||!/^[A-Za-z0-9_-]{43}$/.test(suppliedSignature))return false;
  const issuedAt=Number(issuedAtText);
  const now=Math.floor(Date.now()/1000);
  if(issuedAt>now+60||now-issuedAt>SESSION_SECONDS)return false;
  const expected=await signature(`${issuedAtText}.${nonce}`,secret);
  try{return constantTimeEqual(fromBase64Url(suppliedSignature),fromBase64Url(expected))}catch{return false}
}

export async function isCurrentUserAdmin(){
  const requestHeaders=await headers();
  const cookieHeader=requestHeaders.get('cookie')??'';
  const pair=cookieHeader.split(';').map(value=>value.trim()).find(value=>value.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  const token=pair?.slice(ADMIN_SESSION_COOKIE.length+1);
  return isValidAdminSession(token);
}

export function adminSessionMaxAge(){return SESSION_SECONDS;}
