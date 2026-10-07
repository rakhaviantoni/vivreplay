export type MarketEmailEvent='wishlist-match'|'price-drop'|'new-offer'|'counteroffer'|'accepted'|'declined'|'message'|'photo-request'|'photo-shared'|'order-paid'|'order-seller-paid'|'order-shipped'|'order-tracking'|'order-received'|'order-cancelled'|'order-expired';

export const marketEmailEvents:MarketEmailEvent[]=['wishlist-match','price-drop','new-offer','counteroffer','accepted','declined','message','photo-request','photo-shared','order-paid','order-seller-paid','order-shipped','order-tracking','order-received','order-cancelled','order-expired'];

export const marketEmailLabels:Record<MarketEmailEvent,string>={
  'wishlist-match':'Wishlist: matching listing','price-drop':'Saved listing: price drop',
  'new-offer':'New offer received',counteroffer:'Counteroffer received',accepted:'Offer accepted',declined:'Offer declined',message:'Conversation message','photo-request':'Card photos requested','photo-shared':'Card photos shared','order-paid':'Buyer: payment confirmed','order-seller-paid':'Seller: order paid','order-shipped':'Buyer: shipment sent','order-tracking':'Buyer: shipment status updated','order-received':'Delivery confirmed','order-cancelled':'Unpaid order cancelled','order-expired':'Unpaid order expired',
};
