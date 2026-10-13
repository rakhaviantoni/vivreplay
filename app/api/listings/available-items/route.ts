import {user,db,errorResponse} from '@/lib/server/store';

export async function GET(request:Request){
  try{
    const profile=await user();
    const term=(new URL(request.url).searchParams.get('q')??'').trim().slice(0,80).toLowerCase();
    const like=`%${term}%`;
    const rows=await db().prepare(`WITH stock AS (
      SELECT c.id,c.printing_id AS printingId,c.quantity,c.condition,
        COALESCE((SELECT SUM(CASE WHEN l.items IS NULL THEN l.quantity ELSE 0 END) FROM listings l WHERE l.instance_id=c.id AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0)
        + COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM listings l,json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=c.id AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0) AS listedQuantity,
        COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM checkout_orders o,json_each(o.items) entry WHERE json_extract(entry.value,'$.instanceId')=c.id AND o.kind='MARKET' AND (o.status='PROCESSING' OR (o.status='PENDING_PAYMENT' AND o.expires_at>CURRENT_TIMESTAMP))),0) AS reservedQuantity,
        cp.language,cp.variant,cp.printing_code AS printingCode,cp.image_url AS imageUrl,cp.set_code AS setCode,cp.rarity,
        ci.code,ci.name,ci.color,ci.type AS cardType,ci.cost,ci.power,ci.effect
      FROM collectible_instances c JOIN card_printings cp ON cp.id=c.printing_id LEFT JOIN card_identities ci ON ci.id=cp.identity_id
      WHERE c.owner_id=? AND c.type='RAW' AND c.deleted_at IS NULL
    ) SELECT * FROM stock WHERE quantity-listedQuantity-reservedQuantity>0
      AND (?='' OR LOWER(name) LIKE ? OR LOWER(code) LIKE ? OR LOWER(printingCode) LIKE ? OR LOWER(setCode) LIKE ?)
      ORDER BY name,code,language,variant LIMIT 100`).bind(profile.id,term,like,like,like,like).all<{
        id:string;printingId:string;quantity:number;condition:string;listedQuantity:number;reservedQuantity:number;language:string;variant:string;printingCode:string;imageUrl:string|null;setCode:string|null;rarity:string|null;code:string|null;name:string|null;color:string|null;cardType:string|null;cost:number|null;power:number|null;effect:string|null;
      }>();
    return Response.json({items:rows.results.map(item=>({id:item.id,printingId:item.printingId,type:'RAW',quantity:item.quantity-item.listedQuantity-item.reservedQuantity,condition:item.condition,language:item.language,variant:item.variant,printingCode:item.printingCode,card:{id:item.printingId,code:item.code??item.printingCode,name:item.name??item.code??item.printingId,color:item.color??'Red',type:item.cardType??'Character',cost:item.cost??0,power:item.power??0,rarity:item.rarity??'',art:0,effect:item.effect??'',imageUrl:item.imageUrl??undefined,imageSource:'external',setCode:item.setCode??undefined,language:item.language,printingCode:item.printingCode,variant:item.variant}}))},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
