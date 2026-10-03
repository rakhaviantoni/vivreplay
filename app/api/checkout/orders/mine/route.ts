import {db,errorResponse,user} from '@/lib/server/store';

export async function GET(){
  try{
    const profile=await user();
    const orders=(await db().prepare(`SELECT o.id,o.kind,o.status,o.amount,o.currency,o.created_at AS createdAt,
      CASE WHEN o.buyer_id=? THEN 'buyer' ELSE 'seller' END AS role,l.title AS listingTitle
      FROM checkout_orders o LEFT JOIN listings l ON l.id=o.listing_id
      WHERE o.buyer_id=? OR o.seller_id=? ORDER BY o.created_at DESC LIMIT 100`)
      .bind(profile.id,profile.id,profile.id).all<{id:string;kind:string;status:string;amount:number;currency:string;createdAt:string;role:'buyer'|'seller';listingTitle:string|null}>()).results;
    return Response.json({orders},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
