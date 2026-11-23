import {z} from 'zod';
import {db,errorResponse,guard,HttpError,user} from '@/lib/server/store';
import {placeAuctionBid} from '@/lib/server/auctions';

const bidSchema=z.object({
  amount:z.number().int().positive().max(100_000_000_000),
});

export async function POST(request:Request,context:{params:Promise<{listingId:string}>}){
  try{
    guard(request);
    const profile=await user();
    const {listingId}=await context.params;
    if(!listingId)throw new HttpError(400,'Missing auction id.');
    const body=bidSchema.parse(await request.json());
    const result=await placeAuctionBid(db(),{
      listingId,
      bidderId:profile.id,
      bidderName:profile.name||profile.username||'Collector',
      amount:body.amount,
    });
    return Response.json(result,{status:200});
  }catch(error){
    return errorResponse(error);
  }
}
