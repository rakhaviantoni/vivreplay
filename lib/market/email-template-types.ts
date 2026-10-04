export type MarketEmailEvent='new-offer'|'counteroffer'|'accepted'|'declined'|'message'|'photo-request'|'photo-shared'|'order-paid'|'order-seller-paid'|'order-received';

export const marketEmailEvents:MarketEmailEvent[]=['new-offer','counteroffer','accepted','declined','message','photo-request','photo-shared','order-paid','order-seller-paid','order-received'];

export const marketEmailLabels:Record<MarketEmailEvent,string>={
  'new-offer':'New offer received',counteroffer:'Counteroffer received',accepted:'Offer accepted',declined:'Offer declined',message:'Conversation message','photo-request':'Card photos requested','photo-shared':'Card photos shared','order-paid':'Buyer · Payment confirmed','order-seller-paid':'Seller · Order paid','order-received':'Delivery confirmed',
};
