import {user,db,errorResponse,guard,HttpError} from '@/lib/server/store';

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    guard(req);
    const p=await user();
    const {id}=await params;

    const result=await db().prepare(
      "UPDATE listings SET status='CLOSED' WHERE id=? AND seller_id=? AND status!='SOLD'"
    ).bind(id,p.id).run();

    if(!result.meta.changes){
      throw new HttpError(404,'Listing not found, already sold, or you do not have permission to close it.');
    }

    return Response.json({ok:true,id,status:'CLOSED'});
  }catch(e){
    return errorResponse(e);
  }
}
