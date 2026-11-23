import {env} from 'cloudflare:workers';
import {
  computeInitialAuctionEndsAtMs,
  computeMinimumNextBid,
  computeNextAuctionEndsAtMs,
  validateAuctionBid,
  type AuctionBidRecord,
  type AuctionDurationMode,
  type AuctionStatus,
  type AuctionSummary,
  type AuctionWatcher,
} from '@/lib/market/auction';
import {HttpError,db as database} from './store';
import {sendMarketEmail,sendMarketEmailOnce} from './market-notifications';

type DB=ReturnType<typeof database>;

export const DEFAULT_AUCTION_ITEM_KEY='__LOT__';

let schemaInitialized=false;

export async function ensureAuctionSchema(db:DB){
  if(schemaInitialized)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS market_auctions (
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      item_key TEXT NOT NULL DEFAULT '__LOT__',
      seller_id TEXT NOT NULL,
      starting_bid INTEGER NOT NULL,
      buy_now_price INTEGER,
      min_increment INTEGER NOT NULL DEFAULT 10000,
      current_bid INTEGER NOT NULL DEFAULT 0,
      highest_bidder_id TEXT,
      highest_bidder_name TEXT,
      bid_count INTEGER NOT NULL DEFAULT 0,
      duration_mode TEXT NOT NULL DEFAULT 'ROLLING_24H',
      ends_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      winner_order_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (listing_id, item_key)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS market_auction_bids (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      item_key TEXT NOT NULL DEFAULT '__LOT__',
      bidder_id TEXT NOT NULL,
      bidder_name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_market_auction_bids_listing ON market_auction_bids(listing_id,item_key,created_at DESC)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_market_auctions_status_ends ON market_auctions(status,ends_at)'),
  ]);
  await db.prepare('ALTER TABLE market_auctions ADD COLUMN buy_now_price INTEGER').run().catch(()=>undefined);
  await db.prepare('ALTER TABLE market_auctions ADD COLUMN starts_at TEXT').run().catch(()=>undefined);
  await db.prepare(`ALTER TABLE market_auction_bids ADD COLUMN item_key TEXT NOT NULL DEFAULT '__LOT__'`).run().catch(()=>undefined);
  const cols=(await db.prepare('PRAGMA table_info(market_auctions)').all<{name:string}>()).results??[];
  if(!cols.some(col=>col.name==='item_key')){
    await db.batch([
      db.prepare(`CREATE TABLE market_auctions_v2 (
        listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        item_key TEXT NOT NULL DEFAULT '__LOT__',
        seller_id TEXT NOT NULL,
        starting_bid INTEGER NOT NULL,
        buy_now_price INTEGER,
        min_increment INTEGER NOT NULL DEFAULT 10000,
        current_bid INTEGER NOT NULL DEFAULT 0,
        highest_bidder_id TEXT,
        highest_bidder_name TEXT,
        bid_count INTEGER NOT NULL DEFAULT 0,
        duration_mode TEXT NOT NULL DEFAULT 'ROLLING_24H',
        ends_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        winner_order_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (listing_id, item_key)
      )`),
      db.prepare(`INSERT INTO market_auctions_v2 (listing_id,item_key,seller_id,starting_bid,buy_now_price,min_increment,current_bid,highest_bidder_id,highest_bidder_name,bid_count,duration_mode,ends_at,status,winner_order_id,created_at,updated_at)
        SELECT listing_id,'__LOT__',seller_id,starting_bid,buy_now_price,min_increment,current_bid,highest_bidder_id,highest_bidder_name,bid_count,duration_mode,ends_at,status,winner_order_id,created_at,updated_at FROM market_auctions`),
      db.prepare('DROP TABLE market_auctions'),
      db.prepare('ALTER TABLE market_auctions_v2 RENAME TO market_auctions'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_market_auctions_status_ends ON market_auctions(status,ends_at)'),
    ]);
  }
  schemaInitialized=true;
}

export function getAuctionRoomStub(listingId:string,itemKey:string=DEFAULT_AUCTION_ITEM_KEY){
  const ns=env.AUCTION_ROOM;
  if(!ns)return null;
  const roomName=itemKey===DEFAULT_AUCTION_ITEM_KEY?listingId:`${listingId}:${itemKey}`;
  return ns.get(ns.idFromName(roomName));
}

function toSummary(row:{
  listingId:string;
  itemKey?:string|null;
  sellerId:string;
  startingBid:number;
  buyNowPrice?:number|null;
  minIncrement:number;
  currentBid:number;
  highestBidderId:string|null;
  highestBidderName:string|null;
  bidCount:number;
  durationMode:string;
  startsAt?:string|null;
  endsAt:string;
  status:string;
  winnerOrderId?:string|null;
}):AuctionSummary{
  return {
    listingId:row.listingId,
    itemKey:row.itemKey||DEFAULT_AUCTION_ITEM_KEY,
    sellerId:row.sellerId,
    startingBid:Number(row.startingBid)||0,
    buyNowPrice:row.buyNowPrice&&Number(row.buyNowPrice)>0?Number(row.buyNowPrice):null,
    minIncrement:Number(row.minIncrement)||10_000,
    currentBid:Number(row.currentBid)||0,
    highestBidderId:row.highestBidderId??null,
    highestBidderName:row.highestBidderName??null,
    bidCount:Number(row.bidCount)||0,
    durationMode:(row.durationMode==='FIXED'||row.durationMode==='ROLLING_48H'?'ROLLING_48H'===row.durationMode?'ROLLING_48H':'FIXED':'ROLLING_24H') as AuctionDurationMode,
    startsAt:row.startsAt??null,
    endsAt:row.endsAt,
    status:(row.status==='ENDED'||row.status==='CANCELLED'?row.status:'ACTIVE') as AuctionStatus,
    winnerOrderId:row.winnerOrderId??null,
  };
}

export async function createAuctionForListing(
  db:DB,
  params:{
    listingId:string;
    itemKey?:string;
    sellerId:string;
    startingBid:number;
    buyNowPrice?:number|null;
    minIncrement:number;
    durationMode:AuctionDurationMode;
    fixedHours?:number;
    fixedEndsAt?:string;
    startsAt?:string|null;
  },
):Promise<AuctionSummary>{
  await ensureAuctionSchema(db);
  const itemKey=params.itemKey||DEFAULT_AUCTION_ITEM_KEY;
  const nowMs=Date.now();
  const parsedStartMs=params.startsAt?Date.parse(params.startsAt):NaN;
  const startsAt=Number.isFinite(parsedStartMs)&&parsedStartMs>nowMs?new Date(parsedStartMs).toISOString():null;
  const anchorMs=startsAt?parsedStartMs:nowMs;
  const endsAtMs=computeInitialAuctionEndsAtMs(params.durationMode,anchorMs,params.fixedHours,params.fixedEndsAt);
  const endsAt=new Date(endsAtMs).toISOString();
  const startingBid=Math.max(100,Math.round(params.startingBid));
  const buyNowPrice=params.buyNowPrice&&params.buyNowPrice>startingBid?Math.round(params.buyNowPrice):null;
  const minIncrement=Math.max(50,Math.round(params.minIncrement));

  await db.prepare(`INSERT INTO market_auctions (listing_id,item_key,seller_id,starting_bid,buy_now_price,min_increment,current_bid,highest_bidder_id,highest_bidder_name,bid_count,duration_mode,starts_at,ends_at,status)
    VALUES (?,?,?,?,?,?,0,NULL,NULL,0,?,?,?,'ACTIVE')`).bind(
    params.listingId,
    itemKey,
    params.sellerId,
    startingBid,
    buyNowPrice,
    minIncrement,
    params.durationMode,
    startsAt,
    endsAt,
  ).run();

  const summary:AuctionSummary={
    listingId:params.listingId,
    itemKey,
    sellerId:params.sellerId,
    startingBid,
    buyNowPrice,
    minIncrement,
    currentBid:0,
    highestBidderId:null,
    highestBidderName:null,
    bidCount:0,
    durationMode:params.durationMode,
    startsAt,
    endsAt,
    status:'ACTIVE',
    winnerOrderId:null,
  };

  const stub=getAuctionRoomStub(params.listingId,itemKey);
  if(stub){
    try{
      await stub.fetch('https://auction.internal/init',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({...summary,endsAtMs}),
      });
    }catch(error){
      console.error('auction_room_init_failed',params.listingId,itemKey,error);
    }
  }

  return summary;
}

