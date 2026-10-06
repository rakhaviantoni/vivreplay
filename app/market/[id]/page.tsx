import {enabledShippingCouriers} from '@/lib/shipping/couriers';
import {notFound} from 'next/navigation';
import {db,optionalUser} from '@/lib/server/store';
import {cardFor,printings,type Card} from '@/packages/card-data/catalog';
import {Listing} from '@/packages/domain';
import {MarketListingDetailView,type MarketListingCard} from '@/components/tcg/market-listing-items';
import {MarketStoreNav} from '@/components/tcg/market-store-nav';
import {pageMetadata} from '@/lib/site-metadata';
import {isListingExpired} from '@/lib/market/policy';
import {getDynamicListingPolicy} from '@/lib/market/policy';

export const dynamic='force-dynamic';

type RawStoredListing = Listing & {
  username: string;
  sellerId: string;
  status: string;
  cardImageUrl?: string;
  cardLanguage?: string;
  cardRarity?: string;
  cardSetCode?: string;
  cardVariant?: string;
  cardIdentityId?: string;
  cardCode?: string;
  cardName?: string;
  cardColor?: string;
  cardType?: string;
  cardCost?: number;
  cardPower?: number;
  cardEffect?: string;
  sellerTier?: string;
  shippingOriginLabel?:string|null;
  itemsJson?:string|null;
};

