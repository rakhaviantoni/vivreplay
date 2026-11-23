import {env} from 'cloudflare:workers';
import {db,errorResponse,HttpError} from '@/lib/server/store';
import {finalizeAuction} from '@/lib/server/auctions';

export async function POST(request:Request,context:{params:Promise<{listingId:string}>}){
  try{
    const secret=env.PRO_MEMBERSHIP_CRON_SECRET||env.BETTER_AUTH_SECRET||'';
    const authHeader=request.headers.get('authorization')||'';
    if(!secret||authHeader!==`Bearer ${secret}`){
      throw new HttpError(401,'Unauthorized');
    }
    const {listingId}=await context.params;
    if(!listingId)throw new HttpError(400,'Missing auction id.');
    const auction=await finalizeAuction(db(),listingId);
    return Response.json({ok:true,auction});
  }catch(error){
    return errorResponse(error);
  }
}
