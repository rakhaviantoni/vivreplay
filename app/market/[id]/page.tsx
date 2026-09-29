import {notFound} from 'next/navigation';
import {db,optionalUser} from '@/lib/server/store';
import {cardFor,printings} from '@/packages/card-data/catalog';
import {Listing} from '@/packages/domain';
import {marketListingPreviews} from '@/lib/market/listing-previews';
import {MarketListingDetailView,type MarketListingCard} from '@/components/tcg/market-listing-items';
import {MarketStoreNav} from '@/components/tcg/market-store-nav';
import {pageMetadata} from '@/lib/site-metadata';
import {isListingExpired} from '@/lib/market/policy';

export const dynamic='force-dynamic';

type RawStoredListing = Listing & {
  username: string;
  sellerId: string;
  status: string;
  cardImageUrl?: string;
  cardLanguage?: string;
  cardRarity?: string;
  cardSetCode?: string;
  cardIdentityId?: string;
  cardCode?: string;
  cardName?: string;
  cardColor?: string;
  cardType?: string;
  cardCost?: number;
  cardPower?: number;
  cardEffect?: string;
};

export async function generateMetadata({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const preview=marketListingPreviews.find(item=>item.id===id);
  return pageMetadata({title:preview?`${preview.title} · Market listing`:'Market listing',description:preview?`View this VivrePlay Market listing for ${preview.title}.`:'View this VivrePlay Market listing.',path:`/market/${encodeURIComponent(id)}`});
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
        l.seller_id AS sellerId,
        p.display_name AS seller,
        p.username,
        cp.image_url AS cardImageUrl,
        cp.language AS cardLanguage,
        cp.rarity AS cardRarity,
        cp.set_code AS cardSetCode,
        ci.id AS cardIdentityId,
        ci.code AS cardCode,
        ci.name AS cardName,
        ci.color AS cardColor,
        ci.type AS cardType,
        ci.cost AS cardCost,
        ci.power AS cardPower,
        ci.effect AS cardEffect
      FROM listings l
      JOIN profiles p ON p.id=l.seller_id
      LEFT JOIN card_printings cp ON cp.id=l.printing_id
      LEFT JOIN card_identities ci ON ci.id=cp.identity_id
      WHERE l.id=?
    `).bind(id).first<RawStoredListing>(),
    optionalUser(),
  ]);

  const listing=stored??marketListingPreviews.find(item=>item.id===id);
  if(!listing)notFound();

  const isOwner = Boolean(me && stored && me.id === stored.sellerId);
  const initialExpired = stored ? (stored.status !== 'ACTIVE' || isListingExpired(stored.expiresAt)) : false;

  const storedCard = (stored?.cardCode || stored?.cardImageUrl) ? {
    id: stored.cardIdentityId ?? stored.printingId,
    code: stored.cardCode ?? '',
    name: stored.cardName ?? stored.title,
    color: stored.cardColor ?? 'Red',
    type: (stored.cardType as any) ?? 'Character',
    cost: stored.cardCost ?? 0,
    power: stored.cardPower ?? 0,
    rarity: stored.cardRarity ?? '',
    art: 0,
    effect: stored.cardEffect ?? '',
    imageUrl: stored.cardImageUrl,
    imageSource: 'external' as const,
    setCode: stored.cardSetCode,
    language: stored.cardLanguage,
    printingCode: stored.cardCode,
  } : undefined;

  const items=listing.items?.length?listing.items:[{printingId:listing.printingId,quantity:listing.quantity,condition:listing.condition,unitAmount:Math.round(listing.amount/listing.quantity)}];
  const listingCards:MarketListingCard[]=items.flatMap(item=>{
    const card=cardFor(item.printingId) ?? (item.printingId === stored?.printingId ? storedCard : undefined);
    const printing=printings.find(candidate=>candidate.id===item.printingId);
    const language=stored?.cardLanguage ?? printing?.language ?? 'EN';
    return card?[{id:item.printingId,card,quantity:item.quantity,condition:item.condition??listing.condition,unitAmount:item.unitAmount??Math.round(listing.amount/listing.quantity),language}]:[];
  });
  const primary=listingCards[0];
  if(!primary)notFound();
  const cardCount=listingCards.reduce((total,item)=>total+item.quantity,0);

  return (
    <>
      <MarketStoreNav/>
      <MarketListingDetailView
        listing={listing}
        stored={stored}
        listingCards={listingCards}
        primary={primary}
        cardCount={cardCount}
        isOwner={isOwner}
        initialExpired={initialExpired}
      />
    </>
  );
}
