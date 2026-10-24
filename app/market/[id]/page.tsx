import {withRequestLocale} from '@/lib/with-request-locale';
import {enabledShippingCouriers} from '@/lib/shipping/couriers';
import {notFound,permanentRedirect} from 'next/navigation';
import {db,optionalUser} from '@/lib/server/store';
import {cardFor,printings,type Card} from '@/packages/card-data/catalog';
import {Listing} from '@/packages/domain';
import {MarketListingDetailView,type MarketListingCard} from '@/components/tcg/market-listing-items';
import {MarketStoreNav} from '@/components/tcg/market-store-nav';
import {Market} from '@/components/tcg/market';
import {pageMetadata} from '@/lib/site-metadata';
import {isListingExpired} from '@/lib/market/policy';
import {getDynamicListingPolicy} from '@/lib/market/policy';
import {listingIdFromMarketPath,marketListingPath,marketListingSelectorFromPath} from '@/lib/market/listing-url';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';
import {normalizeListingItemPrices} from '@/lib/market/normalize-listing-prices';

export const dynamic='force-dynamic';

type RawStoredListing = Listing & {
  username: string;
  sellerId: string;
  instanceId?:string|null;
  status: string;
  cardImageUrl?: string;
  cardLanguage?: string;
  cardRarity?: string;
  cardSetCode?: string;
  cardVariant?: string;
  cardIdentityId?: string;
  cardCode?: string;
  catalogPrintingCode?:string|null;
  catalogAssetPath?:string|null;
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
  const listingId=listingIdFromMarketPath(id);
  return pageMetadata({title:'Market listing',description:'View this VivrePlay Market listing.',path:listingId?marketListingPath('',listingId):`/market/${encodeURIComponent(id)}`});
}

