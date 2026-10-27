import {db,user,errorResponse} from '@/lib/server/store';
import {getMarketActivityProgress} from '@/lib/server/market-activity-progress';

export async function GET(){
  try{
    const profile=await user();
    const progress=await getMarketActivityProgress(db(),profile.id);
    return Response.json(progress,{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