export async function getAuctionSlotsMap(db:DB,listingIds:string[]):Promise<Map<string,AuctionSummary[]>>{
  const map=new Map<string,AuctionSummary[]>();
  if(!listingIds.length)return map;
  try{
    await ensureAuctionSchema(db);
    const placeholders=listingIds.map(()=>'?').join(',');
    const rows=await db.prepare(`SELECT listing_id AS listingId,item_key AS itemKey,seller_id AS sellerId,starting_bid AS startingBid,buy_now_price AS buyNowPrice,min_increment AS minIncrement,current_bid AS currentBid,highest_bidder_id AS highestBidderId,highest_bidder_name AS highestBidderName,bid_count AS bidCount,duration_mode AS durationMode,starts_at AS startsAt,ends_at AS endsAt,status,winner_order_id AS winnerOrderId
      FROM market_auctions WHERE listing_id IN (${placeholders}) ORDER BY rowid ASC`).bind(...listingIds).all<Parameters<typeof toSummary>[0]>();
    for(const row of rows.results??[]){
      const list=map.get(row.listingId)??[];
      list.push(toSummary(row));
      map.set(row.listingId,list);
    }
  }catch{
    // Degrade gracefully during early migration.
  }
  return map;
}

export async function getAuctionSummaryMap(db:DB,listingIds:string[]):Promise<Map<string,AuctionSummary>>{
  const slots=await getAuctionSlotsMap(db,listingIds);
  const map=new Map<string,AuctionSummary>();
  for(const [id,list] of slots){
    if(list[0])map.set(id,list[0]);
  }
  return map;
}

