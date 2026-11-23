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
} from '@/lib/market/auction';
import {HttpError,db as database} from './store';

type DB=ReturnType<typeof database>;

let schemaInitialized=false;

export async function ensureAuctionSchema(db:DB){
  if(schemaInitialized)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS market_auctions (
      listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
      seller_id TEXT NOT NULL,
      starting_bid INTEGER NOT NULL,
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
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS market_auction_bids (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      bidder_id TEXT NOT NULL,
      bidder_name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_market_auction_bids_listing ON market_auction_bids(listing_id,created_at DESC)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_market_auctions_status_ends ON market_auctions(status,ends_at)'),
  ]);
  schemaInitialized=true;
}

export function getAuctionRoomStub(listingId:string){
  const ns=env.AUCTION_ROOM;
  if(!ns)return null;
  return ns.get(ns.idFromName(listingId));
}

function toSummary(row:{
  listingId:string;
  sellerId:string;
  startingBid:number;
  minIncrement:number;
  currentBid:number;
  highestBidderId:string|null;
  highestBidderName:string|null;
  bidCount:number;
  durationMode:string;
  endsAt:string;
  status:string;
  winnerOrderId?:string|null;
}):AuctionSummary{
  return {
    listingId:row.listingId,
    sellerId:row.sellerId,
    startingBid:Number(row.startingBid)||0,
    minIncrement:Number(row.minIncrement)||10_000,
    currentBid:Number(row.currentBid)||0,
    highestBidderId:row.highestBidderId??null,
    highestBidderName:row.highestBidderName??null,
    bidCount:Number(row.bidCount)||0,
    durationMode:(row.durationMode==='FIXED'||row.durationMode==='ROLLING_48H'?'ROLLING_48H'===row.durationMode?'ROLLING_48H':'FIXED':'ROLLING_24H') as AuctionDurationMode,
    endsAt:row.endsAt,
    status:(row.status==='ENDED'||row.status==='CANCELLED'?row.status:'ACTIVE') as AuctionStatus,
    winnerOrderId:row.winnerOrderId??null,
  };
}

export async function createAuctionForListing(
  db:DB,
  params:{
    listingId:string;
    sellerId:string;
    startingBid:number;
    minIncrement:number;
    durationMode:AuctionDurationMode;
    fixedHours?:number;
  },
):Promise<AuctionSummary>{
  await ensureAuctionSchema(db);
  const nowMs=Date.now();
  const endsAtMs=computeInitialAuctionEndsAtMs(params.durationMode,nowMs,params.fixedHours);
  const endsAt=new Date(endsAtMs).toISOString();
  const startingBid=Math.max(1_000,Math.round(params.startingBid));
  const minIncrement=Math.max(1_000,Math.round(params.minIncrement));

  await db.prepare(`INSERT INTO market_auctions (listing_id,seller_id,starting_bid,min_increment,current_bid,highest_bidder_id,highest_bidder_name,bid_count,duration_mode,ends_at,status)
    VALUES (?,?,?,?,0,NULL,NULL,0,?,?,'ACTIVE')`).bind(
    params.listingId,
    params.sellerId,
    startingBid,
    minIncrement,
    params.durationMode,
    endsAt,
  ).run();

  const summary:AuctionSummary={
    listingId:params.listingId,
    sellerId:params.sellerId,
    startingBid,
    minIncrement,
    currentBid:0,
    highestBidderId:null,
    highestBidderName:null,
    bidCount:0,
    durationMode:params.durationMode,
    endsAt,
    status:'ACTIVE',
    winnerOrderId:null,
  };

  const stub=getAuctionRoomStub(params.listingId);
  if(stub){
    try{
      await stub.fetch('https://auction.internal/init',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({...summary,endsAtMs}),
      });
    }catch(error){
      console.error('auction_room_init_failed',params.listingId,error);
    }
  }

  return summary;
}

export async function getAuctionSummaryMap(db:DB,listingIds:string[]):Promise<Map<string,AuctionSummary>>{
  const map=new Map<string,AuctionSummary>();
  if(!listingIds.length)return map;
  try{
    await ensureAuctionSchema(db);
    const placeholders=listingIds.map(()=>'?').join(',');
    const rows=await db.prepare(`SELECT listing_id AS listingId,seller_id AS sellerId,starting_bid AS startingBid,min_increment AS minIncrement,current_bid AS currentBid,highest_bidder_id AS highestBidderId,highest_bidder_name AS highestBidderName,bid_count AS bidCount,duration_mode AS durationMode,ends_at AS endsAt,status,winner_order_id AS winnerOrderId
      FROM market_auctions WHERE listing_id IN (${placeholders})`).bind(...listingIds).all<Parameters<typeof toSummary>[0]>();
    for(const row of rows.results??[]){
      map.set(row.listingId,toSummary(row));
    }
  }catch{
    // If table is unavailable during early migration, degrade gracefully.
  }
  return map;
}

