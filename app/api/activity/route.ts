import {db,errorResponse,user} from '@/lib/server/store';

type Activity={id:string;kind:string;createdAt:string;title:string;description:string};

export async function GET(){
  try{
    const profile=await user();
    const database=db();
    const [audit,listings,offers,orders]=await Promise.all([
      database.prepare(`SELECT a.id,a.action,a.created_at AS createdAt,c.type,c.quantity,c.condition,i.code,i.name,
          g.grade,g.certification,gp.short_name AS gradingProvider
        FROM audit_logs a LEFT JOIN collectible_instances c ON c.id=a.entity_id
        LEFT JOIN graded_cards g ON g.instance_id=c.id
        LEFT JOIN grading_providers gp ON gp.id=g.provider_id
        LEFT JOIN card_printings p ON p.id=c.printing_id LEFT JOIN card_identities i ON i.id=p.identity_id
        WHERE a.actor_id=? AND a.action IN ('COLLECTIBLE_CREATED','COLLECTIBLE_UPDATED')
        ORDER BY a.created_at DESC LIMIT 60`).bind(profile.id).all<{id:string;action:string;createdAt:string;type:string|null;quantity:number|null;condition:string|null;code:string|null;name:string|null;grade:string|null;certification:string|null;gradingProvider:string|null}>(),
      database.prepare(`SELECT id,title,amount,currency,status,created_at AS createdAt FROM listings WHERE seller_id=? ORDER BY created_at DESC LIMIT 60`).bind(profile.id).all<{id:string;title:string;amount:number;currency:string;status:string;createdAt:string}>(),
      database.prepare(`SELECT o.id,o.amount,o.currency,o.status,o.created_at AS createdAt,l.title,l.seller_id AS sellerId
        FROM listing_offers o JOIN listings l ON l.id=o.listing_id
        WHERE l.seller_id=? OR o.actor_id=? ORDER BY o.created_at DESC LIMIT 60`).bind(profile.id,profile.id).all<{id:string;amount:number;currency:string;status:string;createdAt:string;title:string;sellerId:string}>(),
      database.prepare(`SELECT id,kind,status,amount,currency,created_at AS createdAt FROM checkout_orders
        WHERE buyer_id=? OR seller_id=? ORDER BY created_at DESC LIMIT 60`).bind(profile.id,profile.id).all<{id:string;kind:string;status:string;amount:number;currency:string;createdAt:string}>(),
    ]);
    const money=(amount:number,currency:string)=>new Intl.NumberFormat(profile.locale==='id'?'id-ID':'en-US',{style:'currency',currency:currency||profile.currency||'IDR',maximumFractionDigits:0}).format(amount);
    const activities:Activity[]=[
      ...audit.results.map(row=>{
        const graded=row.type==='GRADED';
        const created=row.action==='COLLECTIBLE_CREATED';
        const cardName=row.name??'card';
        const grade=[row.gradingProvider,row.grade].filter(Boolean).join(' ');
        const certificate=row.certification?`Certificate #${row.certification}`:'';
        return{
          id:`audit:${row.id}`,
          kind:graded?'slab':'vault',
          createdAt:row.createdAt,
          title:graded?(created?'Slab added to Vault':'Slab updated'):(created?'Raw card added to Vault':'Raw card updated'),
          description:graded
            ? [grade?`${cardName} graded ${grade}`:cardName,certificate].filter(Boolean).join('. ')
            : `${row.quantity??1} ${row.quantity===1?'copy':'copies'} of ${cardName}${row.condition?` in ${row.condition} condition`:''}.`,
        };
      }),
      ...listings.results.map(row=>({id:`listing:${row.id}`,kind:'market',createdAt:row.createdAt,title:row.status==='SOLD'?'Listing sold':'Listed on Market',description:`${row.title} is ${row.status.toLowerCase()} at ${money(row.amount,row.currency)}.`})),
      ...offers.results.map(row=>({id:`offer:${row.id}`,kind:'offer',createdAt:row.createdAt,title:row.sellerId===profile.id?'Offer received':'Offer sent',description:`${row.status.toLowerCase()} offer for ${row.title}, ${money(row.amount,row.currency)}.`})),
      ...orders.results.map(row=>({id:`order:${row.id}`,kind:'order',createdAt:row.createdAt,title:row.kind==='PRO'?'Market Pro order':'Market order',description:`${row.status.toLowerCase().replaceAll('_',' ')} for ${money(row.amount,row.currency)}.`})),
    ].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100);
    return Response.json({activities},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
