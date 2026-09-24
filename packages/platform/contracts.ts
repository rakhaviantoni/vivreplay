export type ShareEntityType='PLAYER'|'DECK'|'MATCH'|'REPLAY'|'TOURNAMENT'|'COLLECTION'|'SET_COMPLETION'|'SLAB'|'MARKET_LISTING'|'META_MATCHUP'|'ACHIEVEMENT';
export interface ShareEntity {type:ShareEntityType;id:string;canonicalPath:string;title:string;description:string;previewImage?:string;visibility:'private'|'public';ownerId:string}
export function canShare(entity:ShareEntity,viewerId?:string){return entity.visibility==='public'||entity.ownerId===viewerId}
export type PaymentCapability='digitalGoods'|'physicalGoods'|'marketplace'|'splitPayment'|'subMerchant'|'escrow'|'QRIS'|'VA'|'eWallet'|'cards'|'refunds'|'payout';
export interface PaymentProvider {id:string;capabilities:ReadonlySet<PaymentCapability>;createCheckout(orderId:string):Promise<{url:string}>;getPaymentStatus(paymentId:string):Promise<string>;verifyWebhook(rawBody:string,signature:string):Promise<boolean>;refund(paymentId:string,amount:number):Promise<void>}
export type OrderStatus='PENDING_PAYMENT'|'PAID'|'SELLER_CONFIRMING'|'READY_TO_SHIP'|'SHIPPED'|'DELIVERED'|'COMPLETED'|'DISPUTED'|'CANCELLED'|'REFUNDED';
export interface FeeRule{percentage:number;fixedAmount:number;minimum?:number;maximum?:number;payer:'buyer'|'seller'|'split'}
export interface MatchReference {id:string;gameId:string;deckVersionIds:readonly[string,string];engineVersion:string;rulesVersion:string;cardDataVersion:string;banlistVersion:string;format:string}
export interface TournamentReference {id:string;gameId:string;format:string;timezone:string}
