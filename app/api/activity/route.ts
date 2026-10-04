import {db,errorResponse,user} from '@/lib/server/store';

type Activity={id:string;kind:string;createdAt:string;title:string;description:string};

export async function GET(){
  try{
    const profile=await user();
    const database=db();
    const [audit,listings,offers,orders]=await Promise.all([
      database.prepare(`SELECT a.id,a.action,a.created_at AS createdAt,c.quantity,c.condition,i.code,i.name
        FROM audit_logs a LEFT JOIN collectible_instances c ON c.id=a.entity_id
        LEFT JOIN card_printings p ON p.id=c.printing_id LEFT JOIN card_identities i ON i.id=p.identity_id
        WHERE a.actor_id=? AND a.action IN ('COLLECTIBLE_CREATED','COLLECTIBLE_UPDATED')
        ORDER BY a.created_at DESC LIMIT 60`).bind(profile.id).all<{id:string;action:string;createdAt:string;quantity:number|null;condition:string|null;code:string|null;name:string|null}>(),
      database.prepare(`SELECT id,title,amount,currency,status,created_at AS createdAt FROM listings WHERE seller_id=? ORDER BY created_at DESC LIMIT 60`).bind(profile.id).all<{id:string;title:string;amount:number;currency:string;status:string;createdAt:string}>(),
      database.prepare(`SELECT o.id,o.amount,o.currency,o.status,o.created_at AS createdAt,l.title,l.seller_id AS sellerId
        FROM listing_offers o JOIN listings l ON l.id=o.listing_id
        WHERE l.seller_id=? OR o.actor_id=? ORDER BY o.created_at DESC LIMIT 60`).bind(profile.id,profile.id).all<{id:string;amount:number;currency:string;status:string;createdAt:string;title:string;sellerId:string}>(),
      database.prepare(`SELECT id,kind,status,amount,currency,created_at AS createdAt FROM checkout_orders
        WHERE buyer_id=? OR seller_id=? ORDER BY created_at DESC LIMIT 60`).bind(profile.id,profile.id).all<{id:string;kind:string;status:string;amount:number;currency:string;createdAt:string}>(),
    ]);
    const money=(amount:number,currency:string)=>new Intl.NumberFormat(profile.locale==='id'?'id-ID':'en-US',{style:'currency',currency:currency||profile.currency||'IDR',maximumFractionDigits:0}).format(amount);
    const activities:Activity[]=[
      ...audit.results.map(row=>({id:`audit:${row.id}`,kind:'vault',createdAt:row.createdAt,title:row.action==='COLLECTIBLE_CREATED'?'Added to Vault':'Vault card updated',description:`${row.quantity??1}× ${row.name??row.code??'card'}${row.condition?` · ${row.condition}`:''}`})),
      ...listings.results.map(row=>({id:`listing:${row.id}`,kind:'market',createdAt:row.createdAt,title:row.status==='SOLD'?'Listing sold':'Listed on Market',description:`${row.title} · ${money(row.amount,row.currency)} · ${row.status.toLowerCase()}`})),
      ...offers.results.map(row=>({id:`offer:${row.id}`,kind:'offer',createdAt:row.createdAt,title:row.sellerId===profile.id?'Offer received':'Offer sent',description:`${row.title} · ${money(row.amount,row.currency)} · ${row.status.toLowerCase()}`})),
      ...orders.results.map(row=>({id:`order:${row.id}`,kind:'order',createdAt:row.createdAt,title:row.kind==='PRO'?'Market Pro order':'Market order',description:`${money(row.amount,row.currency)} · ${row.status.toLowerCase().replaceAll('_',' ')}`})),
    ].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100);
    return Response.json({activities},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
