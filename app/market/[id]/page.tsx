import {notFound} from 'next/navigation';
import {db} from '@/lib/server/store';
import {cardFor,printings} from '@/packages/card-data/catalog';
import {Listing} from '@/packages/domain';
import {marketListingPreviews} from '@/lib/market/listing-previews';
import {MarketListingDetailView,type MarketListingCard} from '@/components/tcg/market-listing-items';
import {MarketStoreNav} from '@/components/tcg/market-store-nav';
import {pageMetadata} from '@/lib/site-metadata';

export const dynamic='force-dynamic';

type StoredListing=Listing&{username:string};

export async function generateMetadata({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const preview=marketListingPreviews.find(item=>item.id===id);
  return pageMetadata({title:preview?`${preview.title} · Market listing`:'Market listing',description:preview?`View this VivrePlay Market listing for ${preview.title}.`:'View this VivrePlay Market listing.',path:`/market/${encodeURIComponent(id)}`});
}

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const stored=await db().prepare(`SELECT l.id,l.printing_id AS printingId,l.title,l.amount,l.currency,l.quantity,l.condition,l.type,l.city,p.display_name AS seller,p.username FROM listings l JOIN profiles p ON p.id=l.seller_id WHERE l.id=? AND l.status='ACTIVE'`).bind(id).first<StoredListing>();
  const listing=stored??marketListingPreviews.find(item=>item.id===id);
  if(!listing)notFound();

  const items=listing.items?.length?listing.items:[{printingId:listing.printingId,quantity:listing.quantity,condition:listing.condition,unitAmount:Math.round(listing.amount/listing.quantity)}];
  const listingCards:MarketListingCard[]=items.flatMap(item=>{
    const card=cardFor(item.printingId);
    const printing=printings.find(candidate=>candidate.id===item.printingId);
    return card?[{id:item.printingId,card,quantity:item.quantity,condition:item.condition??listing.condition,unitAmount:item.unitAmount??Math.round(listing.amount/listing.quantity),language:printing?.language??'EN'}]:[];
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
      />
    </>
  );
}
