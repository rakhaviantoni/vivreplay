import {db,errorResponse,HttpError} from '@/lib/server/store';
import {finalizeAuction,getAuctionDetail,getAuctionRoomStub} from '@/lib/server/auctions';

export async function GET(request:Request,context:{params:Promise<{listingId:string}>}){
  try{
    const {listingId}=await context.params;
    if(!listingId)throw new HttpError(400,'Missing auction id.');

    if(request.headers.get('upgrade')?.toLowerCase()==='websocket'){
      const stub=getAuctionRoomStub(listingId);
      if(!stub)throw new HttpError(503,'Live auction stream is unavailable.');
      const detail=await getAuctionDetail(db(),listingId);
      if(!detail)throw new HttpError(404,'Auction not found.');
      const stateCheck=await stub.fetch('https://auction.internal/state');
      if(stateCheck.status===404){
        await stub.fetch('https://auction.internal/init',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({...detail.auction,endsAtMs:Date.parse(detail.auction.endsAt)}),
        });
      }
      return stub.fetch(request);
    }

    const detail=await getAuctionDetail(db(),listingId);
    if(!detail)throw new HttpError(404,'Auction not found.');
    if(detail.auction.status==='ACTIVE'&&Date.parse(detail.auction.endsAt)<=Date.now()){
      const ended=await finalizeAuction(db(),listingId);
      if(ended)detail.auction=ended;
    }
    return Response.json(detail,{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return errorResponse(error);
  }
}
