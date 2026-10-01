import {user,db,HttpError} from '@/lib/server/store';

export async function POST(request:Request){
  try{
    const body=await request.json() as {visitorId?:unknown};
    if(typeof body.visitorId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.visitorId))return Response.json({error:'Invalid visitor id.'},{status:400});
    const profile=await user();
    const account=await db().prepare('SELECT createdAt FROM user WHERE id=?').bind(profile.auth_subject).first<{createdAt:string}>();
    if(!account?.createdAt)return Response.json({converted:false},{headers:{'Cache-Control':'no-store'}});
    const result=await db().prepare(`UPDATE attribution_visits SET converted_at=CURRENT_TIMESTAMP
      WHERE id=(SELECT id FROM attribution_visits WHERE visitor_id=? AND converted_at IS NULL
        AND created_at<=? AND created_at>=datetime(?,'-30 days') ORDER BY created_at DESC LIMIT 1)`)
      .bind(body.visitorId,account.createdAt,account.createdAt).run();
    return Response.json({converted:(result.meta.changes??0)>0},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    if(error instanceof HttpError)return Response.json({error:error.message},{status:error.status});
    return Response.json({error:'Campaign conversion could not be recorded.'},{status:503});
  }
}
