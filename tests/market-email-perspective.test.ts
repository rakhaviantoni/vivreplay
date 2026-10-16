import assert from 'node:assert/strict';
import test from 'node:test';
import {orderEmailPerspectiveLine} from '../lib/market/order-email-perspective';

test('order completion emails use the recipient’s buyer or seller perspective',()=>{
  const buyer=orderEmailPerspectiveLine({event:'order-auto-completed',locale:'en',recipientRole:'buyer'});
  const seller=orderEmailPerspectiveLine({event:'order-auto-completed',locale:'en',recipientRole:'seller'});
  assert.match(buyer??'',/added to your Vault/);
  assert.match(seller??'',/buyer’s Vault/);
  assert.match(seller??'',/sale proceeds/);
  assert.notEqual(buyer,seller);
});

test('unpaid cancellation copy identifies who cancelled and what happens to the cards',()=>{
  const buyerGetsSellerCancellation=orderEmailPerspectiveLine({event:'order-cancelled',locale:'en',recipientRole:'buyer',actorRole:'seller',participant:'Billrock'});
  const sellerGetsBuyerCancellation=orderEmailPerspectiveLine({event:'order-cancelled',locale:'en',recipientRole:'seller',actorRole:'buyer',participant:'Rakha'});
  assert.match(buyerGetsSellerCancellation??'',/seller, Billrock, cancelled/);
  assert.match(buyerGetsSellerCancellation??'',/no longer reserved for you/);
  assert.match(sellerGetsBuyerCancellation??'',/buyer, Rakha, cancelled/);
  assert.match(sellerGetsBuyerCancellation??'',/Your cards are available again/);
});

test('expired orders distinguish the buyer from the seller in English and Indonesian',()=>{
  const buyerEn=orderEmailPerspectiveLine({event:'order-expired',locale:'en',recipientRole:'buyer'});
  const sellerEn=orderEmailPerspectiveLine({event:'order-expired',locale:'en',recipientRole:'seller'});
  const buyerId=orderEmailPerspectiveLine({event:'order-expired',locale:'id',recipientRole:'buyer'});
  const sellerId=orderEmailPerspectiveLine({event:'order-expired',locale:'id',recipientRole:'seller'});
  assert.match(buyerEn??'',/no longer reserved for you/);
  assert.match(sellerEn??'',/your cards are available again/);
  assert.match(buyerId??'',/tidak lagi dipesan untuk Anda/);
  assert.match(sellerId??'',/kartu Anda kembali tersedia/);
});

test('dispute resolution calls refunds from each recipient’s point of view',()=>{
  const buyer=orderEmailPerspectiveLine({event:'order-dispute-resolved',locale:'en',recipientRole:'buyer',decision:'PARTIAL_REFUND',refund:'IDR 75,000'});
  const seller=orderEmailPerspectiveLine({event:'order-dispute-resolved',locale:'en',recipientRole:'seller',decision:'PARTIAL_REFUND',refund:'IDR 75,000'});
  assert.match(buyer??'',/Your refund: IDR 75,000/);
  assert.match(seller??'',/Buyer refund: IDR 75,000/);
  assert.notEqual(buyer,seller);
});
