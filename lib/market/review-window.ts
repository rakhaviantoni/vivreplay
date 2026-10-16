export const MARKET_REVIEW_WINDOW_MS=48*60*60*1000;

export function marketReviewRemainingMs(deliveredAt:string|null,now=Date.now()):number|null{
  if(!deliveredAt)return null;
  const timestamp=Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(deliveredAt)?deliveredAt:`${deliveredAt.replace(' ','T')}Z`);
  if(!Number.isFinite(timestamp))return null;
  return Math.max(0,timestamp+MARKET_REVIEW_WINDOW_MS-now);
}
