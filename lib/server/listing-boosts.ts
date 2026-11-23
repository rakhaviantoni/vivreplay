import {db as database} from './store';
import {MARKET_PRO_MONTHLY_BOOST_CREDITS} from '@/lib/market/boost';

type DB=ReturnType<typeof database>;

let boostSchemaReady=false;

export async function ensureBoostSchema(db:DB){
  if(boostSchemaReady)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS market_listing_boosts (
      listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
      seller_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      order_id TEXT,
      boosted_until TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS market_pro_boost_usage (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      month_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_market_listing_boosts_until ON market_listing_boosts(boosted_until)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_market_pro_boost_usage_month ON market_pro_boost_usage(seller_id,month_key)'),
  ]);
  boostSchemaReady=true;
}

export async function getRemainingProBoostCredits(db:DB,sellerId:string):Promise<number>{
  await ensureBoostSchema(db);
  const monthKey=new Date().toISOString().slice(0,7);
  const row=await db.prepare('SELECT COUNT(*) AS used FROM market_pro_boost_usage WHERE seller_id=? AND month_key=?').bind(sellerId,monthKey).first<{used:number}>();
  return Math.max(0,MARKET_PRO_MONTHLY_BOOST_CREDITS-(Number(row?.used)||0));
}

export async function consumeProBoostCredit(db:DB,params:{listingId:string;sellerId:string}):Promise<string|null>{
  await ensureBoostSchema(db);
  const monthKey=new Date().toISOString().slice(0,7);
  const remaining=await getRemainingProBoostCredits(db,params.sellerId);
  if(remaining<=0)return null;
  const usageId=crypto.randomUUID();
  await db.prepare('INSERT INTO market_pro_boost_usage (id,seller_id,listing_id,month_key) VALUES (?,?,?,?)').bind(usageId,params.sellerId,params.listingId,monthKey).run();
  return activateListingBoost(db,{
    listingId:params.listingId,
    sellerId:params.sellerId,
    planId:'3d',
    days:3,
    orderId:`PRO_CREDIT:${monthKey}:${usageId}`,
  });
}

export async function getActiveBoostMap(db:DB,listingIds:string[]):Promise<Map<string,string>>{
  const map=new Map<string,string>();
  if(!listingIds.length)return map;
  try{
    await ensureBoostSchema(db);
    const nowIso=new Date().toISOString();
    const placeholders=listingIds.map(()=>'?').join(',');
    const rows=await db.prepare(`SELECT listing_id AS listingId,boosted_until AS boostedUntil FROM market_listing_boosts WHERE listing_id IN (${placeholders}) AND boosted_until > ?`).bind(...listingIds,nowIso).all<{listingId:string;boostedUntil:string}>();
    for(const row of rows.results??[]){
      map.set(row.listingId,row.boostedUntil);
    }
  }catch{}
  return map;
}

export async function activateListingBoost(
  db:DB,
  params:{listingId:string;sellerId:string;planId:string;days:number;orderId:string},
):Promise<string>{
  await ensureBoostSchema(db);
  const existing=await db.prepare('SELECT boosted_until AS boostedUntil FROM market_listing_boosts WHERE listing_id=?').bind(params.listingId).first<{boostedUntil:string}>();
  const nowMs=Date.now();
  const existingMs=existing?.boostedUntil?Date.parse(existing.boostedUntil):0;
  const baseMs=Number.isFinite(existingMs)&&existingMs>nowMs?existingMs:nowMs;
  const boostedUntil=new Date(baseMs+Math.max(1,params.days)*24*60*60*1000).toISOString();
  await db.prepare(`INSERT INTO market_listing_boosts (listing_id,seller_id,plan_id,order_id,boosted_until,updated_at)
    VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(listing_id) DO UPDATE SET
      plan_id=excluded.plan_id,
      order_id=excluded.order_id,
      boosted_until=excluded.boosted_until,
      updated_at=CURRENT_TIMESTAMP`).bind(
    params.listingId,
    params.sellerId,
    params.planId,
    params.orderId,
    boostedUntil,
  ).run();
  return boostedUntil;
}