async function Page({params}:{params:Promise<{id:string}>}){
  const {id:segment}=await params;
  const selector=marketListingSelectorFromPath(segment);
  if(!selector)notFound();
  const where=selector.kind==='id'?'l.id=?':'l.id>=? AND l.id<?';
  const values=selector.kind==='id'?[selector.id]:[selector.lower,selector.upper];
  const [storedRows, me, isAdmin]=await Promise.all([
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
        l.instance_id AS instanceId,
        l.seller_id AS sellerId,
        p.display_name AS seller,
        p.username,
        p.tier AS sellerTier,
        cp.image_url AS cardImageUrl,
        cp.language AS cardLanguage,
        cp.rarity AS cardRarity,
        cp.set_code AS cardSetCode,
        cp.variant AS cardVariant,
        tcp.printing_code AS catalogPrintingCode,
        tca.object_key AS catalogAssetPath,
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
      LEFT JOIN tcg_card_printings tcp ON tcp.id=l.printing_id
      LEFT JOIN tcg_card_assets tca ON tca.printing_id=tcp.id AND tca.kind='small'
      LEFT JOIN card_identities ci ON ci.id=cp.identity_id
      LEFT JOIN seller_shipping_origins o ON o.owner_id=l.seller_id
      WHERE ${where}
      ORDER BY l.id
      LIMIT 2
    `).bind(...values).all<RawStoredListing>(),
    optionalUser(),
    isCurrentUserAdmin(),
  ]);

  const matches=storedRows.results;
  const stored=matches.length===1?matches[0]:null;
  const listing=stored;
  if(!listing)notFound();
  const canonicalPath=marketListingPath(stored.title,stored.id);
  if(segment!==canonicalPath.split('/').at(-1))permanentRedirect(canonicalPath);
  if(stored?.itemsJson){
    try{
      const parsed=JSON.parse(stored.itemsJson);
      if(Array.isArray(parsed))listing.items=normalizeListingItemPrices(parsed.filter(item=>item&&typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&item.quantity>0),Math.max(0,Number(listing.amount)||0)) as Listing['items'];
    }catch{}
  }
  if(listing.amount<=0&&listing.items?.length){
    const recoveredTotal=listing.items.reduce((sum,item)=>sum+(Number(item.unitAmount)>0?Number(item.unitAmount):0)*item.quantity,0);
    if(recoveredTotal>0)listing.amount=recoveredTotal;
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
  const printingCode = stored?.catalogPrintingCode ?? (filenameCode&&!filenameCode.startsWith('tcg-')?filenameCode:undefined) ?? stored?.cardCode;

  const storedCard = (stored?.cardCode || stored?.cardImageUrl) ? {
    id: stored.printingId,
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
    assetPath:stored.catalogAssetPath??undefined,
    variant: stored.cardVariant,
  } : undefined;

  const items=listing.items?.length?listing.items:!['SOLD','SOLD_PENDING'].includes(stored.status)?[{instanceId:stored.instanceId??undefined,printingId:listing.printingId,quantity:listing.quantity,condition:listing.condition,unitAmount:Math.round(listing.amount/Math.max(1,listing.quantity))}]:[];
  const soldRows=stored.type==='WTS'?(await db().prepare(`SELECT json_extract(j.value,'$.printingId') AS printingId,SUM(CAST(json_extract(j.value,'$.quantity') AS INTEGER)) AS quantity,MAX(CAST(json_extract(j.value,'$.unitAmount') AS INTEGER)) AS unitAmount,MAX(json_extract(j.value,'$.condition')) AS condition,MAX(CASE WHEN o.status IN ('PAID','DISPUTED','RECEIVING') OR (o.status='SHIPPED' AND (o.delivered_at IS NULL OR o.delivered_at>datetime('now','-48 hours'))) THEN 1 ELSE 0 END) AS salePending FROM checkout_orders o,json_each(o.items) j WHERE o.kind='MARKET' AND COALESCE(json_extract(j.value,'$.listingId'),o.listing_id)=? AND (o.status IN ('PAID','DISPUTED','RECEIVING','RECEIVED','COMPLETED','FULFILLED') OR (o.status='SHIPPED' AND (o.delivered_at IS NULL OR o.delivered_at>datetime('now','-48 hours')))) GROUP BY json_extract(j.value,'$.printingId')`).bind(stored.id).all<{printingId:string;quantity:number;unitAmount:number|null;condition:string|null;salePending:number}>()).results:[];
  const initialStatus=stored.status==='SOLD'&&soldRows.some(item=>item.salePending)?'SOLD_PENDING':stored.status;
  const displayedSoldRows=soldRows.length?soldRows:stored.status==='SOLD'?[{printingId:stored.printingId,quantity:1,unitAmount:Math.round(listing.amount/Math.max(1,listing.quantity)),condition:listing.condition,salePending:0}]:[];
  if(listing.amount<=0){const saleTotal=displayedSoldRows.reduce((sum,item)=>sum+Math.max(0,Number(item.unitAmount)||0)*Math.max(0,Number(item.quantity)||0),0);if(saleTotal>0)listing.amount=saleTotal;}
  const heldRows=stored.status==='ACTIVE'&&stored.type==='WTS'?(await db().prepare(`SELECT json_extract(j.value,'$.printingId') AS printingId,SUM(CAST(json_extract(j.value,'$.quantity') AS INTEGER)) AS quantity FROM checkout_orders o,json_each(o.items) j WHERE o.kind='MARKET' AND (o.status='PROCESSING' OR (o.status='PENDING_PAYMENT' AND o.expires_at>CURRENT_TIMESTAMP)) AND (json_extract(j.value,'$.listingId')=? OR (json_extract(j.value,'$.listingId') IS NULL AND o.listing_id=?)) GROUP BY json_extract(j.value,'$.printingId')`).bind(stored.id,stored.id).all<{printingId:string;quantity:number}>()).results:[];
  const heldByPrinting=new Map(heldRows.map(row=>[row.printingId,Number(row.quantity)||0]));
  const extraPrintingIds=[...new Set([...items.map(item=>item.printingId),...displayedSoldRows.map(item=>item.printingId)].filter(printingId=>printingId!==stored?.printingId))];
  const bundleRows=extraPrintingIds.length?await db().prepare(`
    SELECT cp.id AS printingId,cp.image_url AS imageUrl,cp.language,cp.rarity,cp.set_code AS setCode,cp.variant,ci.id AS identityId,ci.code,ci.name,ci.color,ci.type,ci.cost,ci.power,ci.effect,tcp.printing_code AS printingCode,tca.object_key AS assetPath
    FROM card_printings cp LEFT JOIN card_identities ci ON ci.id=cp.identity_id
    LEFT JOIN tcg_card_printings tcp ON tcp.id=cp.id
    LEFT JOIN tcg_card_assets tca ON tca.printing_id=tcp.id AND tca.kind='small'
    WHERE cp.id IN (${extraPrintingIds.map(()=>'?').join(',')})
  `).bind(...extraPrintingIds).all<{printingId:string;imageUrl?:string;language:string;rarity?:string;setCode?:string;variant?:string;identityId?:string;code?:string;name?:string;color?:string;type?:string;cost?:number;power?:number;effect?:string;printingCode?:string|null;assetPath?:string|null}>():{results:[]};
  const bundleCards=new Map(bundleRows.results.map(row=>[row.printingId,{
    id:row.printingId,code:row.code??row.printingId,name:row.name??row.code??listing.title,color:row.color??'Red',type:(row.type as Card['type']|undefined)??'Character',cost:row.cost??0,power:row.power??0,rarity:row.rarity??'',art:0,effect:row.effect??'',imageUrl:row.imageUrl,imageSource:'external' as const,setCode:row.setCode,language:row.language,printingCode:row.printingCode??row.code,variant:row.variant,assetPath:row.assetPath??undefined,
  }]));
  const bundleLanguages=new Map(bundleRows.results.map(row=>[row.printingId,row.language]));
  const soldByPrinting=new Map(displayedSoldRows.map(item=>[item.printingId,item]));
  const activePrintings=new Set(items.map(item=>item.printingId));
  const soldOnlyRows=stored.status==='ACTIVE'?displayedSoldRows.filter(item=>!activePrintings.has(item.printingId)):displayedSoldRows;
  const listingCards:MarketListingCard[]=[...items.flatMap((item,index)=>{
    const card=(item.printingId === stored?.printingId ? storedCard : undefined) ?? bundleCards.get(item.printingId) ?? cardFor(item.printingId);
    const printing=printings.find(candidate=>candidate.id===item.printingId);
    const language=item.printingId===stored?.printingId?stored?.cardLanguage??printing?.language??'EN':bundleLanguages.get(item.printingId)??printing?.language??'EN';
    const held=heldByPrinting.get(item.printingId)??0;
    const sold=stored.status==='ACTIVE'&&index===items.findIndex(entry=>entry.printingId===item.printingId)?soldByPrinting.get(item.printingId):undefined;
    return card?[{id:item.printingId,instanceId:'instanceId'in item?item.instanceId:undefined,card,quantity:item.quantity,availableQuantity:Math.max(0,item.quantity-held),heldQuantity:Math.min(item.quantity,held),soldQuantity:Number(sold?.quantity)||0,condition:item.condition??listing.condition,productType:item.productType,gradingCompany:item.gradingCompany,grade:item.grade,certification:item.certification,unitAmount:item.unitAmount??Math.round(listing.amount/listing.quantity),language}]:[];
  }),...soldOnlyRows.flatMap(item=>{const card=(item.printingId===stored.printingId?storedCard:undefined)??bundleCards.get(item.printingId)??cardFor(item.printingId);const printing=printings.find(candidate=>candidate.id===item.printingId);const language=item.printingId===stored.printingId?stored.cardLanguage??printing?.language??'EN':bundleLanguages.get(item.printingId)??printing?.language??'EN';return card?[{id:item.printingId,card,quantity:Number(item.quantity)||1,availableQuantity:0,soldQuantity:Number(item.quantity)||1,sold:true,salePending:Boolean(item.salePending),condition:item.condition??listing.condition,unitAmount:Number(item.unitAmount)||Math.round(listing.amount/Math.max(1,listing.quantity)),language}]:[]})];
  const primary=listingCards[0];
  if(!primary)notFound();
  const cardCount=listingCards.reduce((total,item)=>total+(stored.type==='WTS'&&!isOwner?item.availableQuantity??item.quantity:item.quantity),0);
  const reservedCount=listingCards.reduce((total,item)=>total+(item.heldQuantity??0),0);
  if(stored.type==='WTS'&&reservedCount>0&&!isOwner){listing.quantity=cardCount;if(cardCount>0)listing.amount=listingCards.reduce((total,item)=>total+(item.availableQuantity??item.quantity)*item.unitAmount,0);}

  return (
    <>
      <MarketStoreNav showPromo={false} sellHref={`/market?sell=${encodeURIComponent(`${primary.card.printingCode??primary.card.code}--${primary.language.toLowerCase()}`)}`}/>
      <MarketListingDetailView
        listing={listing}
        stored={stored}
        listingCards={listingCards}
        primary={primary}
        cardCount={cardCount}
        isOwner={isOwner}
        isAdmin={isAdmin}
        canEdit={Boolean(isOwner&&stored&&['ACTIVE','PAUSED'].includes(stored.status))}
        initialExpired={initialExpired}
        initialStatus={initialStatus}
        reservedCount={reservedCount}
        renewDurationDays={renewDurationDays}
      />
      <Market modalOnly/>
    </>
  );
}

export default withRequestLocale(Page);
