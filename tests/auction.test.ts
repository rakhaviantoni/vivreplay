import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {
  computeInitialAuctionEndsAtMs,
  computeMinimumNextBid,
  computeNextAuctionEndsAtMs,
  validateAuctionBid,
  validateFixedAuctionEndsAt,
} from '@/lib/market/auction';

describe('market auction rules',()=>{
  it('computes minimum next bid from starting bid when no bids exist',()=>{
    assert.equal(computeMinimumNextBid({
      startingBid:100_000,
      currentBid:0,
      minIncrement:10_000,
      bidCount:0,
    }),100_000);
  });

  it('computes minimum next bid from current bid + increment when bids exist',()=>{
    assert.equal(computeMinimumNextBid({
      startingBid:100_000,
      currentBid:120_000,
      minIncrement:15_000,
      bidCount:2,
    }),135_000);
  });

  it('extends rolling 24h and 48h auctions from bid timestamp while keeping fixed end time unchanged',()=>{
    const now=1_700_000_000_000;
    const initial=now+10_000;
    assert.equal(computeNextAuctionEndsAtMs('ROLLING_24H',now,initial),now+24*60*60*1000);
    assert.equal(computeNextAuctionEndsAtMs('ROLLING_48H',now,initial),now+48*60*60*1000);
    assert.equal(computeNextAuctionEndsAtMs('FIXED',now,initial),initial);
    assert.equal(computeInitialAuctionEndsAtMs('FIXED',now,72),now+72*60*60*1000);
    const customEnd=new Date(now+5*24*60*60*1000).toISOString();
    assert.equal(computeInitialAuctionEndsAtMs('FIXED',now,undefined,customEnd),Date.parse(customEnd));
    assert.equal(validateFixedAuctionEndsAt(customEnd,now).ok,true);
    assert.equal(validateFixedAuctionEndsAt(new Date(now+10*60*1000).toISOString(),now).ok,false);
  });

  it('validates bids against seller, self-outbid, ended state, and minimum increment',()=>{
    const now=1_700_000_000_000;
    const base={
      sellerId:'seller-1',
      bidderId:'buyer-1',
      status:'ACTIVE' as const,
      endsAtMs:now+60_000,
      nowMs:now,
      startingBid:100_000,
      currentBid:150_000,
      minIncrement:10_000,
      bidCount:2,
      highestBidderId:'buyer-2',
      amount:160_000,
    };

    assert.deepEqual(validateAuctionBid(base),{ok:true,minimumBid:160_000});
    assert.equal(validateAuctionBid({...base,bidderId:'seller-1'}).ok,false);
    assert.equal(validateAuctionBid({...base,highestBidderId:'buyer-1'}).ok,false);
    assert.equal(validateAuctionBid({...base,amount:155_000}).ok,false);
    assert.equal(validateAuctionBid({...base,nowMs:base.endsAtMs}).ok,false);
    assert.equal(validateAuctionBid({...base,status:'ENDED'}).ok,false);
  });
});
