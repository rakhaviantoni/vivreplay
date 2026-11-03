export const MARKET_ACTIVITY_REWARDS={
  vault_added:{points:1,monthlyLimit:10},
  listing_published:{points:2,monthlyLimit:5},
  offer_replied:{points:1,monthlyLimit:10},
  order_completed:{points:5,monthlyLimit:20},
} as const;

export type MarketActivityAction=keyof typeof MARKET_ACTIVITY_REWARDS;
