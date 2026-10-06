import {database} from '@/lib/server/database';

type ListingRow={id:string;title:string;amount:number;currency:string;quantity:number;condition:string;city:string;seller:string;negotiable:number;createdAt:string;items:string|null;printingId:string};

export async function GET(request:Request){
  const printingId=new URL(request.url).searchParams.get('printingId')?.trim();
  if(!printingId||printingId.length>160)return Response.json({listings:[]},{headers:{'Cache-Control':'public, max-age=30, stale-while-revalidate=120'}});
  try{
    const rows=(await database().prepare(`SELECT l.id,l.title,l.amount,l.currency,l.quantity,l.condition,l.city,l.negotiable,l.created_at AS createdAt,l.items,p.display_name AS seller,l.printing_id AS printingId
      FROM listings l JOIN profiles p ON p.id=l.seller_id
      WHERE l.status='ACTIVE' AND l.type='WTS' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)
        AND (l.printing_id=? OR EXISTS(SELECT 1 FROM json_each(CASE WHEN json_valid(l.items) THEN l.items ELSE '[]' END) item WHERE json_extract(item.value,'$.printingId')=?))
      ORDER BY l.created_at DESC LIMIT 60`).bind(printingId,printingId).all<ListingRow>()).results;
    const listings=rows.flatMap(row=>{
      let quantity=row.quantity;
      let unitAmount=Math.max(1,Math.round(row.amount/Math.max(1,row.quantity)));
      if(row.items){
        try{
          const item=(JSON.parse(row.items) as Array<{printingId?:unknown;quantity?:unknown;unitAmount?:unknown;condition?:unknown}>).find(entry=>entry.printingId===printingId);
          if(!item)return[];
          if(typeof item.quantity==='number'&&Number.isInteger(item.quantity)&&item.quantity>0)quantity=item.quantity;
          if(typeof item.unitAmount==='number'&&Number.isSafeInteger(item.unitAmount)&&item.unitAmount>=0)unitAmount=item.unitAmount;
          if(typeof item.condition==='string'&&item.condition.trim())row.condition=item.condition;
        }catch{return[]}
      }else if(row.printingId!==printingId)return[];
      return [{id:row.id,title:row.title,amount:unitAmount,currency:row.currency,quantity,condition:row.condition,city:row.city,seller:row.seller,negotiable:Boolean(row.negotiable),createdAt:row.createdAt}];
    });
    listings.sort((a,b)=>a.amount-b.amount||b.createdAt.localeCompare(a.createdAt));
    return Response.json({listings:listings.slice(0,12)},{headers:{'Cache-Control':'public, max-age=30, stale-while-revalidate=120'}});
  }catch(error){
    console.error('market_printing_listings_unavailable',error instanceof Error?error.message:error);
    return Response.json({error:'Active listings could not be loaded.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