export async function getAuctionDetail(
  db:DB,
  listingId:string,
  itemKey:string=DEFAULT_AUCTION_ITEM_KEY,
):Promise<{auction:AuctionSummary;bids:AuctionBidRecord[]}|null>{
  await ensureAuctionSchema(db);
  const row=await db.prepare(`SELECT listing_id AS listingId,item_key AS itemKey,seller_id AS sellerId,starting_bid AS startingBid,buy_now_price AS buyNowPrice,min_increment AS minIncrement,current_bid AS currentBid,highest_bidder_id AS highestBidderId,highest_bidder_name AS highestBidderName,bid_count AS bidCount,duration_mode AS durationMode,starts_at AS startsAt,ends_at AS endsAt,status,winner_order_id AS winnerOrderId
    FROM market_auctions WHERE listing_id=? AND item_key=?`).bind(listingId,itemKey).first<Parameters<typeof toSummary>[0]>();
  if(!row)return null;
  let auction=toSummary(row);
  const endsAtMs=Date.parse(auction.endsAt);
  if(auction.status==='ACTIVE'&&Number.isFinite(endsAtMs)&&Date.now()>=endsAtMs){
    auction=await finalizeAuction(db,listingId,itemKey)??auction;
  }
  const bidsResult=await db.prepare(`SELECT b.id,b.listing_id AS listingId,b.item_key AS itemKey,b.bidder_id AS bidderId,b.bidder_name AS bidderName,p.username AS bidderUsername,
      EXISTS(SELECT 1 FROM seller_social_connections sc WHERE sc.seller_id=b.bidder_id) AS bidderVerified,
      b.amount,b.created_at AS createdAt
    FROM market_auction_bids b
    LEFT JOIN profiles p ON p.id=b.bidder_id
    WHERE b.listing_id=? AND b.item_key=?
    ORDER BY b.amount DESC,b.created_at DESC
    LIMIT 30`).bind(listingId,itemKey).all<AuctionBidRecord&{bidderVerified?:number|boolean}>();
  return {auction,bids:(bidsResult.results??[]).map(row=>({...row,bidderVerified:Boolean(row.bidderVerified)}))};
}

