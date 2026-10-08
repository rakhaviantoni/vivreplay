import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access required.'},{status:403,headers:{'Cache-Control':'no-store'}});
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))return Response.json({error:'Invalid email ID.'},{status:400});
  const apiKey=process.env.RESEND_API_KEY;
  if(!apiKey)return Response.json({error:'Email history is not configured.'},{status:503,headers:{'Cache-Control':'no-store'}});
  const response=await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${apiKey}`},cache:'no-store'});
  const raw:unknown=await response.json().catch(()=>null);
  const data=raw as {from?:unknown;[key:string]:unknown}|null;
  if(!response.ok)return Response.json({error:response.status===404?'Email not found.':'Could not load this email.'},{status:response.status===404?404:502,headers:{'Cache-Control':'no-store'}});
  if(typeof data?.from!=='string'||!/@vivreplay\.com(?:\s|>|$)/i.test(data.from))return Response.json({error:'Email not found.'},{status:404,headers:{'Cache-Control':'no-store'}});
  return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
}
