import test from 'node:test';
import assert from 'node:assert/strict';
import {convertMoney,minListingUnitAmount,normalizeMarketCurrency,normalizeTradeScope,tradeScopeBadgeLabel} from '../lib/market/global';
import {verifyPolarWebhookSignature} from '../lib/server/polar';

test('global market helpers convert IDR and USD cents cleanly',()=>{
  assert.equal(convertMoney(160_000,'IDR','USD',16_000),1_000); // $10.00 = 1000 cents
  assert.equal(convertMoney(1_000,'USD','IDR',16_000),160_000);
  assert.equal(convertMoney(50_000,'IDR','IDR',16_000),50_000);
  assert.equal(normalizeTradeScope('BOTH'),'BOTH');
  assert.equal(normalizeTradeScope('GLOBAL_ONLY'),'GLOBAL_ONLY');
  assert.equal(normalizeTradeScope('invalid'),'ID_ONLY');
  assert.equal(normalizeMarketCurrency('USD'),'USD');
  assert.equal(normalizeMarketCurrency('EUR'),'IDR');
  assert.equal(minListingUnitAmount('USD'),100);
  assert.equal(minListingUnitAmount('IDR'),1000);
  assert.equal(tradeScopeBadgeLabel('ID_ONLY','EN'),null);
  assert.equal(tradeScopeBadgeLabel('GLOBAL_ONLY','EN'),'Global');
  assert.equal(tradeScopeBadgeLabel('BOTH','EN'),'ID + Global');
});

test('Polar webhook HMAC-SHA256 signature verification validates authentic requests and rejects tampered ones',async()=>{
  const rawSecret='polar_test_secret_32_bytes_minimum_ok';
  const b64Secret=Buffer.from(rawSecret,'utf8').toString('base64');
  const webhookSecret=`whsec_${b64Secret}`;
  const webhookId='msg_test_123';
  const webhookTimestamp=String(Math.floor(Date.now()/1000));
  const body=JSON.stringify({type:'order.paid',data:{id:'ord_1',metadata:{orderId:'order-uuid-1'}}});

  const key=await crypto.subtle.importKey('raw',Buffer.from(rawSecret,'utf8'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sigBuf=await crypto.subtle.sign('HMAC',key,Buffer.from(`${webhookId}.${webhookTimestamp}.${body}`,'utf8'));
  const sigB64=Buffer.from(sigBuf).toString('base64');

  const validHeaders=new Headers({
    'webhook-id':webhookId,
    'webhook-timestamp':webhookTimestamp,
    'webhook-signature':`v1,${sigB64}`,
  });
  assert.equal(await verifyPolarWebhookSignature(body,validHeaders,webhookSecret),true);

  // Tampered payload
  assert.equal(await verifyPolarWebhookSignature(`${body} `,validHeaders,webhookSecret),false);

  // Expired timestamp
  const oldHeaders=new Headers({
    'webhook-id':webhookId,
    'webhook-timestamp':String(Math.floor(Date.now()/1000)-1000),
    'webhook-signature':`v1,${sigB64}`,
  });
  assert.equal(await verifyPolarWebhookSignature(body,oldHeaders,webhookSecret),false);
});

test('scheduled auctions validate start time and block early bids', async () => {
  const { validateAuctionBid, validateScheduledStartAt, isAuctionScheduled } = await import('../lib/market/auction');
  const now = Date.now();
  const futureIso = new Date(now + 60 * 60 * 1000).toISOString();
  const tooSoonIso = new Date(now + 60 * 1000).toISOString();

  assert.equal(validateScheduledStartAt(tooSoonIso, now).ok, false);
  assert.equal(validateScheduledStartAt(futureIso, now).ok, true);
  assert.equal(isAuctionScheduled({ startsAt: futureIso, status: 'ACTIVE' }, now), true);
  assert.equal(isAuctionScheduled({ startsAt: futureIso, status: 'ACTIVE' }, now + 2 * 60 * 60 * 1000), false);

  const earlyBid = validateAuctionBid({
    sellerId: 'seller-1',
    bidderId: 'buyer-1',
    status: 'ACTIVE',
    startsAtMs: now + 60 * 60 * 1000,
    endsAtMs: now + 25 * 60 * 60 * 1000,
    nowMs: now,
    startingBid: 100_000,
    currentBid: 0,
    minIncrement: 10_000,
    bidCount: 0,
    highestBidderId: null,
    amount: 100_000,
  });
  assert.equal(earlyBid.ok, false);
  if (!earlyBid.ok) assert.equal(earlyBid.status, 409);
});