export async function generateMetadata({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return pageMetadata({title:'Market listing',description:'View this VivrePlay Market listing.',path:`/market/${encodeURIComponent(id)}`});
}

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const [stored, me]=await Promise.all([
    db().prepare(`
      SELECT
        l.id,
        l.printing_id AS printingId,
        l.title,
        l.amount,
        l.currency,
        l.quantity,
        l.condition,
        l.type,
        l.city,
        l.status,
        l.expires_at AS expiresAt,
        l.created_at AS createdAt,
        l.items AS itemsJson,
        l.seller_id AS sellerId,
        p.display_name AS seller,
        p.username,
        p.tier AS sellerTier,
        cp.image_url AS cardImageUrl,
        cp.language AS cardLanguage,
        cp.rarity AS cardRarity,
        cp.set_code AS cardSetCode,
        cp.variant AS cardVariant,
        ci.id AS cardIdentityId,
        ci.code AS cardCode,
        ci.name AS cardName,
        ci.color AS cardColor,
        ci.type AS cardType,
        ci.cost AS cardCost,
        ci.power AS cardPower,
        ci.effect AS cardEffect,
        o.label AS shippingOriginLabel
      FROM listings l
      JOIN profiles p ON p.id=l.seller_id
      LEFT JOIN card_printings cp ON cp.id=l.printing_id
      LEFT JOIN card_identities ci ON ci.id=cp.identity_id
      LEFT JOIN seller_shipping_origins o ON o.owner_id=l.seller_id
      WHERE l.id=?
    `).bind(id).first<RawStoredListing>(),
    optionalUser(),
  ]);

  const listing=stored;
  if(!listing)notFound();
  if(stored?.itemsJson){
    try{
      const parsed=JSON.parse(stored.itemsJson);
      if(Array.isArray(parsed))listing.items=parsed.filter(item=>item&&typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&item.quantity>0);
    }catch{}
  }
  if(stored){
    let methods:string[]=[];
    try{const parsed=JSON.parse(stored.shippingOriginLabel??'null');if(Array.isArray(parsed?.methods))methods=parsed.methods.filter((value:unknown):value is string=>typeof value==='string')}catch{}
    const couriers=new Set(enabledShippingCouriers(methods));
    listing.shippingOptionCount=couriers.size;
    listing.shippingCouriers=[...couriers];
  }

  const isOwner = Boolean(me && stored && me.id === stored.sellerId);
  const renewDurationDays=(await getDynamicListingPolicy(me?.tier??'free',db())).durationDays;
  const initialExpired = stored ? (stored.status !== 'ACTIVE' || isListingExpired(stored.expiresAt)) : false;

  const filenameCode = stored?.cardImageUrl ? stored.cardImageUrl.split('?')[0].split('#')[0].split('/').pop()?.replace(/\.[^.]+$/, '') : undefined;
  const printingCode = filenameCode ?? stored?.cardCode;

  const storedCard = (stored?.cardCode || stored?.cardImageUrl) ? {
    id: stored.cardIdentityId ?? stored.printingId,
    code: stored.cardCode ?? '',
    name: stored.cardName ?? stored.title,
    color: stored.cardColor ?? 'Red',
    type: (stored.cardType as Card['type']|undefined) ?? 'Character',
    cost: stored.cardCost ?? 0,
    power: stored.cardPower ?? 0,
    rarity: stored.cardRarity ?? '',
    art: 0,
    effect: stored.cardEffect ?? '',
    imageUrl: stored.cardImageUrl,
    imageSource: 'external' as const,
    setCode: stored.cardSetCode,
    language: stored.cardLanguage,
    printingCode,
    variant: stored.cardVariant,
  } : undefined;

  const items=listing.items?.length?listing.items:[{printingId:listing.printingId,quantity:listing.quantity,condition:listing.condition,unitAmount:Math.round(listing.amount/listing.quantity)}];
  const extraPrintingIds=items.map(item=>item.printingId).filter(printingId=>printingId!==stored?.printingId);
  const bundleRows=extraPrintingIds.length?await db().prepare(`
    SELECT cp.id AS printingId,cp.image_url AS imageUrl,cp.language,cp.rarity,cp.set_code AS setCode,cp.variant,ci.id AS identityId,ci.code,ci.name,ci.color,ci.type,ci.cost,ci.power,ci.effect
    FROM card_printings cp LEFT JOIN card_identities ci ON ci.id=cp.identity_id
    WHERE cp.id IN (${extraPrintingIds.map(()=>'?').join(',')})
  `).bind(...extraPrintingIds).all<{printingId:string;imageUrl?:string;language:string;rarity?:string;setCode?:string;variant?:string;identityId?:string;code?:string;name?:string;color?:string;type?:string;cost?:number;power?:number;effect?:string}>():{results:[]};
  const bundleCards=new Map(bundleRows.results.map(row=>[row.printingId,{
    id:row.identityId??row.printingId,code:row.code??row.printingId,name:row.name??row.code??listing.title,color:row.color??'Red',type:(row.type as Card['type']|undefined)??'Character',cost:row.cost??0,power:row.power??0,rarity:row.rarity??'',art:0,effect:row.effect??'',imageUrl:row.imageUrl,imageSource:'external' as const,setCode:row.setCode,language:row.language,printingCode:row.code,variant:row.variant,
  }]));
  const bundleLanguages=new Map(bundleRows.results.map(row=>[row.printingId,row.language]));
  const listingCards:MarketListingCard[]=items.flatMap(item=>{
    const card=(item.printingId === stored?.printingId ? storedCard : undefined) ?? bundleCards.get(item.printingId) ?? cardFor(item.printingId);
    const printing=printings.find(candidate=>candidate.id===item.printingId);
    const language=item.printingId===stored?.printingId?stored?.cardLanguage??printing?.language??'EN':bundleLanguages.get(item.printingId)??printing?.language??'EN';
    return card?[{id:item.printingId,card,quantity:item.quantity,condition:item.condition??listing.condition,unitAmount:item.unitAmount??Math.round(listing.amount/listing.quantity),language}]:[];
  });
  const primary=listingCards[0];
  if(!primary)notFound();
  const cardCount=listingCards.reduce((total,item)=>total+item.quantity,0);

  return (
    <>
      <MarketStoreNav initialQuery={primary.card.name} sellHref={`/market?sell=${encodeURIComponent(primary.id)}`}/>
      <MarketListingDetailView
        listing={listing}
        stored={stored}
        listingCards={listingCards}
        primary={primary}
        cardCount={cardCount}
        isOwner={isOwner}
        initialExpired={initialExpired}
        renewDurationDays={renewDurationDays}
      />
    </>
  );
}