export async function getAuctionSlotsDetail(
  db:DB,
  listingId:string,
):Promise<Array<{auction:AuctionSummary;bids:AuctionBidRecord[]}>>{
  await ensureAuctionSchema(db);
  const rows=(await db.prepare(`SELECT listing_id AS listingId,item_key AS itemKey,seller_id AS sellerId,starting_bid AS startingBid,buy_now_price AS buyNowPrice,min_increment AS minIncrement,current_bid AS currentBid,highest_bidder_id AS highestBidderId,highest_bidder_name AS highestBidderName,bid_count AS bidCount,duration_mode AS durationMode,starts_at AS startsAt,ends_at AS endsAt,status,winner_order_id AS winnerOrderId
    FROM market_auctions WHERE listing_id=? ORDER BY rowid ASC`).bind(listingId).all<Parameters<typeof toSummary>[0]>()).results??[];
  const out:Array<{auction:AuctionSummary;bids:AuctionBidRecord[]}>=[];
  for(const row of rows){
    const key=row.itemKey||DEFAULT_AUCTION_ITEM_KEY;
    const detail=await getAuctionDetail(db,listingId,key);
    if(detail)out.push(detail);
  }
  return out;
}

export async function getAuctionWatchers(db:DB,listingId:string):Promise<AuctionWatcher[]>{
  const res=await db.prepare(`SELECT s.owner_id AS userId,
      COALESCE(NULLIF(TRIM(p.display_name),''),p.username,'Collector') AS name,
      p.username,
      EXISTS(SELECT 1 FROM seller_social_connections sc WHERE sc.seller_id=s.owner_id) AS verified,
      s.created_at AS createdAt
    FROM market_saved_listings s
    JOIN profiles p ON p.id=s.owner_id
    WHERE s.listing_id=?
    ORDER BY s.created_at DESC
    LIMIT 30`).bind(listingId).all<AuctionWatcher&{verified?:number|boolean}>().catch(()=>({results:[]}));
  return (res.results??[]).map(row=>({...row,verified:Boolean(row.verified)}));
}

async function syncListingSummaryAfterAuctionChange(db:DB,listingId:string){
  const slots=(await db.prepare(`SELECT status,starting_bid AS startingBid,current_bid AS currentBid,bid_count AS bidCount,ends_at AS endsAt,highest_bidder_id AS highestBidderId
    FROM market_auctions WHERE listing_id=?`).bind(listingId).all<{status:string;startingBid:number;currentBid:number;bidCount:number;endsAt:string;highestBidderId:string|null}>()).results??[];
  if(!slots.length)return;
  const active=slots.filter(s=>s.status==='ACTIVE');
  if(active.length>0){
    const minPrice=Math.min(...active.map(s=>s.bidCount>0?s.currentBid:s.startingBid));
    const maxEndsAt=active.map(s=>s.endsAt).sort().at(-1)??active[0].endsAt;
    await db.prepare(`UPDATE listings SET amount=?,expires_at=? WHERE id=?`).bind(minPrice,maxEndsAt,listingId).run();
    return;
  }
  const hasWinner=slots.some(s=>Boolean(s.highestBidderId&&s.bidCount>0));
  const bestAmount=Math.max(...slots.map(s=>s.bidCount>0?s.currentBid:s.startingBid));
  await db.prepare(`UPDATE listings SET amount=?,status=? WHERE id=? AND status='ACTIVE'`).bind(bestAmount,hasWinner?'RESERVED':'EXPIRED',listingId).run();
}

