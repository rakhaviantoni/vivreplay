import {notFound} from 'next/navigation';
import Link from 'next/link';
import {db} from '@/lib/server/store';
import {cardFor,printings} from '@/packages/card-data/catalog';
import {formatMoney,Listing} from '@/packages/domain';
import {ShareButton} from '@/components/tcg/share';
import {marketListingPreviews} from '@/lib/market/listing-previews';
import {ListingArtRotator,MarketListingItems,type MarketListingCard} from '@/components/tcg/market-listing-items';
import {MarketStoreNav} from '@/components/tcg/market-store-nav';
import {MarketTimestamp} from '@/components/tcg/market-timestamp';
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
  const isBuying=listing.type==='WTB';
  const status=isBuying?'Buying':'Selling';

  return <><MarketStoreNav/><main className="page live-card-detail market-listing-detail">
    <Link className="back-link" href="/market">← Back to Market</Link>
    <article className="live-detail-layout market-listing-layout">
      <aside className="live-detail-art viewer-primary-art market-listing-primary">
        <ListingArtRotator items={listingCards}/>
      </aside>

      <section className="live-detail-copy market-listing-copy">
        <header className="market-listing-heading">
          <div><p className="eyebrow">{status} · {primary.language} printing{listing.createdAt&&<> · <MarketTimestamp value={listing.createdAt}/></>}</p><h1>{listing.title}</h1></div>
          <span className={`market-listing-status ${isBuying?'is-buying':'is-selling'}`}>{status}</span>
        </header>

        <dl className="market-listing-facts">
          <div><dt>Price</dt><dd>{formatMoney(listing.amount,listing.currency)}</dd></div>
          <div><dt>{isBuying?'Location':'Ships from'}</dt><dd>{listing.city}</dd></div>
          <div><dt>Cards</dt><dd>{cardCount} total</dd></div>
        </dl>

        <section className="market-listing-seller">
          <span>{listing.seller.slice(0,1).toUpperCase()}</span>
          <div><small>{isBuying?'Buyer':'Seller'}</small><strong>{stored?<Link href={`/players/${stored.username}`}>{listing.seller}</Link>:listing.seller}</strong></div>
        </section>

        <MarketListingItems
          items={listingCards}
          currency={listing.currency}
          listingType={listing.type==='WTB'?'WTB':'WTS'}
          listingId={listing.id}
          listingTitle={listing.title}
          listingAmount={formatMoney(listing.amount,listing.currency)}
        />
      </section>
    </article>
  </main></>;
}
