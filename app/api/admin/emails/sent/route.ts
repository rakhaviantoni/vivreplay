import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

export async function GET(request:Request){
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access required.'},{status:403,headers:{'Cache-Control':'no-store'}});
  const apiKey=process.env.RESEND_API_KEY;
  if(!apiKey)return Response.json({error:'Email history is not configured.'},{status:503,headers:{'Cache-Control':'no-store'}});
  const url=new URL(request.url);
  const limit=Math.max(1,Math.min(100,Number(url.searchParams.get('limit'))||50));
  const after=url.searchParams.get('after');
  if(after&&!/^[0-9a-f-]{36}$/i.test(after))return Response.json({error:'Invalid email cursor.'},{status:400});
  const params=new URLSearchParams({limit:String(limit)});
  if(after)params.set('after',after);
  const response=await fetch(`https://api.resend.com/emails?${params}`,{headers:{Authorization:`Bearer ${apiKey}`},cache:'no-store'});
  const raw:unknown=await response.json().catch(()=>null);
  const data=raw as {data?:Record<string,unknown>[];has_more?:boolean}|null;
  if(!response.ok)return Response.json({error:'Could not load sent emails.'},{status:502,headers:{'Cache-Control':'no-store'}});
  const emails=Array.isArray(data?.data)?data.data:[];
  const vivrePlayEmails=emails.filter(email=>typeof email.from==='string'&&/@vivreplay\.com(?:\s|>|$)/i.test(email.from));
  return Response.json({data:vivrePlayEmails,has_more:Boolean(data?.has_more),next_cursor:emails.at(-1)?.id??null},{headers:{'Cache-Control':'private, no-store'}});
}
