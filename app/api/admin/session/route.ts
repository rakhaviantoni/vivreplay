import {ADMIN_SESSION_COOKIE,adminSessionMaxAge,createAdminSession,isCurrentUserAdmin,verifyAdminPassword} from '@/lib/server/admin-auth';

function cookie(value:string,maxAge:number,secure:boolean){
  return `${ADMIN_SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`;
}

export async function GET(){
  return Response.json({authenticated:await isCurrentUserAdmin()},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&new URL(request.url).origin!==origin)return Response.json({error:'Request was not accepted.'},{status:403});
  const expectedType=request.headers.get('content-type')??'';
  if(!expectedType.toLowerCase().includes('application/json'))return Response.json({error:'Request was not accepted.'},{status:415});
  const body=await request.json().catch(()=>null) as {password?:unknown}|null;
  const password=typeof body?.password==='string'?body.password.slice(0,256):'';
  if(!await verifyAdminPassword(password))return Response.json({error:'Password does not match.'},{status:401,headers:{'Cache-Control':'no-store'}});
  const token=await createAdminSession();
  return Response.json({authenticated:true},{headers:{'Cache-Control':'no-store','Set-Cookie':cookie(token,adminSessionMaxAge(),new URL(request.url).protocol==='https:')}});
}

export async function DELETE(request:Request){
  return Response.json({authenticated:false},{headers:{'Cache-Control':'no-store','Set-Cookie':cookie('',0,new URL(request.url).protocol==='https:')}});
}