export async function placeAuctionBid(
  db:DB,
  params:{listingId:string;itemKey?:string;bidderId:string;bidderName:string;amount:number},
):Promise<{auction:AuctionSummary;bid:AuctionBidRecord}>{
  await ensureAuctionSchema(db);
  const itemKey=params.itemKey||DEFAULT_AUCTION_ITEM_KEY;
  const row=await db.prepare(`SELECT listing_id AS listingId,item_key AS itemKey,seller_id AS sellerId,starting_bid AS startingBid,buy_now_price AS buyNowPrice,min_increment AS minIncrement,current_bid AS currentBid,highest_bidder_id AS highestBidderId,highest_bidder_name AS highestBidderName,bid_count AS bidCount,duration_mode AS durationMode,starts_at AS startsAt,ends_at AS endsAt,status,winner_order_id AS winnerOrderId
    FROM market_auctions WHERE listing_id=? AND item_key=?`).bind(params.listingId,itemKey).first<Parameters<typeof toSummary>[0]>();
  if(!row)throw new HttpError(404,'Auction not found.');
  const current=toSummary(row);
  if(current.startsAt&&Date.parse(current.startsAt)>Date.now()){
    throw new HttpError(409,'This auction has not started yet.');
  }
  const prevHighestBidderId=current.highestBidderId;
  const bidId=crypto.randomUUID();
  const stub=getAuctionRoomStub(params.listingId,itemKey);

  let nextAuction:AuctionSummary;
  let bid:AuctionBidRecord;

  if(stub){
    const stateCheck=await stub.fetch('https://auction.internal/state');
    if(stateCheck.status===404){
      await stub.fetch('https://auction.internal/init',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({...current,endsAtMs:Date.parse(current.endsAt)}),
      });
    }
    const doResponse=await stub.fetch('https://auction.internal/bid',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        bidId,
        bidderId:params.bidderId,
        bidderName:params.bidderName,
        amount:params.amount,
      }),
    });
    const doPayload=await doResponse.json() as {ok?:boolean;error?:string;state?:AuctionSummary&{endsAtMs?:number};bid?:AuctionBidRecord};
    if(!doResponse.ok||!doPayload.ok||!doPayload.state||!doPayload.bid){
      throw new HttpError(doResponse.status>=400?doResponse.status:400,doPayload.error||'Could not place bid.');
    }
    const nextState=doPayload.state;
    bid={...doPayload.bid,itemKey};
    await db.batch([
      db.prepare(`INSERT INTO market_auction_bids (id,listing_id,item_key,bidder_id,bidder_name,amount,created_at) VALUES (?,?,?,?,?,?,?)`)
        .bind(bid.id,params.listingId,itemKey,bid.bidderId,bid.bidderName,bid.amount,bid.createdAt),
      db.prepare(`UPDATE market_auctions SET current_bid=?,highest_bidder_id=?,highest_bidder_name=?,bid_count=?,ends_at=?,updated_at=CURRENT_TIMESTAMP WHERE listing_id=? AND item_key=?`)
        .bind(nextState.currentBid,nextState.highestBidderId,nextState.highestBidderName,nextState.bidCount,nextState.endsAt,params.listingId,itemKey),
    ]);
    await syncListingSummaryAfterAuctionChange(db,params.listingId);
    nextAuction=toSummary({...nextState,itemKey});
  }else{
    const nowMs=Date.now();
    const endsAtMs=Date.parse(current.endsAt);
    const check=validateAuctionBid({
      sellerId:current.sellerId,
      bidderId:params.bidderId,
      status:current.status,
      endsAtMs,
      nowMs,
      startingBid:current.startingBid,
      currentBid:current.currentBid,
      minIncrement:current.minIncrement,
      bidCount:current.bidCount,
      highestBidderId:current.highestBidderId,
      amount:params.amount,
    });
    if(!check.ok)throw new HttpError(check.status,check.error);

    const amount=Math.round(params.amount);
    const nextEndsAtMs=computeNextAuctionEndsAtMs(current.durationMode,nowMs,endsAtMs);
    const nextEndsAt=new Date(nextEndsAtMs).toISOString();
    const createdAt=new Date(nowMs).toISOString();
    const nextBidCount=current.bidCount+1;

    const updateRes=await db.prepare(`UPDATE market_auctions SET current_bid=?,highest_bidder_id=?,highest_bidder_name=?,bid_count=?,ends_at=?,updated_at=CURRENT_TIMESTAMP
      WHERE listing_id=? AND item_key=? AND status='ACTIVE' AND bid_count=?`).bind(
      amount,
      params.bidderId,
      params.bidderName,
      nextBidCount,
      nextEndsAt,
      params.listingId,
      itemKey,
      current.bidCount,
    ).run();
    if(!updateRes.meta.changes){
      throw new HttpError(409,'Someone else just placed a higher bid. Refresh and try again.');
    }
    await db.prepare(`INSERT INTO market_auction_bids (id,listing_id,item_key,bidder_id,bidder_name,amount,created_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(bidId,params.listingId,itemKey,params.bidderId,params.bidderName,amount,createdAt).run();
    await syncListingSummaryAfterAuctionChange(db,params.listingId);
    nextAuction={
      ...current,
      currentBid:amount,
      highestBidderId:params.bidderId,
      highestBidderName:params.bidderName,
      bidCount:nextBidCount,
      endsAt:nextEndsAt,
    };
    bid={
      id:bidId,
      listingId:params.listingId,
      itemKey,
      bidderId:params.bidderId,
      bidderName:params.bidderName,
      amount,
      createdAt,
    };
  }

  const listingRow=await db.prepare('SELECT title FROM listings WHERE id=?').bind(params.listingId).first<{title:string}>().catch(()=>null);
  const title=listingRow?.title||'Auction listing';
  await Promise.all([
    sendMarketEmail(current.sellerId,'auction-bid-placed',title,params.listingId,{amount:bid.amount,currency:'IDR',participant:params.bidderName,expiresAt:nextAuction.endsAt}).catch(()=>false),
    prevHighestBidderId&&prevHighestBidderId!==params.bidderId
      ?sendMarketEmail(prevHighestBidderId,'auction-outbid',title,params.listingId,{amount:bid.amount,currency:'IDR',expiresAt:nextAuction.endsAt}).catch(()=>false)
      :Promise.resolve(false),
  ]);

  return {auction:nextAuction,bid};
}

export async function finalizeAuction(
  db:DB,
  listingId:string,
  itemKey:string=DEFAULT_AUCTION_ITEM_KEY,
):Promise<AuctionSummary|null>{
  await ensureAuctionSchema(db);
  const row=await db.prepare(`SELECT listing_id AS listingId,item_key AS itemKey,seller_id AS sellerId,starting_bid AS startingBid,buy_now_price AS buyNowPrice,min_increment AS minIncrement,current_bid AS currentBid,highest_bidder_id AS highestBidderId,highest_bidder_name AS highestBidderName,bid_count AS bidCount,duration_mode AS durationMode,starts_at AS startsAt,ends_at AS endsAt,status,winner_order_id AS winnerOrderId
    FROM market_auctions WHERE listing_id=? AND item_key=?`).bind(listingId,itemKey).first<Parameters<typeof toSummary>[0]>();
  if(!row)return null;
  if(row.status!=='ACTIVE')return toSummary(row);

  const hasWinner=Boolean(row.highestBidderId&&Number(row.bidCount)>0);
  await db.prepare(`UPDATE market_auctions SET status='ENDED',updated_at=CURRENT_TIMESTAMP WHERE listing_id=? AND item_key=? AND status='ACTIVE'`).bind(listingId,itemKey).run();
  await syncListingSummaryAfterAuctionChange(db,listingId);

  const listingRow=await db.prepare('SELECT title FROM listings WHERE id=?').bind(listingId).first<{title:string}>().catch(()=>null);
  const title=listingRow?.title||'Auction listing';
  await Promise.all([
    hasWinner&&row.highestBidderId
      ?sendMarketEmailOnce(row.highestBidderId,'auction-won',title,listingId,`auction-won-${listingId}-${itemKey}`,{amount:Number(row.currentBid)||0,currency:'IDR'}).catch(()=>false)
      :Promise.resolve(false),
    sendMarketEmailOnce(row.sellerId,'auction-ended-seller',title,listingId,`auction-ended-seller-${listingId}-${itemKey}`,{amount:hasWinner?Number(row.currentBid)||0:undefined,currency:'IDR',participant:row.highestBidderName??undefined}).catch(()=>false),
  ]);

  return {
    ...toSummary(row),
    status:'ENDED',
  };
}

export async function buyOutAuction(
  db:DB,
  params:{listingId:string;itemKey?:string;buyerId:string;buyerName:string},
):Promise<{auction:AuctionSummary}>{
  await ensureAuctionSchema(db);
  const itemKey=params.itemKey||DEFAULT_AUCTION_ITEM_KEY;
  const row=await db.prepare(`SELECT listing_id AS listingId,item_key AS itemKey,seller_id AS sellerId,starting_bid AS startingBid,buy_now_price AS buyNowPrice,min_increment AS minIncrement,current_bid AS currentBid,highest_bidder_id AS highestBidderId,highest_bidder_name AS highestBidderName,bid_count AS bidCount,duration_mode AS durationMode,starts_at AS startsAt,ends_at AS endsAt,status,winner_order_id AS winnerOrderId
    FROM market_auctions WHERE listing_id=? AND item_key=?`).bind(params.listingId,itemKey).first<Parameters<typeof toSummary>[0]>();
  if(!row)throw new HttpError(404,'Auction not found.');
  const current=toSummary(row);
  if(current.startsAt&&Date.parse(current.startsAt)>Date.now())throw new HttpError(409,'This auction has not started yet.');
  if(current.status!=='ACTIVE'||Date.parse(current.endsAt)<=Date.now())throw new HttpError(409,'This auction has already ended.');
  if(params.buyerId===current.sellerId)throw new HttpError(400,'You cannot buy out your own auction.');
  if(!current.buyNowPrice||current.buyNowPrice<=0)throw new HttpError(400,'Buy Out is not enabled for this auction.');
  if(current.currentBid>=current.buyNowPrice)throw new HttpError(409,'Bidding has already reached the Buy Out price.');

  const buyNow=current.buyNowPrice;
  const bidId=crypto.randomUUID();
  const createdAt=new Date().toISOString();
  const updateRes=await db.prepare(`UPDATE market_auctions
    SET current_bid=?,highest_bidder_id=?,highest_bidder_name=?,bid_count=bid_count+1,status='ENDED',updated_at=CURRENT_TIMESTAMP
    WHERE listing_id=? AND item_key=? AND status='ACTIVE'`).bind(buyNow,params.buyerId,params.buyerName,params.listingId,itemKey).run();
  if(!updateRes.meta.changes)throw new HttpError(409,'This auction has already ended.');

  await db.prepare(`INSERT INTO market_auction_bids (id,listing_id,item_key,bidder_id,bidder_name,amount,created_at) VALUES (?,?,?,?,?,?,?)`)
    .bind(bidId,params.listingId,itemKey,params.buyerId,params.buyerName,buyNow,createdAt).run();
  await syncListingSummaryAfterAuctionChange(db,params.listingId);

  const endedAuction:AuctionSummary={
    ...current,
    currentBid:buyNow,
    highestBidderId:params.buyerId,
    highestBidderName:params.buyerName,
    bidCount:current.bidCount+1,
    status:'ENDED',
  };

  const stub=getAuctionRoomStub(params.listingId,itemKey);
  if(stub){
    await stub.fetch('https://auction.internal/init',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({...endedAuction,endsAtMs:Date.now()}),
    }).catch(()=>undefined);
  }

  const listingRow=await db.prepare('SELECT title FROM listings WHERE id=?').bind(params.listingId).first<{title:string}>().catch(()=>null);
  const title=listingRow?.title||'Auction listing';
  await Promise.all([
    sendMarketEmailOnce(params.buyerId,'auction-won',title,params.listingId,`auction-won-${params.listingId}-${itemKey}`,{amount:buyNow,currency:'IDR',participant:params.buyerName}).catch(()=>false),
    sendMarketEmailOnce(current.sellerId,'auction-ended-seller',title,params.listingId,`auction-ended-seller-${params.listingId}-${itemKey}`,{amount:buyNow,currency:'IDR',participant:params.buyerName}).catch(()=>false),
  ]);

  return {auction:endedAuction};
}

export async function settleExpiredAuctions(db:DB):Promise<number>{
  await ensureAuctionSchema(db);
  const expired=(await db.prepare(`SELECT listing_id AS listingId,item_key AS itemKey FROM market_auctions WHERE status='ACTIVE' AND ends_at<=CURRENT_TIMESTAMP LIMIT 100`).all<{listingId:string;itemKey:string}>()).results??[];
  let settled=0;
  for(const row of expired){
    const res=await finalizeAuction(db,row.listingId,row.itemKey).catch(()=>null);
    if(res)settled++;
  }
  return settled;
}

export {computeMinimumNextBid};
