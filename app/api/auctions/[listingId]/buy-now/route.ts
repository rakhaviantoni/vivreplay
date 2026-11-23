import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {buyOutAuction} from '@/lib/server/auctions';

export async function POST(request:Request,context:{params:Promise<{listingId:string}>}){
  try{
    guard(request);
    const profile=await user();
    const {listingId}=await context.params;
    if(!listingId)throw new HttpError(400,'Missing auction id.');
    const result=await buyOutAuction(db(),{
      listingId,
      buyerId:profile.id,
      buyerName:profile.display_name||profile.username||'Collector',
    });
    return Response.json(result,{status:200});
  }catch(error){
    return errorResponse(error);
  }
}