export async function getAuctionDetail(db:DB,listingId:string):Promise<{auction:AuctionSummary;bids:AuctionBidRecord[]}|null>{
  await ensureAuctionSchema(db);
  const row=await db.prepare(`SELECT listing_id AS listingId,seller_id AS sellerId,starting_bid AS startingBid,min_increment AS minIncrement,current_bid AS currentBid,highest_bidder_id AS highestBidderId,highest_bidder_name AS highestBidderName,bid_count AS bidCount,duration_mode AS durationMode,ends_at AS endsAt,status,winner_order_id AS winnerOrderId
    FROM market_auctions WHERE listing_id=?`).bind(listingId).first<Parameters<typeof toSummary>[0]>();
  if(!row)return null;
  let auction=toSummary(row);
  const endsAtMs=Date.parse(auction.endsAt);
  if(auction.status==='ACTIVE'&&Number.isFinite(endsAtMs)&&Date.now()>=endsAtMs){
    auction=await finalizeAuction(db,listingId)??auction;
  }
  const bidsResult=await db.prepare(`SELECT id,listing_id AS listingId,bidder_id AS bidderId,bidder_name AS bidderName,amount,created_at AS createdAt
    FROM market_auction_bids WHERE listing_id=? ORDER BY amount DESC,created_at DESC LIMIT 30`).bind(listingId).all<AuctionBidRecord>();
  return {auction,bids:bidsResult.results??[]};
}

export async function placeAuctionBid(
  db:DB,
  params:{listingId:string;bidderId:string;bidderName:string;amount:number},
):Promise<{auction:AuctionSummary;bid:AuctionBidRecord}>{
  await ensureAuctionSchema(db);
  const row=await db.prepare(`SELECT listing_id AS listingId,seller_id AS sellerId,starting_bid AS startingBid,min_increment AS minIncrement,current_bid AS currentBid,highest_bidder_id AS highestBidderId,highest_bidder_name AS highestBidderName,bid_count AS bidCount,duration_mode AS durationMode,ends_at AS endsAt,status,winner_order_id AS winnerOrderId
    FROM market_auctions WHERE listing_id=?`).bind(params.listingId).first<Parameters<typeof toSummary>[0]>();
  if(!row)throw new HttpError(404,'Auction not found.');
  const current=toSummary(row);
  const bidId=crypto.randomUUID();
  const stub=getAuctionRoomStub(params.listingId);

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
    const bid=doPayload.bid;
    await db.batch([
      db.prepare(`INSERT INTO market_auction_bids (id,listing_id,bidder_id,bidder_name,amount,created_at) VALUES (?,?,?,?,?,?)`)
        .bind(bid.id,params.listingId,bid.bidderId,bid.bidderName,bid.amount,bid.createdAt),
      db.prepare(`UPDATE market_auctions SET current_bid=?,highest_bidder_id=?,highest_bidder_name=?,bid_count=?,ends_at=?,updated_at=CURRENT_TIMESTAMP WHERE listing_id=?`)
        .bind(nextState.currentBid,nextState.highestBidderId,nextState.highestBidderName,nextState.bidCount,nextState.endsAt,params.listingId),
      db.prepare(`UPDATE listings SET amount=?,expires_at=? WHERE id=?`)
        .bind(nextState.currentBid,nextState.endsAt,params.listingId),
    ]);
    return {auction:toSummary(nextState),bid};
  }

  // Fallback atomic D1 update when Durable Object binding is unavailable
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
    WHERE listing_id=? AND status='ACTIVE' AND bid_count=?`).bind(
    amount,
    params.bidderId,
    params.bidderName,
    nextBidCount,
    nextEndsAt,
    params.listingId,
    current.bidCount,
  ).run();
  if(!updateRes.meta.changes){
    throw new HttpError(409,'Someone else just placed a higher bid. Refresh and try again.');
  }
  await db.batch([
    db.prepare(`INSERT INTO market_auction_bids (id,listing_id,bidder_id,bidder_name,amount,created_at) VALUES (?,?,?,?,?,?)`)
      .bind(bidId,params.listingId,params.bidderId,params.bidderName,amount,createdAt),
    db.prepare(`UPDATE listings SET amount=?,expires_at=? WHERE id=?`)
      .bind(amount,nextEndsAt,params.listingId),
  ]);
  return {
    auction:{
      ...current,
      currentBid:amount,
      highestBidderId:params.bidderId,
      highestBidderName:params.bidderName,
      bidCount:nextBidCount,
      endsAt:nextEndsAt,
    },
    bid:{
      id:bidId,
      listingId:params.listingId,
      bidderId:params.bidderId,
      bidderName:params.bidderName,
      amount,
      createdAt,
    },
  };
}

export async function finalizeAuction(db:DB,listingId:string):Promise<AuctionSummary|null>{
  await ensureAuctionSchema(db);
  const row=await db.prepare(`SELECT listing_id AS listingId,seller_id AS sellerId,starting_bid AS startingBid,min_increment AS minIncrement,current_bid AS currentBid,highest_bidder_id AS highestBidderId,highest_bidder_name AS highestBidderName,bid_count AS bidCount,duration_mode AS durationMode,ends_at AS endsAt,status,winner_order_id AS winnerOrderId
    FROM market_auctions WHERE listing_id=?`).bind(listingId).first<Parameters<typeof toSummary>[0]>();
  if(!row)return null;
  if(row.status!=='ACTIVE')return toSummary(row);

  const hasWinner=Boolean(row.highestBidderId&&Number(row.bidCount)>0);
  await db.batch([
    db.prepare(`UPDATE market_auctions SET status='ENDED',updated_at=CURRENT_TIMESTAMP WHERE listing_id=? AND status='ACTIVE'`).bind(listingId),
    db.prepare(`UPDATE listings SET status=? WHERE id=? AND status='ACTIVE'`).bind(hasWinner?'RESERVED':'EXPIRED',listingId),
  ]);

  return {
    ...toSummary(row),
    status:'ENDED',
  };
}

export {computeMinimumNextBid};
