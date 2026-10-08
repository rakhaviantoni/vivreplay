import {db,errorResponse,guard,user} from '@/lib/server/store';
import {z} from 'zod';

const sections=['listings','offers','orders'] as const;
const schema=z.object({section:z.enum(sections)});

export async function GET(){
  try{
    const profile=await user();
    await db().prepare("INSERT OR IGNORE INTO market_activity_reads (profile_id,section,last_seen_at) VALUES (?,'listings',CURRENT_TIMESTAMP),(?,'offers',CURRENT_TIMESTAMP),(?,'orders',CURRENT_TIMESTAMP)").bind(profile.id,profile.id,profile.id).run();
    const reads=(await db().prepare('SELECT section,last_seen_at AS lastSeenAt FROM market_activity_reads WHERE profile_id=?').bind(profile.id).all<{section:string;lastSeenAt:string}>()).results;
    const since=new Map(reads.map(row=>[row.section,row.lastSeenAt]));
    const listingSince=since.get('listings')??'1970-01-01 00:00:00';
    const offerSince=since.get('offers')??'1970-01-01 00:00:00';
    const orderSince=since.get('orders')??'1970-01-01 00:00:00';
    const [listings,offers,orders]=await Promise.all([
      db().prepare(`SELECT COUNT(DISTINCT o.listing_id) AS count FROM listing_offers o JOIN listings l ON l.id=o.listing_id WHERE l.seller_id=? AND o.actor_id<>? AND o.created_at>?`).bind(profile.id,profile.id,listingSince).first<{count:number}>(),
      db().prepare(`SELECT COUNT(DISTINCT thread_id) AS count FROM (
        SELECT COALESCE(thread_id,id) AS thread_id FROM listing_offers WHERE actor_id<>? AND created_at>? AND listing_id IN (SELECT id FROM listings WHERE seller_id=? UNION SELECT listing_id FROM listing_offers WHERE actor_id=?)
        UNION ALL
        SELECT thread_id FROM listing_offer_messages WHERE actor_id<>? AND created_at>? AND thread_id IN (SELECT COALESCE(thread_id,id) FROM listing_offers WHERE actor_id=? UNION SELECT COALESCE(thread_id,id) FROM listing_offers WHERE listing_id IN (SELECT id FROM listings WHERE seller_id=?))
      )`).bind(profile.id,offerSince,profile.id,profile.id,profile.id,offerSince,profile.id,profile.id).first<{count:number}>(),
      db().prepare(`SELECT COUNT(*) AS count FROM checkout_orders WHERE kind='MARKET' AND (buyer_id=? OR seller_id=?) AND updated_at>? AND status NOT IN ('FAILED','CANCELLED','EXPIRED')`).bind(profile.id,profile.id,orderSince).first<{count:number}>(),
    ]);
    return Response.json({counts:{listings:listings?.count??0,offers:offers?.count??0,orders:orders?.count??0}},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}

export async function POST(request:Request){
  try{
    guard(request);const profile=await user();const {section}=schema.parse(await request.json());
    await db().prepare('INSERT INTO market_activity_reads (profile_id,section,last_seen_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(profile_id,section) DO UPDATE SET last_seen_at=CURRENT_TIMESTAMP').bind(profile.id,section).run();
    return Response.json({ok:true,section},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}
