import {db,errorResponse} from '@/lib/server/store';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

type ListingRow={id:string;title:string;type:string;status:string;amount:number;currency:string;quantity:number;condition:string;city:string;created_at:string;expires_at:string|null;items:string|null;seller_id:string;seller:string;username:string;tier:string};
type SellerRow={id:string;username:string;display_name:string;tier:string;active_listings:number;total_listings:number;last_listing_at:string|null};

export async function GET(){
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  try{
    const d=db();
    const [listingResult,sellerResult]=await Promise.all([
      d.prepare(`SELECT l.id,l.title,l.type,l.status,l.amount,l.currency,l.quantity,l.condition,l.city,l.created_at,l.expires_at,l.items,p.id AS seller_id,p.display_name AS seller,p.username,p.tier FROM listings l JOIN profiles p ON p.id=l.seller_id ORDER BY l.created_at DESC LIMIT 250`).all<ListingRow>(),
      d.prepare(`SELECT p.id,p.username,p.display_name,p.tier,COUNT(CASE WHEN l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP) THEN 1 END) AS active_listings,COUNT(l.id) AS total_listings,MAX(l.created_at) AS last_listing_at FROM profiles p JOIN listings l ON l.seller_id=p.id GROUP BY p.id ORDER BY active_listings DESC,last_listing_at DESC LIMIT 250`).all<SellerRow>(),
    ]);
    const listings=listingResult.results.map(row=>{
      let cardCount=row.quantity;
      if(row.items){try{const items=JSON.parse(row.items) as Array<{quantity?:number}>;if(Array.isArray(items)&&items.length)cardCount=items.reduce((sum,item)=>sum+(Number(item.quantity)||0),0)}catch{}}
      return {id:row.id,title:row.title,type:row.type,status:row.status,amount:row.amount,currency:row.currency,quantity:cardCount,condition:row.condition,city:row.city,createdAt:row.created_at,expiresAt:row.expires_at,seller:row.seller,username:row.username,sellerId:row.seller_id,tier:row.tier};
    });
    return Response.json({listings,sellers:sellerResult.results},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
