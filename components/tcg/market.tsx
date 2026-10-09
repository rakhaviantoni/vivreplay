/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {SavedListings,SaveListingButton} from './market-saved';
import {useSearchParams} from 'next/navigation';
import {
  ArrowLeftIcon as ArrowLeft,
  ArrowRightIcon as ArrowRight,
  CardsIcon as Cards,
  ListIcon as List,
  MapPinIcon as MapPin,
  MinusIcon as Minus,
  MoonIcon as Moon,
  PlusIcon as Plus,
  MagnifyingGlassIcon as Search,
  SquaresFourIcon as Grid,
  UserIcon as UserRound,
  CaretDownIcon as CaretDown,
  ClipboardTextIcon as ClipboardText,
  BookmarkSimpleIcon as Bookmark,
  HeartIcon as Heart,
  ChatCircleDotsIcon as OffersIcon,
  ShoppingBagIcon as OrdersIcon,
  ShoppingCartIcon as Cart,
  StorefrontIcon as Store,
  SunIcon as Sun,
  TrashIcon as Trash,
  WalletIcon as WalletCards,
  XIcon as X,
} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {Card,cardFor,cards,printings} from '@/packages/card-data/catalog';
import {createClient} from '@/utils/supabase/client';
import {displayCardName} from './card-name';
import {printingLabel} from './card-printing-selector';
import {CollectionItem,Listing,formatMoney} from '@/packages/domain';
import {api,useAccount,type AccountState} from '@/lib/client';
import {loadMarketActivityCounts} from '@/lib/market/activity-client';
import {CardArt} from './card-art';
import {Picker} from './catalog';
import {CollectionForm} from './collection-form';
import {AddEditItemModal} from './vault/modals/add-edit-item-modal';
import {VivreMark} from './brand-assets';
import {MarketTimestamp} from './market-timestamp';
import {ShippingCouriers} from './market-listing-items';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {ListingsTab} from './vault/tabs/listings-tab';
import {OffersTab} from './vault/tabs/offers-tab';
import {OrdersTab} from './vault/tabs/orders-tab';
import {MarketPriceMode} from './market-price-mode';
import {ShareButton} from './share';
import {BulkListingModal} from './vault/modals/bulk-listing-modal';
import {MarketCartSheet} from './market-cart-sheet';
import {MarketProDialog} from './market-pro-dialog';
import {MarketQuickPanel} from './market-quick-panel';
import {enrichCollectionItem,groupVaultStacks} from './vault/vault-utils';
import {isPlayableSet} from '@/packages/domain/release-availability';
import {uniquePrintingIds,matchingPrintingCopies,selectedPrintingCopy} from '@/lib/market/printing-selection';
import '@/app/market-account.css';
type MarketBenchmark={amount:number;currency:string;url:string|null;observedAt:string;confidence:string;normalizedAmount:number|null;normalizedCurrency:string|null};
type CardPrintingItem={id:string;language:string;variant:string|null;printing_code:string|null;card_image_url:string|null;rarity?:string|null;set_code?:string};
type MarketCard=Card&{availablePrintings?:CardPrintingItem[]};
type SearchIdentity={id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string;tcg_card_printings?:Array<{id:string;card_image_url:string|null;rarity:string|null;set_code:string;language:string;variant:string|null;printing_code:string|null}>};
type ListingBundleCard={
  id:string;
  card:Card;
  printing:CardPrintingItem;
  instanceId?:string;
  quantity:number;
  condition:string;
  unitAmount:number;
  availableQuantity:number;
};
type PublishedShare={id:string;title:string;price:number;cards:ListingBundleCard[]};
function addFeedListingToCart(listing:Listing,printingId:string,locale:'EN'|'ID'){
  const cartKey='vivreplay-market-cart-v1';
  let cart:{sellerId:string;lines:{listingId:string;listingTitle:string;items:{printingId:string;quantity:number}[]}[]}={sellerId:listing.sellerId??'',lines:[]};
  try{const saved=JSON.parse(window.localStorage.getItem(cartKey)||'null');if(saved&&Array.isArray(saved.lines))cart=saved;}catch{}
  if(cart.sellerId&&listing.sellerId&&cart.sellerId!==listing.sellerId){
    const replace=window.confirm(locale==='ID'?'Keranjang berisi listing dari penjual lain. Kosongkan keranjang dan mulai yang baru?':'Your cart has listings from another seller. Clear it and start a new cart?');
    if(!replace)return;
    cart={sellerId:listing.sellerId,lines:[]};
  }
  cart.sellerId=listing.sellerId??cart.sellerId;
  if(!cart.lines.some(line=>line.listingId===listing.id)&&cart.lines.length>=10){toast.error(locale==='ID'?'Keranjang dapat berisi hingga 10 listing.':'A cart can hold up to 10 listings.');return;}
  const line=cart.lines.find(item=>item.listingId===listing.id);
  if(line){const existing=line.items.find(item=>item.printingId===printingId);if(existing)existing.quantity=Math.min(99,existing.quantity+1);else line.items.push({printingId,quantity:1});}
  else cart.lines.push({listingId:listing.id,listingTitle:listing.title,items:[{printingId,quantity:1}]});
  window.localStorage.setItem(cartKey,JSON.stringify(cart));window.dispatchEvent(new Event('vivreplay:market-cart-updated'));
  toast.success(locale==='ID'?'1 kartu ditambahkan':'Added 1 card',{action:{label:locale==='ID'?'Lihat keranjang':'View cart',onClick:()=>window.dispatchEvent(new Event('vivreplay:open-market-cart'))}});
}
function printingToCard(baseCard:Card,p:CardPrintingItem):Card{
  return {
    ...baseCard,
    id:p.id,
    setCode:p.set_code??baseCard.setCode,
    language:p.language,
    printingCode:p.printing_code??baseCard.code,
    variant:p.variant??undefined,
    rarity:p.rarity??baseCard.rarity,
    imageUrl:p.card_image_url??baseCard.imageUrl,
    imageSource:'external',
  };
}
function uniqueCardPrintings(items:CardPrintingItem[]):CardPrintingItem[]{
  return uniquePrintingIds(items);
}
function searchedCard(identity:SearchIdentity):MarketCard|undefined {
  const printingsList=(identity.tcg_card_printings??[]).filter(item=>item.card_image_url&&isPlayableSet(item.set_code));
  const sorted=[...printingsList].sort((a,b)=>Number(a.language!=='EN')-Number(b.language!=='EN')+Number((a.variant??'').toLowerCase().includes('parallel'))-Number((b.variant??'').toLowerCase().includes('parallel')));
  const printing=sorted[0];
  if(!printing?.card_image_url)return undefined;
  const canonical=cards.find(card=>card.code===identity.code);
  const image={imageUrl:printing.card_image_url,imageSource:'external' as const,setCode:printing.set_code,language:printing.language,printingCode:printing.printing_code??identity.code,variant:printing.variant??undefined};
  const baseCard=canonical?{...canonical,...image}:{id:printing.id,code:identity.code,name:displayCardName(identity.name,identity.code),color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:printing.rarity??'',art:0,effect:identity.effect_text,...image};
  return {...baseCard,id:printing.id,availablePrintings:printingsList.map(item=>({id:item.id,language:item.language,variant:item.variant,printing_code:item.printing_code,card_image_url:item.card_image_url,rarity:item.rarity,set_code:item.set_code}))};
}
function CardSearch({value,onChange,onSelect,locale='EN'}:{value:string;onChange:(value:string)=>void;onSelect:(card:MarketCard)=>void;locale?:'EN'|'ID'}) {
  const [results,setResults]=useState<MarketCard[]>([]);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    const term=value.trim();
    if(term.length<2){setResults([]);setLoading(false);return}
    let active=true;
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      const client=createClient();
      const {data}=await client.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text,tcg_card_printings(id,card_image_url,rarity,set_code,language,variant,printing_code)').or(`code.ilike.%${term.replaceAll(',',' ')}%,name.ilike.%${term.replaceAll(',',' ')}%`).limit(7);
      if(active){
        const live=((data??[]) as SearchIdentity[]).map(searchedCard).filter((card):card is MarketCard=>Boolean(card));
        setResults(live.length?live:cards.filter(card=>`${card.name} ${card.code}`.toLowerCase().includes(term.toLowerCase())).slice(0,7));
        setLoading(false);
      }
    },170);
    return()=>{active=false;window.clearTimeout(timer)};
  },[value]);
  return (
    <div className="market-sell-search-container">
      <div className="market-sell-search-bar">
        <Search size={18} className="market-sell-search-icon"/>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={event=>onChange(event.target.value)}
          placeholder={locale==='ID'?'Cari nama kartu, kode, atau nomor seri...':'Search a card name, code, or number...'}
          aria-label={locale==='ID'?'Cari kartu untuk dijual':'Search card to sell'}
        />
        {value.trim().length>0&&(
          <button
            type="button"
            className="market-sell-search-clear"
            onClick={()=>onChange('')}
            aria-label={locale==='ID'?'Hapus pencarian':'Clear search'}
          >
            <X size={15}/>
          </button>
        )}
      </div>
      <div className="market-sell-search-body">
        {value.trim().length<2?(
          <div className="market-sell-search-empty">
            <Search size={22}/>
            <p>{locale==='ID'?'Ketik nama atau kode kartu (contoh: OP01-001 atau Luffy).':'Type a card name or card number (e.g. OP01-001 or Luffy).'}</p>
          </div>
        ):loading?(
          <div className="market-sell-search-skeleton" aria-label={locale==='ID'?'Mencari kartu...':'Searching cards'}>
            <div className="market-sell-skeleton-row"/>
            <div className="market-sell-skeleton-row"/>
            <div className="market-sell-skeleton-row"/>
          </div>
        ):results.length>0?(
          <div className="market-sell-search-results">
            <div className="market-sell-search-count">
              <span>{locale==='ID'?'HASIL PENCARIAN':'SEARCH RESULTS'}</span>
              <small>{results.length} {locale==='ID'?'kartu cocok':(results.length===1?'match':'matches')}</small>
            </div>
            {results.map(card=>{
              const printingsCount=card.availablePrintings?.length||1;
              return (
                <div
                  key={card.id}
                  className="market-sell-card-result"
                  onClick={()=>onSelect(card)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(card);}}}
                >
                  <div className="market-sell-card-thumb">
                    <CardArt card={card}/>
                  </div>
                  <div className="market-sell-card-meta">
                    <strong>{card.name}</strong>
                    <div className="market-sell-card-sub">
                      <span className="market-sell-code">{card.code}</span>
                      <span>{card.type}</span>
                      {card.rarity&&(
                        <>
                          <span className="market-sell-rarity">{card.rarity}</span>
                        </>
                      )}
                      {card.setCode&&(
                        <>
                          <span>{card.setCode}</span>
                        </>
                      )}
                    </div>
                    {printingsCount>1&&(
                      <span className="market-sell-printings-badge">
                        <Grid size={12}/>
                        {printingsCount} {locale==='ID'?'versi cetak':'printings'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="market-sell-card-select-btn"
                    onClick={e=>{e.stopPropagation();onSelect(card);}}
                  >
                    <span>{locale==='ID'?'Pilih':'Select'}</span>
                    <ArrowRight size={14}/>
                  </button>
                </div>
              );
            })}
          </div>
        ):(
          <div className="market-sell-search-empty">
            <p>{locale==='ID'?'Tidak ada kartu yang cocok dengan pencarian tersebut.':'No cards matched that search.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
function VaultCardPicker({items,onSelect,locale='EN'}:{items:CollectionItem[];onSelect:(card:MarketCard,instanceId:string,quantity:number,condition:string)=>void;locale?:'EN'|'ID'}) {
  return (
    <div className="market-vault-picker-grid">
      {items.map(item=>{
        const card=(item.card as MarketCard|undefined)??cardFor(item.printingId);
        if(!card)return null;
        return (
          <button
            key={item.id}
            type="button"
            className="market-vault-card-item"
            disabled={item.quantity<=0}
            onClick={()=>onSelect({...card,id:item.printingId,language:item.language??card.language,variant:item.variant??card.variant,printingCode:item.printingCode??card.printingCode,setCode:item.setCode??card.setCode},item.id,item.quantity,item.condition||'NM')}
          >
            <div className="market-vault-card-thumb">
              <CardArt card={card}/>
            </div>
            <div className="market-vault-card-info">
              <strong>{card.name}</strong>
              <small className="market-vault-card-meta"><span>{card.code}</span><span>{item.condition}</span><span>{item.quantity} {locale==='ID'?'di koleksi':'in Vault'}</span></small>
              {item.quantity<=0&&<small>{locale==='ID'?'Sudah terpakai di listing':'Reserved by a listing'}</small>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
function MarketCardLookup({
  value,
  listings = [],
  onViewListings,
  onAddToVault,
  onSell,
  locale = 'EN',
}: {
  value: string;
  listings?: Listing[];
  onViewListings: (card: Card) => void;
  onAddToVault: (card: Card) => void;
  onSell: (card: Card) => void;
  locale?: 'EN' | 'ID';
}) {
  const [results, setResults] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const client = createClient();
      const { data } = await client
        .from('tcg_card_identities')
        .select('id,code,name,color,card_type,cost,power,effect_text,tcg_card_printings(id,card_image_url,rarity,set_code,language,variant,printing_code)')
        .or(`code.ilike.%${term.replaceAll(',', ' ')}%,name.ilike.%${term.replaceAll(',', ' ')}%`)
        .limit(10);
      if (active) {
        const live = ((data ?? []) as SearchIdentity[]).map(searchedCard).filter((card): card is Card => Boolean(card));
        setResults(live.length ? live : cards.filter(card => `${card.name} ${card.code}`.toLowerCase().includes(term.toLowerCase())).slice(0, 10));
        setLoading(false);
      }
    }, 170);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [value]);
  const getCardListingsCount = (card: Card) => {
    return listings.filter(l => {
      if (l.card?.id === card.id || l.card?.code === card.code) return true;
      if (l.printingId === card.id) return true;
      if (l.items?.some(it => it.printingId === card.id || cardFor(it.printingId)?.code === card.code)) return true;
      return false;
    }).length;
  };
  return (
    <section className="market-card-lookup" aria-live="polite">
      <header>
        <span>{locale === 'ID' ? 'Katalog Kartu Resmi' : 'Official Card Catalog'}</span>
        <small>
          {loading
            ? (locale === 'ID' ? 'Mencari...' : 'Searching...')
            : value.trim().length >= 2
              ? (results.length ? (locale === 'ID' ? `${results.length} kartu cocok` : `${results.length} matches`) : (locale === 'ID' ? 'Kartu tidak ditemukan' : 'No cards found'))
              : (locale === 'ID' ? 'Ketik nama atau kode kartu di kolom pencarian' : 'Type card name or code in search bar')}
        </small>
      </header>
      {loading ? (
        <div className="market-card-lookup-skeleton">
          <i/><i/><i/>
        </div>
      ) : results.length > 0 ? (
        <div>
          {results.map(card => {
            const listingsCount = getCardListingsCount(card);
            return (
              <article key={card.id}>
                <Link href={`/cards/${card.code}`} className="market-card-lookup-art">
                  <CardArt card={card} small />
                </Link>
                <div className="market-card-lookup-details">
                  <strong>{card.name}</strong>
                  <div className="market-card-lookup-meta">
                    <span className="market-sell-code">{card.code}</span>
                    <span>{card.type}</span>
                    {card.color && (
                      <>
                        <span>{card.color}</span>
                      </>
                    )}
                    {card.rarity && (
                      <>
                        <span className="market-sell-rarity">{card.rarity}</span>
                      </>
                    )}
                    {card.setCode && (
                      <>
                        <span>{card.setCode}</span>
                      </>
                    )}
                  </div>
                  {listingsCount > 0 && (
                    <span className="market-card-lookup-badge">
                      {listingsCount} {locale === 'ID' ? 'listing tersedia di Market' : (listingsCount === 1 ? 'listing available' : 'listings available')}
                    </span>
                  )}
                </div>
                <div className="market-card-lookup-actions">
                  <button
                    type="button"
                    className="btn-accent"
                    onClick={() => onViewListings(card)}
                  >
                    {listingsCount > 0
                      ? (locale === 'ID' ? `Lihat Listing (${listingsCount})` : `View Listings (${listingsCount})`)
                      : (locale === 'ID' ? 'Lihat Listing' : 'View Listings')}
                  </button>
                  <button type="button" onClick={() => onSell(card)}>
                    {locale === 'ID' ? 'Jual' : 'Sell'}
                  </button>
                  <button type="button" onClick={() => onAddToVault(card)}>
                    {locale === 'ID' ? 'Tambahkan ke koleksi' : 'Add to Vault'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : value.trim().length >= 2 ? (
        <div className="market-feed-empty" style={{ minHeight: 180, padding: '24px 18px' }}>
          <p>{locale === 'ID' ? `Tidak ada kartu di database untuk "${value}".` : `No cards found in catalog for "${value}".`}</p>
        </div>
      ) : (
        <div className="market-feed-empty" style={{ minHeight: 180, padding: '28px 18px' }}>
          <p>{locale === 'ID' ? 'Ketik nama kartu, nomor, atau kode set (contoh: OP05-001 atau Luffy) di kolom pencarian.' : 'Type a card name, number, or set code (e.g. OP05-001 or Luffy) in the search bar.'}</p>
        </div>
      )}
    </section>
  );
}
export function Market({initialCards=[],modalOnly=false}:{initialCards?:string[];modalOnly?:boolean}) {
  const {data,loading:accountLoading,refresh:refreshAccount}=useAccount();
  const searchParams=useSearchParams();
  const [listings,setListings]=useState<Listing[]>([]);
  const [listingsLoading,setListingsLoading]=useState(true);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [lang,setLang]=useState<'all'|'EN'|'JP'>('all');
  const [sort,setSort]=useState<'newest'|'price_asc'|'price_desc'>('newest');
  const [tradeType,setTradeType]=useState<'all'|'WTS'|'WTB'>('all');
  const [listingView,setListingView]=useState<'list'|'grid'>('list');
  const [feedScope,setFeedScope]=useState<'listings'|'cards'>('listings');
  const [open,setOpen]=useState(()=>!modalOnly&&Boolean(searchParams.get('sell')&&searchParams.get('sell')!=='open'));
  const [directSellLoading,setDirectSellLoading]=useState(()=>!modalOnly&&Boolean(searchParams.get('sell')&&searchParams.get('sell')!=='open'));
  const queuedSellPrinting=useRef('');
  const [bulkListingOpen,setBulkListingOpen]=useState(false);
  const directSellSearchHandled=useRef(false);
  const configLoadVersion=useRef(0);
  const [busy,setBusy]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  const [accountPanel,setAccountPanel]=useState<'listings'|'offers'|'orders'|'saved'|null>(()=>{const activity=searchParams.get('activity');return activity==='offers'||activity==='orders'||activity==='listings'||activity==='saved'?activity:null});
  const [quickPanel,setQuickPanel]=useState<'profile'|'vault'|'wishlist'|null>(null);
  const [activityCounts,setActivityCounts]=useState({listings:0,offers:0,orders:0});
  const profileId=String(data?.profile?.id??'');
  // Bundle & Card Listing Draft State
  const [bundleCards,setBundleCards]=useState<ListingBundleCard[]>([]);
  const [publishedShare,setPublishedShare]=useState<PublishedShare|null>(null);
  const [configuringCard,setConfiguringCard]=useState<MarketCard|null>(null);
  const [cardPrintings,setCardPrintings]=useState<CardPrintingItem[]>([]);
  const [selectedPrintingId,setSelectedPrintingId]=useState<string>('');
  const [searchSource,setSearchSource]=useState<'catalog'|'vault'>('catalog');
  const [cardSearch,setCardSearch]=useState('');
  const [isAddingAnother,setIsAddingAnother]=useState(false);
  // Active Card Config Inputs
  const [itemPrice,setItemPrice]=useState('');
  const [itemQuantity,setItemQuantity]=useState(1);
  const [itemCondition,setItemCondition]=useState('NM');
  const [itemInstance,setItemInstance]=useState('');
  // Overall Listing Inputs
  const [listingTitle,setListingTitle]=useState('');
  const [listingPrice,setListingPrice]=useState('');
  const [listingNegotiable,setListingNegotiable]=useState(true);
  const [listingCity,setListingCity]=useState('');
  // Benchmark State
  const [benchmark,setBenchmark]=useState<MarketBenchmark|null>(null);
  const [benchmarkLoading,setBenchmarkLoading]=useState(false);
  const [benchmarkMultiplier,setBenchmarkMultiplier]=useState(100);
  // Vault Sync Form
  const [collectionOpen,setCollectionOpen]=useState(false);
  const [collectionCardTarget,setCollectionCardTarget]=useState<ListingBundleCard|null>(null);
  const [marketVaultCard,setMarketVaultCard]=useState<Card|null>(null);
  const [marketVaultOpen,setMarketVaultOpen]=useState(false);
  useEffect(()=>{
    const next=window.localStorage.getItem('vivreplay-theme')==='dark'?'dark':'light';
    const language=window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN';
    setTheme(next);
    setLocale(language);
    document.documentElement.dataset.theme=next;
    document.documentElement.lang=language==='ID'?'id':'en';
    const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    const onTheme=(event:Event)=>setTheme((event as CustomEvent<'light'|'dark'>).detail==='dark'?'dark':'light');
    window.addEventListener('vivreplay:locale',onLocale);
    window.addEventListener('vivreplay:theme',onTheme);
    return()=>{window.removeEventListener('vivreplay:locale',onLocale);window.removeEventListener('vivreplay:theme',onTheme)};
  },[]);
  // Prefill shipping origin city directly from signed-in seller's origin
  useEffect(()=>{
    if(!data?.profile)return;
    api<{origin?:{city?:string}|null}>('/api/shipping/origin',undefined,'GET')
      .then(res=>{
        if(res?.origin?.city){
          setListingCity(res.origin.city);
          window.localStorage.setItem('vivreplay-seller-city',res.origin.city);
        }else{
          const saved=window.localStorage.getItem('vivreplay-seller-city');
          if(saved)setListingCity(saved);
        }
      })
      .catch(()=>{
        const saved=window.localStorage.getItem('vivreplay-seller-city');
        if(saved)setListingCity(saved);
      });
  },[data?.profile]);
  async function refresh(){
    if(!listings.length)setListingsLoading(true);
    try{
      const result=await api<{listings:Listing[]}>('/api/listings');
      setListings(result.listings);
      setError('');
    }catch(cause){
      setError(cause instanceof Error?cause.message:(locale==='ID'?'Listing tidak dapat dimuat sementara. Silakan coba lagi.':'Live listings are temporarily unavailable. Please retry.'));
    }finally{setListingsLoading(false)}
  }
  useEffect(()=>{if(!modalOnly)void refresh()},[modalOnly]);
  useEffect(()=>{
    if(!profileId||modalOnly)return;
    let active=true;
    const update=async()=>{if(document.visibilityState!=='visible')return;const counts=await loadMarketActivityCounts(profileId);if(active&&counts)setActivityCounts(counts)};
    const onVisibility=()=>{if(document.visibilityState==='visible')void update()};
    void update();const timer=window.setInterval(()=>void update(),60_000);document.addEventListener('visibilitychange',onVisibility);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisibility)};
  },[profileId]);
  useEffect(()=>{
    if(!accountPanel||accountPanel==='saved')return;
    setActivityCounts(current=>({...current,[accountPanel]:0}));
    void fetch('/api/market/activity',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({section:accountPanel})}).catch(()=>undefined);
  },[accountPanel]);
  useEffect(()=>{
    const card=searchParams.get('card');
    if(!card)return;
    setQuery(cardFor(card)?.name??card);
  },[searchParams]);
  // Load printings and benchmark whenever a card is opened for configuration
  const loadCardForConfig=async(card:Card,presetInstanceId?:string,presetQty=1,presetCondition='NM')=>{
    const loadVersion=++configLoadVersion.current;
    const requestedPrintingId=data?.collection.find(item=>item.id===presetInstanceId)?.printingId??card.id;
    setConfiguringCard(card as MarketCard);
    setCardPrintings([]);
    setSelectedPrintingId('');
    setItemQuantity(presetQty);
    setItemCondition(presetCondition);
    setItemInstance(presetInstanceId||'');
    setItemPrice('');
    setBenchmarkMultiplier(100);
    if((card as MarketCard).availablePrintings?.length){
      const list=uniqueCardPrintings((card as MarketCard).availablePrintings!);
      if(list.length){
        setCardPrintings(list);
        const chosen=list.find(p=>p.id===requestedPrintingId)||list.find(p=>p.language===card.language)||list[0];
        setConfiguringCard({...card,availablePrintings:list});
        setSelectedPrintingId(chosen.id);
        return;
      }
    }
    try{
      const client=createClient();
      let {data:lookup}=await client.from('tcg_card_printings').select('identity_id').eq('id',card.id).maybeSingle();
      if(loadVersion!==configLoadVersion.current)return;
      if(!lookup){
        const {data:byCode}=await client.from('tcg_card_identities').select('id').ilike('code',card.code).maybeSingle();
        if(byCode)lookup={identity_id:byCode.id};
        if(loadVersion!==configLoadVersion.current)return;
      }
      if(lookup?.identity_id){
        const {data:rows}=await client.from('tcg_card_printings').select('id,language,variant,rarity,set_code,printing_code,card_image_url').eq('identity_id',lookup.identity_id).order('language').order('variant');
        if(loadVersion!==configLoadVersion.current)return;
        if(rows&&rows.length>0){
          const list=uniqueCardPrintings(rows as CardPrintingItem[]);
          if(list.length){
            setCardPrintings(list);
            const chosen=list.find(p=>p.id===requestedPrintingId)||list.find(p=>p.language===card.language)||list[0];
            setConfiguringCard(prev=>prev?{...prev,availablePrintings:list}:prev);
            setSelectedPrintingId(chosen.id);
            return;
          }
        }
      }
    }catch{}
    if(loadVersion!==configLoadVersion.current)return;
    const defaultPrinting:CardPrintingItem={
      id:card.id,
      language:card.language??'EN',
      variant:card.variant??'Standard',
      printing_code:card.printingCode??card.code,
      card_image_url:card.imageUrl??null,
      rarity:card.rarity,
      set_code:card.setCode,
    };
    setCardPrintings([defaultPrinting]);
    setSelectedPrintingId(defaultPrinting.id);
  };
  // Direct sell URL support (e.g. ?sell=<id>)
  useEffect(()=>{
    const sell=searchParams.get('sell');
    if(!sell)return;
    if(accountLoading)return;
    if(sell==='open'){
      if(!directSellSearchHandled.current){directSellSearchHandled.current=true;beginListing();}
      return;
    }
    const legacy=cardFor(sell);
    if(legacy){
      sellCard(legacy);
      return;
    }
    let active=true;
    void (async()=>{
      const client=createClient();
      const {data}=await client.from('tcg_card_printings').select('id,card_image_url,rarity,set_code,language,tcg_card_identities!inner(code,name,color,card_type,cost,power,effect_text)').eq('id',sell).maybeSingle();
      if(!active)return;
      if(!data){setDirectSellLoading(false);return;}
      const row=data as unknown as {id:string;card_image_url:string|null;rarity:string|null;set_code:string|null;language:string;tcg_card_identities:{code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string}};
      const identity=row.tcg_card_identities;
      const cardObj:Card={id:row.id,code:identity.code,name:displayCardName(identity.name,identity.code),color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:row.rarity??'',art:0,effect:identity.effect_text,imageUrl:row.card_image_url??undefined,imageSource:'external',setCode:row.set_code??undefined,language:row.language};
      sellCard(cardObj);
    })();
    return()=>{active=false};
  },[searchParams,accountLoading,data]);
  // Fetch benchmark whenever selected printing changes
  useEffect(()=>{
    if(!selectedPrintingId){
      setBenchmark(null);
      setBenchmarkLoading(false);
      return;
    }
    let active=true;
    setBenchmark(null);
    setBenchmarkLoading(true);
    fetch(`/api/market/benchmark?printingId=${encodeURIComponent(selectedPrintingId)}`)
      .then(async res=>res.ok?(await res.json() as {benchmark?:MarketBenchmark|null}):{benchmark:null})
      .then(result=>{
        if(active){
          setBenchmark(result.benchmark??null);
          if(result.benchmark){
            const yytIdr=result.benchmark.normalizedAmount||Math.round(result.benchmark.amount*110);
            setItemPrice(prev=>prev?prev:String(Math.round(yytIdr*benchmarkMultiplier/100)));
          }
        }
      })
      .catch(()=>{if(active)setBenchmark(null)})
      .finally(()=>{if(active)setBenchmarkLoading(false)});
    return()=>{active=false};
  },[selectedPrintingId]);
  const activeCardObj=useMemo(()=>{
    if(!configuringCard)return undefined;
    const chosen=cardPrintings.find(p=>p.id===selectedPrintingId);
    return chosen?printingToCard(configuringCard,chosen):configuringCard;
  },[configuringCard,cardPrintings,selectedPrintingId]);
  const ownedCopiesForConfig=useMemo(()=>{
    if(!activeCardObj)return [];
    return matchingPrintingCopies(data?.collection??[],selectedPrintingId).filter(copy=>copy.type==='RAW').map(copy=>({...copy,quantity:Math.max(0,copy.quantity-(copy.listedQuantity??0)-bundleCards.filter(item=>item.instanceId===copy.id).reduce((sum,item)=>sum+item.quantity,0))})).filter(copy=>copy.quantity>0);
  },[activeCardObj,data?.collection,selectedPrintingId,bundleCards]);
  useEffect(()=>{
    const copy=ownedCopiesForConfig.find(c=>c.id===itemInstance)??ownedCopiesForConfig[0];
    setItemInstance(copy?.id??'');
    if(copy){setItemCondition(copy.condition||'NM');setItemQuantity(quantity=>Math.min(quantity,copy.quantity));}
  },[ownedCopiesForConfig,itemInstance]);
  const printingLanguages=useMemo(()=>[...new Set(cardPrintings.map(item=>item.language))],[cardPrintings]);
  const printingLang=cardPrintings.find(item=>item.id===selectedPrintingId)?.language??configuringCard?.language??'EN';
  const handleSelectPrinting=(printingId:string)=>{
    const chosen=cardPrintings.find(p=>p.id===printingId);
    if(!chosen||!configuringCard)return;
    setItemInstance('');
    setItemQuantity(1);
    setItemCondition('NM');
    setSelectedPrintingId(chosen.id);
    setConfiguringCard(prev=>prev?printingToCard(prev,chosen):prev);
  };
  const visible=useMemo(()=>{
    const term=query.trim().toLowerCase();
    const matches=listings.filter(listing=>{
      const card=listing.card??cardFor(listing.printingId);
      const printing=printings.find(item=>item.id===listing.printingId);
      const cardLanguage=listing.language??printing?.language??'EN';
      const cardName=card?.name??listing.title;
      const cardCode=card?.code??'';
      const matchesTrade = tradeType === 'all' || listing.type === tradeType;
      const matchesSearch = !term || [listing.title,cardName,cardCode].some(value=>value.toLowerCase().includes(term));
      const matchesLang = lang === 'all' || cardLanguage === lang;
      const matchesInitial = !initialCards.length || (card && initialCards.includes(card.id));
      return matchesTrade && matchesSearch && matchesLang && matchesInitial;
    });
    if (sort === 'price_asc') return [...matches].sort((a,b)=>a.amount-b.amount);
    if (sort === 'price_desc') return [...matches].sort((a,b)=>b.amount-a.amount);
    return matches;
  },[initialCards,lang,listings,query,sort,tradeType]);
  const printingFilter=searchParams.get('printing')??'';
  const displayListings=useMemo(()=>{
    if(printingFilter)return visible.filter(listing=>listing.printingId===printingFilter||listing.items?.some(item=>item.printingId===printingFilter));
    return visible;
  },[visible,printingFilter]);
  const tradeCounts = useMemo(() => {
    const wts = listings.filter(l => l.type === 'WTS').length;
    const wtb = listings.filter(l => l.type === 'WTB').length;
    return { all: listings.length, wts, wtb };
  }, [listings]);
  const signInToContinue=()=>{
    if(accountLoading){
      toast.message(locale==='ID'?'Memeriksa akun Anda...':'Checking your account...');
      return false;
    }
    if(data)return true;
    window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));
    setOpen(false);
    setDirectSellLoading(false);
    return false;
  };
  function beginListing(){
    configLoadVersion.current++;
    if(!signInToContinue())return;
    setBundleCards([]);
    setConfiguringCard(null);
    setCardSearch('');
    setCardPrintings([]);
    setSaveError('');
    setListingPrice('');
    setListingNegotiable(true);
    setListingTitle('');
    setIsAddingAnother(false);
    setSearchSource('catalog');
    setBenchmarkMultiplier(100);
    const savedCity=window.localStorage.getItem('vivreplay-seller-city')||'Jakarta';
    setListingCity(savedCity);
    setOpen(true);
  }
  useEffect(()=>{
    const openSellListing=()=>{setAccountPanel(null);beginListing()};
    window.addEventListener('vivreplay:open-sell-listing',openSellListing);
    return()=>window.removeEventListener('vivreplay:open-sell-listing',openSellListing);
  },[data,accountLoading,locale]);
  function sellCard(card:Card){
    if(!signInToContinue())return;
    setBundleCards([]);
    setCardSearch(card.name);
    setSaveError('');
    setListingTitle(card.name);
    setIsAddingAnother(false);
    setBenchmarkMultiplier(100);
    const savedCity=window.localStorage.getItem('vivreplay-seller-city')||'Jakarta';
    setListingCity(savedCity);
    loadCardForConfig(card);
    setDirectSellLoading(false);
    setOpen(true);
  }
  const sellPrinting=async(printingId:string)=>{
    if(accountLoading){toast.message(locale==='ID'?'Memeriksa akun Anda…':'Checking your account…');return;}
    if(!data){signInToContinue();return;}
    const readablePrinting=printingId.match(/^(.+)--(en|jp|kr|cn)$/i);
    const catalogCard=readablePrinting?undefined:cardFor(printingId);
    if(catalogCard){sellCard(catalogCard);return;}
    setDirectSellLoading(true);
    setOpen(true);
    try{
      const client=createClient();
      let query=client.from('tcg_card_printings').select('id,card_image_url,rarity,set_code,language,printing_code,variant,tcg_card_identities!inner(code,name,color,card_type,cost,power,effect_text)');
      if(readablePrinting)query=query.eq('printing_code',readablePrinting[1]).eq('language',readablePrinting[2].toUpperCase());
      else query=query.eq('id',printingId);
      const {data:row}=await query.maybeSingle();
      if(!row){setDirectSellLoading(false);toast.error(locale==='ID'?'Cetakan kartu tidak ditemukan.':'Card printing could not be found.');return;}
      const printing=row as unknown as {id:string;card_image_url:string|null;rarity:string|null;set_code:string|null;language:string;printing_code:string|null;variant:string|null;tcg_card_identities:{code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string}};
      const identity=printing.tcg_card_identities;
      const cardObj:Card={id:printing.id,code:identity.code,name:displayCardName(identity.name,identity.code),color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:printing.rarity??'',art:0,effect:identity.effect_text,imageUrl:printing.card_image_url??undefined,imageSource:'external',setCode:printing.set_code??undefined,language:printing.language,printingCode:printing.printing_code??undefined,variant:printing.variant??undefined};
      sellCard(cardObj);
    }catch{
      setDirectSellLoading(false);
      toast.error(locale==='ID'?'Cetakan kartu gagal dimuat.':'Could not load this card printing.');
    }
  };
  useEffect(()=>{
    if(!modalOnly)return;
    const onSell=(event:Event)=>{const printingId=(event as CustomEvent<string>).detail;if(printingId){if(accountLoading)queuedSellPrinting.current=printingId;else void sellPrinting(printingId)}};
    const onCreate=()=>beginListing();
    window.addEventListener('vivreplay:open-sell-printing',onSell);
    window.addEventListener('vivreplay:open-sell-listing',onCreate);
    return()=>{window.removeEventListener('vivreplay:open-sell-printing',onSell);window.removeEventListener('vivreplay:open-sell-listing',onCreate)};
  },[modalOnly,accountLoading,beginListing,sellPrinting]);
  useEffect(()=>{
    if(!modalOnly||!queuedSellPrinting.current||accountLoading)return;
    const printingId=queuedSellPrinting.current;
    queuedSellPrinting.current='';
    void sellPrinting(printingId);
  },[modalOnly,accountLoading,sellPrinting]);
  const addToVault=(card:Card)=>{
    if(accountLoading){toast.message(locale==='ID'?'Memeriksa akun Anda...':'Checking your account...');return;}
    setMarketVaultCard(card);
    setMarketVaultOpen(true);
  };
  const toggleTheme=()=>{
    const next=theme==='light'?'dark':'light';
    setTheme(next);
    document.documentElement.dataset.theme=next;
    window.localStorage.setItem('vivreplay-theme',next);
    window.dispatchEvent(new CustomEvent('vivreplay:theme',{detail:next}));
  };
  const toggleLocale=()=>{
    const next=locale==='EN'?'ID':'EN';
    setLocale(next);
    document.documentElement.lang=next==='ID'?'id':'en';
    window.localStorage.setItem('vivreplay-locale',next);
    window.dispatchEvent(new CustomEvent('vivreplay:locale',{detail:next}));
  };
  const addConfiguredCardToBundle=()=>{
    if(!activeCardObj||!selectedPrintingId)return;
    const chosenPrinting=cardPrintings.find(p=>p.id===selectedPrintingId)||{
      id:activeCardObj.id,
      language:activeCardObj.language??'EN',
      variant:activeCardObj.variant??null,
      printing_code:activeCardObj.printingCode??activeCardObj.code,
      card_image_url:activeCardObj.imageUrl??null,
      rarity:activeCardObj.rarity,
      set_code:activeCardObj.setCode,
    };
    const matchedCopy=selectedPrintingCopy(ownedCopiesForConfig,selectedPrintingId,itemInstance);
    if(!matchedCopy&&(data?.collection??[]).some(copy=>copy.printingId===selectedPrintingId)){
      toast.error(locale==='ID'?'Salinan kartu ini sudah terpakai di listing atau paket ini.':'These copies are already reserved by a listing or this bundle.');return;
    }
    const matchedInstance=matchedCopy?.id;
    const newItem:ListingBundleCard={
      id:crypto.randomUUID(),
      card:activeCardObj,
      printing:chosenPrinting,
      instanceId:matchedInstance,
      quantity:matchedCopy?Math.min(itemQuantity,matchedCopy.quantity):itemQuantity,
      condition:matchedCopy?.condition??itemCondition,
      unitAmount:Number(itemPrice)||0,
      availableQuantity:matchedCopy?.quantity||4,
    };
    setBundleCards(prev=>{
      const next=[...prev,newItem];
      if(next.length===1){
        setListingTitle(next[0].quantity>1?`${next[0].card.name} ×${next[0].quantity}`:next[0].card.name);
      }else{
        setListingTitle(`${next.slice(0,2).map(c=>c.card.name).join(' + ')}${next.length>2?` +${next.length-2}`:''} Bundle`);
      }
      const sumTotal=next.reduce((sum,it)=>sum+(it.unitAmount*it.quantity),0);
      setListingPrice(String(sumTotal));
      return next;
    });
    setConfiguringCard(null);
    setIsAddingAnother(false);
  };
  const handlePublishListing=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(bundleCards.length===0)return;
    setBusy(true);
    setSaveError('');
    const missingVaultItem=bundleCards.find(it=>!it.instanceId);
    if(missingVaultItem){
      setCollectionCardTarget(missingVaultItem);
      setCollectionOpen(true);
      setBusy(false);
      return;
    }
    try{
      const totalQty=bundleCards.reduce((sum,it)=>sum+it.quantity,0);
      const primary=bundleCards[0];
      const response=await fetch('/api/listings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        instanceId:primary.instanceId,
        title:listingTitle||primary.card.name,
        amount:Number(listingPrice),
        quantity:totalQty,
        city:listingCity||'Jakarta',
        type:'WTS',
        negotiable:listingNegotiable,
        items:bundleCards.map(item=>({
          instanceId:item.instanceId,
          printingId:item.printing.id,
          quantity:item.quantity,
          condition:item.condition,
          unitAmount:item.unitAmount,
        })),
      })});
      const result=await response.json() as {error?:string;id?:string};
      if(!response.ok)throw new Error(result.error??'Listing could not be published.');
      await refresh();
      await refreshAccount();
      setOpen(false);
      if(result.id){
        setPublishedShare({id:result.id,title:listingTitle||primary.card.name,price:Number(listingPrice),cards:[...bundleCards]});
        setBundleCards([]);
        toast.success(locale==='ID'?'Listing berhasil dipublikasikan':'Listing published');
      }
    }catch(cause){
      setSaveError((cause as Error).message);
    }finally{
      setBusy(false);
    }
  };
  const afterVaultSave=async()=>{
    await refreshAccount();
    setCollectionOpen(false);
    try{
      const fresh=await api<AccountState>('/api/state');
      if(collectionCardTarget&&fresh?.collection){
        const match=fresh.collection.find(it=>it.printingId===collectionCardTarget.printing.id);
        if(match){
          setBundleCards(prev=>prev.map(c=>c.id===collectionCardTarget.id?{...c,instanceId:match.id}:c));
        }
      }
    }catch{}
    setCollectionCardTarget(null);
  };
  const totalBundleQuantity=bundleCards.reduce((sum,c)=>sum+c.quantity,0);
  const totalCalculatedUnitSum=bundleCards.reduce((sum,c)=>sum+(c.unitAmount*c.quantity),0);
  return (
    <main className={`market-feed-page${modalOnly?' market-sell-modal-host':''}`}>
      <nav className="market-store-nav" aria-label="VivrePlay Market">
        <Link href="/" className="market-back-link">
          <ArrowLeft size={15}/>
          <VivreMark size={18}/>
          <span>VivrePlay</span>
        </Link>
        <i className="market-nav-divider"/>
        <Link href="/market" className="market-store-wordmark">
          <b>Market</b>
        </Link>
        <label className="market-store-search">
          <Search size={18}/>
          <input
            value={query}
            onChange={event=>setQuery(event.target.value)}
            placeholder={
              feedScope === 'cards'
                ? (locale==='ID'?'Cari kartu di katalog...':'Search cards in catalog...')
                : (locale==='ID'?'Cari listing di Market...':'Search market listings...')
            }
            aria-label={
              feedScope === 'cards'
                ? (locale==='ID'?'Cari kartu di katalog':'Search cards in catalog')
                : (locale==='ID'?'Cari listing di Market':'Search market listings')
            }
          />
        </label>
        <div className="masthead-actions market-store-actions">
        <MarketProDialog locale={locale} profile={data?.profile??null} accountLoading={accountLoading} member={accountLoading||String(data?.profile?.tier??'free').toLowerCase()==='pro'}/>
        <MarketCartSheet locale={locale}/>
        {data && (
          <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="market-account-trigger" aria-label={locale==='ID'?'Market saya: listing, penawaran, dan pesanan':'My Market: listings, offers, and orders'}><Store size={16} aria-hidden="true"/>{activityCounts.listings+activityCounts.offers+activityCounts.orders>0&&<span className="market-account-unread-badge">{Math.min(99,activityCounts.listings+activityCounts.offers+activityCounts.orders)}</span>}<span className="market-account-trigger-name">{locale==='ID'?'Market saya':'My Market'}</span><CaretDown size={14} aria-hidden="true"/></button></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={10} className="market-account-menu"><DropdownMenuLabel className="market-account-menu-label"><span className="market-account-menu-name">{data.profile.display_name||`@${data.profile.username}`}</span><span className="market-account-menu-handle">@{data.profile.username}</span></DropdownMenuLabel><DropdownMenuSeparator/><DropdownMenuItem className="market-account-menu-item" onSelect={()=>setAccountPanel('listings')}><ClipboardText size={16}/>{locale==='ID'?'Listing saya':'My listings'}{activityCounts.listings>0&&<span className="market-activity-badge">{activityCounts.listings>99?'99+':activityCounts.listings}</span>}</DropdownMenuItem><DropdownMenuItem className="market-account-menu-item" onSelect={()=>setAccountPanel('offers')}><OffersIcon size={16}/>{locale==='ID'?'Penawaran':'Offers'}{activityCounts.offers>0&&<span className="market-activity-badge">{activityCounts.offers>99?'99+':activityCounts.offers}</span>}</DropdownMenuItem><DropdownMenuItem className="market-account-menu-item" onSelect={()=>setAccountPanel('orders')}><OrdersIcon size={16}/>{locale==='ID'?'Pesanan':'Orders'}{activityCounts.orders>0&&<span className="market-activity-badge">{activityCounts.orders>99?'99+':activityCounts.orders}</span>}</DropdownMenuItem><DropdownMenuItem className="market-account-menu-item" onSelect={()=>setAccountPanel('saved')}><Bookmark size={16}/>{locale==='ID'?'Listing tersimpan':'Saved listings'}</DropdownMenuItem><DropdownMenuItem className="market-account-menu-item" onSelect={()=>setQuickPanel('wishlist')}><Heart size={16}/>{locale==='ID'?'Kartu incaran':'Wishlist'}</DropdownMenuItem><DropdownMenuItem className="market-account-menu-item" onSelect={()=>setQuickPanel('profile')}><UserRound size={16}/>{locale==='ID'?'Profil':'Profile'}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        )}
        <button type="button" className="market-store-link" onClick={()=>setQuickPanel('vault')}>
          {locale==='ID'?'Koleksi saya':'Vault'}
        </button>
        <button className="market-store-locale locale-toggle" type="button" onClick={toggleLocale} aria-label={locale==='ID'?'Ganti bahasa':'Switch language'}>
          {locale}
        </button>
        <button className="market-store-theme theme-toggle" type="button" onClick={toggleTheme} aria-label={locale==='ID'?`Gunakan mode ${theme==='light'?'gelap':'terang'}`:`Use ${theme==='light'?'dark':'light'} mode`}>
          {theme==='light'?<Moon size={17}/>:<Sun size={17}/>}
        </button>
        <button className="market-list-button join-link" type="button" onClick={beginListing} aria-label={data?(locale==='ID'?'Jual kartu':'Sell'):(locale==='ID'?'Masuk':'Sign in')}>
          {data?<Plus size={15}/>:<UserRound size={15}/>}
          <span className="market-list-button-text">
            {data?(locale==='ID'?'Jual kartu':'Sell'):(locale==='ID'?'Masuk':'Sign in')}
          </span>
          <span className="market-list-button-short">{data?(locale==='ID'?'Jual':'Sell'):(locale==='ID'?'Masuk':'Sign in')}</span>
        </button>
        </div>
      </nav>
      <div className="market-feed-shell">
        {printingFilter&&<div className="market-feed-note">{locale==='ID'?'Menampilkan cetakan yang dipilih':'Showing the selected printing'} <Link href="/market">{locale==='ID'?'Lihat semua listing':'View all listings'}</Link></div>}
        {initialCards.length>0&&(
          <div className="market-feed-note">
            {locale==='ID'?'Menampilkan kartu yang belum ada di deck Anda.':'Showing cards missing from your deck.'}{' '}
            <Link href="/market">{locale==='ID'?'Jelajahi seluruh Market':'Browse the whole market'}</Link>
          </div>
        )}
        <div className="market-feed-tabs">
          <div className="market-feed-tabs-main">
            <nav className="market-scope-nav" aria-label={locale === 'ID' ? 'Pilihan feed market' : 'Market feed view'}>
              <button
                type="button"
                className={`market-scope-tab ${feedScope === 'listings' ? 'is-active' : ''}`}
                onClick={() => setFeedScope('listings')}
              >
                <Store size={16} />
                <span>{locale === 'ID' ? 'Listing Market' : 'Market Listings'}</span>
                <span className="market-tab-badge">{displayListings.length}</span>
              </button>
              <button
                type="button"
                className={`market-scope-tab ${feedScope === 'cards' ? 'is-active' : ''}`}
                onClick={() => setFeedScope('cards')}
              >
                <Cards size={16} />
                <span>{locale === 'ID' ? 'Katalog Kartu' : 'Card Catalog'}</span>
              </button>
            </nav>
            {/* <div className="market-feed-tabs-meta">
              <span className="market-feed-tabs-caption">
                {feedScope === 'listings'
                  ? (locale === 'ID' ? 'Penawaran langsung dari para kolektor' : 'Direct offers and buy requests from collectors')
              : (locale === 'ID' ? 'Database kartu resmi untuk mencari, membeli, atau menyimpan kartu' : 'Official card database to browse, sell, or collect')}
              </span>
            </div> */}
            <div className="market-view-toggle" aria-label={locale === 'ID' ? 'Tampilan listing' : 'Listing view'}>
              <button
                type="button"
                className={listingView === 'list' ? 'active' : ''}
                onClick={() => setListingView('list')}
                aria-label={locale === 'ID' ? 'Tampilan daftar' : 'List view'}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                className={listingView === 'grid' ? 'active' : ''}
                onClick={() => setListingView('grid')}
                aria-label={locale === 'ID' ? 'Tampilan kisi' : 'Grid view'}
              >
                <Grid size={16} />
              </button>
            </div>
          </div>
          {feedScope === 'listings' && (
            <div className="market-feed-tabs-sub">
              <div className="market-trade-chips" role="group" aria-label={locale === 'ID' ? 'Filter tipe penawaran' : 'Filter offer type'}>
                <button
                  type="button"
                  className={`market-trade-chip ${tradeType === 'all' ? 'is-active' : ''}`}
                  onClick={() => setTradeType('all')}
                >
                  <span>{locale === 'ID' ? 'Semua' : 'All'}</span>
                  <small>({tradeCounts.all})</small>
                </button>
                <button
                  type="button"
                  className={`market-trade-chip ${tradeType === 'WTS' ? 'is-active' : ''}`}
                  onClick={() => setTradeType('WTS')}
                >
                  <span className="market-trade-dot is-wts" aria-hidden="true" />
                  <span>{locale === 'ID' ? 'Dijual (WTS)' : 'For Sale (WTS)'}</span>
                  <small>({tradeCounts.wts})</small>
                </button>
                <button
                  type="button"
                  className={`market-trade-chip ${tradeType === 'WTB' ? 'is-active' : ''}`}
                  onClick={() => setTradeType('WTB')}
                >
                  <span className="market-trade-dot is-wtb" aria-hidden="true" />
                  <span>{locale === 'ID' ? 'Dicari (WTB)' : 'Buying (WTB)'}</span>
                  <small>({tradeCounts.wtb})</small>
                </button>
              </div>
              <div className="market-feed-filters">
                <label>
                  {locale === 'ID' ? 'Bahasa:' : 'Language:'}
                  <Picker
                    label={locale === 'ID' ? 'Bahasa listing' : 'Listing language'}
                    value={lang}
                    onChange={v => setLang(v as typeof lang)}
                    options={[
                      { value: 'all', label: locale === 'ID' ? 'Semua bahasa' : 'All languages' },
                      { value: 'EN', label: 'EN' },
                      { value: 'JP', label: 'JP' },
                    ]}
                  />
                </label>
                <label>
                  {locale === 'ID' ? 'Urutan:' : 'Sort:'}
                  <Picker
                    label={locale === 'ID' ? 'Urutan listing' : 'Sort listings'}
                    value={sort}
                    onChange={v => setSort(v as typeof sort)}
                    options={[
                      { value: 'newest', label: locale === 'ID' ? 'Terbaru' : 'Newest' },
                      { value: 'price_asc', label: locale === 'ID' ? 'Harga: terendah' : 'Price: low to high' },
                      { value: 'price_desc', label: locale === 'ID' ? 'Harga: tertinggi' : 'Price: high to low' },
                    ]}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
        {error&&(
          <div className="error-text market-feed-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={()=>void refresh()}>{locale==='ID'?'Coba lagi':'Retry'}</button>
          </div>
        )}
        {feedScope === 'cards' ? (
          <MarketCardLookup
            value={query}
            listings={listings}
            onViewListings={(card) => {
              setQuery(card.code || card.name);
              setFeedScope('listings');
            }}
            onAddToVault={addToVault}
            onSell={sellCard}
            locale={locale}
          />
        ) : (
          <>
            <section className={`market-feed-list is-${listingView}`} aria-label={locale==='ID'?'Daftar listing Market aktif':'Live Market listings'}>
              {displayListings.map(listing=>{
                const items=listing.items?.length?listing.items:[{printingId:listing.printingId,quantity:listing.quantity}];
                const printing=printings.find(item=>item.id===items[0].printingId);
                const cardLanguage=listing.language??printing?.language??'EN';
                const totalCards=items.reduce((total,item)=>total+item.quantity,0);
                const content=(
                  <>
                    <div className={`market-feed-stack ${items.length===1?'is-single':''}`}>
                      {items.slice(0,3).map((item,index)=>{
                        const stackCard=(index===0&&listing.card)?listing.card:cardFor(item.printingId);
                        return stackCard?<div key={`${item.printingId}-${index}`} className="market-feed-art" style={{'--stack-index':index} as CSSProperties}><CardArt card={stackCard}/></div>:null;
                      })}
                      {items.length>3&&<span>+{items.length-3}</span>}
                    </div>
                    <div className="market-feed-copy">
                      <h2>{listing.title}</h2>
                      <p>{totalCards} {locale==='ID'?'kartu':(totalCards===1?'card':'cards')}{items.length===1&&<span className="market-feed-language">{cardLanguage}</span>}</p>
                      <small className="market-feed-meta">
                        <span className="market-feed-meta-primary"><span className="market-feed-location"><MapPin size={11}/>{listing.city}</span><span className="market-feed-seller">{locale==='ID'?'oleh':'by'} {listing.seller}</span></span>
                        <span className="market-feed-meta-secondary">{listing.type==='WTS'&&<ShippingCouriers couriers={listing.shippingCouriers??[]} language={locale}/>}{listing.createdAt&&<MarketTimestamp value={listing.createdAt}/>}</span>
                      </small>
                    </div>
                    <div className="market-feed-trade">
                      <div className="market-feed-status">
                        <b>{listing.type==='WTB'?(locale==='ID'?'Dicari':'Buying'):(locale==='ID'?'Dijual':'Selling')}</b>
                      </div>
                      <div className="market-feed-price">
                        <strong>{formatMoney(listing.amount,listing.currency)}</strong>
                      </div>
                    </div>
                  </>
                );
                const rowClass=`market-feed-row ${listing.type==='WTB'?'is-wtb':'is-wts'}${listing.isOwner?'':' has-row-action'}${!listing.isOwner&&listing.type==='WTS'&&items.length===1?' has-cart-action':''}`;
                return <article key={listing.id} className={`${rowClass} market-feed-entry`}>
                  <Link href={`/market/${listing.id}`} className="market-feed-row-link" aria-label={locale==='ID'?`Buka ${listing.title}`:`Open ${listing.title}`}>{content}</Link>
                  {!listing.isOwner&&<div className="market-feed-row-actions">
                    {listing.type==='WTS'&&items.length===1&&items[0].quantity>0&&<button type="button" className="button secondary is-icon-only market-feed-add-cart" title={locale==='ID'?'Tambahkan 1 kartu ke keranjang':'Add 1 card to cart'} aria-label={locale==='ID'?'Tambahkan 1 kartu ke keranjang':'Add 1 card to cart'} onClick={event=>{event.preventDefault();event.stopPropagation();addFeedListingToCart(listing,items[0].printingId,locale)}}><Cart size={17}/></button>}
                    <SaveListingButton listingId={listing.id} language={locale} iconOnly/>
                  </div>}
                </article>;
              })}
            </section>
            {listingsLoading&&<div className={`market-feed-skeleton is-${listingView}`} role="status" aria-label={locale==='ID'?'Memuat listing Market':'Loading Market listings'}>{Array.from({length:listingView==='grid'?6:5},(_,index)=><div className="market-feed-skeleton-row" key={index}><i/><span><b/><b/><small/></span><strong/></div>)}</div>}
            {!listingsLoading&&error&&(
              <div className="market-feed-empty" role="alert"><Store size={26}/><h2>{locale==='ID'?'Listing tidak dapat dimuat':'Listings could not load'}</h2><p>{locale==='ID'?'Coba lagi sebentar lagi.':'Try again in a moment.'}</p><button type="button" className="button secondary" onClick={()=>void refresh()}>{locale==='ID'?'Coba lagi':'Retry'}</button></div>
            )}
            {!listingsLoading&&!error&&!displayListings.length && (
              <div className="market-feed-empty">
                <Store size={26}/>
                <h2>{locale==='ID'?'Tidak ada listing yang cocok':'No matching listings'}</h2>
                <p>
                  {query.trim().length>0
                    ? (locale==='ID'?`Belum ada listing aktif untuk "${query}".`:`No active listings matched "${query}".`)
                    : (locale==='ID'?'Saat ini belum ada listing yang cocok dengan filter yang dipilih.':'There are currently no listings matching the selected filter.')}
                </p>
                {query.trim().length>0 && (
                  <button
                    type="button"
                    className="market-scope-switch-btn"
                    onClick={() => setFeedScope('cards')}
                  >
                    <Search size={14} />
                    {locale==='ID'?`Cari "${query}" di Katalog Kartu`:`Search "${query}" in Card Catalog`} &rarr;
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {/* Create Listing Modal Dialog */}
      <Dialog open={open} onOpenChange={next=>{if(!next)configLoadVersion.current++;setOpen(next)}}>
        <DialogContent className="listing-dialog market-sell-dialog">
          <div className="market-sell-heading">
            <div className="market-sell-heading-actions"><span>{locale==='ID'?'BUAT LISTING':'CREATE LISTING'}</span><button type="button" className="market-sell-manage-listings" onClick={()=>{setOpen(false);setAccountPanel('listings')}}><ClipboardText size={15}/>{locale==='ID'?'Listing saya':'My listings'}</button></div>
            <DialogTitle>
              {configuringCard
                ? (locale==='ID'?'Konfigurasi kartu.':'Configure card.')
                : bundleCards.length>0
                  ? (locale==='ID'?'Rincian listing paket.':'Bundle listing details.')
                  : (locale==='ID'?'Pilih kartu untuk dijual.':'Select card to sell.')
              }
            </DialogTitle>
            <DialogDescription>
              {configuringCard
                ? (locale==='ID'?'Pilih versi cetak, jumlah, dan harga per kartu.':'Select printing, quantity, and unit price.')
                : bundleCards.length>0
                  ? (locale==='ID'?'Atur rincian listing dan harga total paket.':'Review bundle cards and set overall price.')
                  : (locale==='ID'?'Cari kartu dari katalog atau pilih dari koleksi Anda.':'Search card from catalog or select from your Vault.')
              }
            </DialogDescription>
          </div>
          <div className="market-sell-body">
            {directSellLoading?<div className="market-direct-sell-loading" role="status" aria-label={locale==='ID'?'Memuat pilihan jual':'Loading sell options'}><span/><span/><span/></div>:<>
            {/* VIEW 1: Card Configuration Step */}
            {configuringCard&&activeCardObj?(
              <div className="listing-selection">
                <div className="listing-selection-left">
                  <div className="listing-selection-card-preview">
                    <CardArt card={activeCardObj}/>
                  </div>
                  <button
                    type="button"
                    className="listing-change-card-btn"
                    onClick={()=>{
                      configLoadVersion.current++;
                      setConfiguringCard(null);
                      if(bundleCards.length===0){
                        setCardSearch('');
                        setCardPrintings([]);
                      }
                    }}
                  >
                    <ArrowLeft size={13}/>
                    <span>{bundleCards.length>0?(locale==='ID'?'Kembali ke paket':'Back to bundle'):(locale==='ID'?'Ganti kartu':'Change card')}</span>
                  </button>
                </div>
                <div className="listing-selection-right">
                  <div className="listing-selection-header">
                    <p className="eyebrow">{locale==='ID'?'KARTU TERPILIH':'SELECTED CARD'}</p>
                    <h3>{activeCardObj.name}</h3>
                    <p className="listing-card-sub">
                      <span className="market-sell-code">{activeCardObj.code}</span>
                      <span>{activeCardObj.type}</span>
                      {activeCardObj.rarity&&<><span className="market-sell-rarity">{activeCardObj.rarity}</span></>}
                      {activeCardObj.setCode&&<><span>{activeCardObj.setCode}</span></>}
                      {activeCardObj.variant&&<><span className="listing-variant-tag">{locale==='ID'&&printingLabel(activeCardObj.variant)==='Standard'?'Standar':printingLabel(activeCardObj.variant)}</span></>}
                    </p>
                  </div>
                  {/* Printing Selector Strip */}
                  {cardPrintings.length>1&&(
                    <div className="listing-printings-section">
                      <div className="listing-printings-header">
                        <span>{locale==='ID'?'PILIH VERSI CETAK':'CHOOSE PRINTING'}</span>
                        {printingLanguages.length>1&&(
                          <div className="listing-printings-langs">
                            {printingLanguages.map(l=>(
                              <button
                                key={l}
                                type="button"
                                className={printingLang===l?'active':''}
                                onClick={()=>{
                                  const firstForLang=cardPrintings.find(p=>p.language===l);
                                  if(firstForLang){
                                    handleSelectPrinting(firstForLang.id);
                                  }
                                }}
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div key={printingLang} className="listing-printings-strip" role="radiogroup" aria-label={locale==='ID'?'Versi cetak kartu':'Card printings'}>
                        {cardPrintings.filter(p=>p.language===printingLang).map(p=>{
                          const isSelected=p.id===selectedPrintingId;
                          const label=printingLabel(p.variant);
                          const displayLabel=locale==='ID'&&label==='Standard'?'Standar':label;
                          const pillCard=printingToCard(configuringCard,p);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={`listing-printing-pill ${isSelected?'is-selected':''}`}
                              onClick={()=>handleSelectPrinting(p.id)}
                              aria-checked={isSelected}
                              role="radio"
                            >
                              <div className="listing-printing-thumb">
                                <CardArt card={pillCard}/>
                              </div>
                              <div className="listing-printing-info">
                                <strong>{displayLabel}</strong>
                                <small>{p.set_code??configuringCard.setCode??''} {p.rarity&&<span>{p.rarity}</span>}</small>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Yuyutei Benchmark & Auto IDR Conversion Box */}
                  {(activeCardObj.language==='JP'||benchmark)&&(
                    <div className="listing-benchmark-box">
                      <div className="listing-benchmark-info">
                        <div className="listing-benchmark-header">
                          <span className="listing-benchmark-badge">Yuyutei (YYT)</span>
                          {benchmarkLoading&&<small>{locale==='ID'?'Memeriksa tolok ukur...':'Checking benchmark...'}</small>}
                        </div>
                        {benchmark?(
                          <div className="listing-benchmark-price">
                            <span className="listing-benchmark-jpy">¥{benchmark.amount.toLocaleString()}</span>
                            <span className="listing-benchmark-approx">≈</span>
                            <strong className="listing-benchmark-idr">
                              Rp {Math.round((benchmark.normalizedAmount||(benchmark.amount*110))*benchmarkMultiplier/100).toLocaleString('id-ID')}
                            </strong>
                          </div>
                        ):(
                          <small>{locale==='ID'?'Belum ada data tolok ukur untuk cetakan JP ini.':'No benchmark available for this JP printing.'}</small>
                        )}
                      </div>
                      {benchmark?.amount&&(
                        <div className="listing-benchmark-actions">
                          <select
                            value={benchmarkMultiplier}
                            onChange={e=>setBenchmarkMultiplier(Number(e.target.value))}
                            aria-label={locale==='ID'?'Persentase rate':'Rate percentage'}
                          >
                            <option value={85}>85%</option>
                            <option value={90}>90%</option>
                            <option value={100}>100%</option>
                            <option value={110}>110%</option>
                            <option value={125}>125%</option>
                          </select>
                          <button
                            type="button"
                            className="listing-benchmark-apply-btn"
                            onClick={()=>{
                              const yytIdr=benchmark.normalizedAmount||Math.round(benchmark.amount*110);
                              setItemPrice(String(Math.round(yytIdr*benchmarkMultiplier/100)));
                            }}
                          >
                            {locale==='ID'?'Gunakan harga ini':'Use this price'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Vault Copy Selector or Condition Picker */}
                  {ownedCopiesForConfig.length>0?(
                    <fieldset className="market-owned-copy-picker">
                      <legend>{locale==='ID'?'Pilih salinan dari koleksi':'Choose a copy from your Vault'}</legend>
                      <div role="radiogroup" aria-label={locale==='ID'?'Salinan koleksi':'Vault copies'}>
                        {ownedCopiesForConfig.map(item=><button key={item.id} type="button" role="radio" aria-checked={itemInstance===item.id} className={itemInstance===item.id?'is-selected':''} onClick={()=>{setItemInstance(item.id);setItemCondition(item.condition||'NM')}}><span className="market-copy-condition">{item.condition||'NM'}</span><span>{item.quantity} {locale==='ID'?'salinan':'copies'}</span><small>{locale==='ID'?'Di koleksi':'In Vault'}</small></button>)}
                      </div>
                    </fieldset>
                  ):(
                    <div className="form-row">
                      <fieldset className="market-condition-field">
                        <legend>{locale==='ID'?'Kondisi kartu':'Card condition'}</legend>
                        <div className="market-condition-options" role="radiogroup" aria-label={locale==='ID'?'Kondisi kartu':'Card condition'}>
                          {[
                            {code:'NM',name:locale==='ID'?'Hampir baru':'Near Mint',hint:locale==='ID'?'Seperti baru':'Like new'},
                            {code:'LP',name:locale==='ID'?'Sedikit dimainkan':'Lightly Played',hint:locale==='ID'?'Sedikit bekas':'Minor wear'},
                            {code:'MP',name:locale==='ID'?'Cukup dimainkan':'Moderately Played',hint:locale==='ID'?'Terlihat bekas':'Visible wear'},
                            {code:'HP',name:locale==='ID'?'Sering dimainkan':'Heavily Played',hint:locale==='ID'?'Banyak bekas':'Heavy wear'},
                            {code:'DMG',name:locale==='ID'?'Rusak':'Damaged',hint:locale==='ID'?'Lipat atau rusak':'Creases or damage'},
                          ].map(option=><button key={option.code} type="button" role="radio" aria-checked={itemCondition===option.code} className={`market-condition-option ${itemCondition===option.code?'selected':''}`} onClick={()=>setItemCondition(option.code)}>
                            <b>{option.code}</b><span>{option.name}</span><small>{option.hint}</small>
                          </button>)}
                        </div>
                      </fieldset>
                    </div>
                  )}
                  {/* Quantity and Price Row */}
                  <div className="form-row">
                    <label>
                      {locale==='ID'?'Jumlah':'Quantity'}
                      <div className="market-sell-stepper-wrap">
                        <div className="market-sell-bundle-stepper">
                          <button
                            type="button"
                            onClick={()=>setItemQuantity(q=>Math.max(1,q-1))}
                            disabled={itemQuantity<=1}
                            aria-label={locale==='ID'?'Kurangi jumlah':'Decrease quantity'}
                          >
                            <Minus size={13}/>
                          </button>
                          <span>{itemQuantity}</span>
                          <button
                            type="button"
                            onClick={()=>{
                              const max=ownedCopiesForConfig.length>0?(ownedCopiesForConfig.find(c=>c.id===itemInstance)?.quantity||1):99;
                              setItemQuantity(q=>Math.min(max,q+1));
                            }}
                            disabled={ownedCopiesForConfig.length>0?itemQuantity>=(ownedCopiesForConfig.find(c=>c.id===itemInstance)?.quantity||1):false}
                            aria-label={locale==='ID'?'Tambah jumlah':'Increase quantity'}
                          >
                            <Plus size={13}/>
                          </button>
                        </div>
                      </div>
                    </label>
                    <label>
                      {locale==='ID'?'Harga per kartu (IDR)':'Price per card (IDR)'}
                      <input
                        type="number"
                        min="1"
                        step="1000"
                        inputMode="numeric"
                        autoComplete="off"
                        aria-describedby="market-unit-price-help"
                        value={itemPrice}
                        onChange={e=>setItemPrice(e.target.value)}
                        placeholder={locale==='ID'?'Contoh: 75000':'e.g. 75000'}
                        required
                      />
                      <small id="market-unit-price-help">{locale==='ID'?'Harga saran bisa diubah langsung sebelum ditambahkan.':'You can edit the suggested price before adding this card.'}</small>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="market-list-button"
                    disabled={!itemPrice||Number(itemPrice)<=0}
                    onClick={addConfiguredCardToBundle}
                  >
                    {bundleCards.length===0
                      ? (locale==='ID'?'Lanjut ke rincian listing':'Continue to listing details')
                      : (locale==='ID'?'+ Tambahkan ke paket':'+ Add to bundle')
                    }
                  </button>
                </div>
              </div>
            ):bundleCards.length>0&&!isAddingAnother?(
              /* VIEW 2: Bundle Review & Publish Form */
              <form className="form-stack" onSubmit={handlePublishListing}>
                <div className="market-sell-bundle">
                  <div className="market-sell-bundle-header">
                    <span>{locale==='ID'?'KARTU DALAM LISTING':'CARDS IN THIS LISTING'}</span>
                    <small>{totalBundleQuantity} {locale==='ID'?'kartu':(totalBundleQuantity===1?'card':'cards')}</small>
                  </div>
                  <div className="market-sell-bundle-list">
                    {bundleCards.map(item=>{
                      const label=printingLabel(item.printing.variant);
                      const displayLabel=locale==='ID'&&label==='Standard'?'Standar':label;
                      return (
                        <div key={item.id} className="market-sell-bundle-item">
                          <div className="market-sell-bundle-thumb">
                            <CardArt card={item.card}/>
                          </div>
                          <div className="market-sell-bundle-details">
                            <strong>{item.card.name}</strong>
                            <div className="market-sell-bundle-meta">
                              <span>{item.card.code}</span>
                              <span>{displayLabel}</span>
                              <span>{item.card.language??'EN'}</span>
                              <span className="listing-variant-tag">{item.condition}</span>
                              {!item.instanceId&&(
                                <span className="listing-variant-tag" style={{background:'color-mix(in srgb, #e5484d 15%, transparent)',color:'#e5484d'}}>
                                  {locale==='ID'?'Belum ada di koleksi':'Not in Vault'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="market-sell-bundle-stepper">
                            <button
                              type="button"
                              onClick={()=>{
                                setBundleCards(prev=>prev.map(c=>c.id===item.id?{...c,quantity:Math.max(1,c.quantity-1)}:c));
                              }}
                              disabled={item.quantity<=1}
                              aria-label={locale==='ID'?'Kurangi jumlah':'Decrease quantity'}
                            >
                              <Minus size={12}/>
                            </button>
                            <span>{item.quantity}</span>
                            <button
                              type="button"
                              onClick={()=>{
                                setBundleCards(prev=>prev.map(c=>{
                                  if(c.id!==item.id)return c;
                                  const max=c.instanceId?c.availableQuantity:99;
                                  return {...c,quantity:Math.min(max,c.quantity+1)};
                                }));
                              }}
                              disabled={item.instanceId?item.quantity>=item.availableQuantity:false}
                              aria-label={locale==='ID'?'Tambah jumlah':'Increase quantity'}
                            >
                              <Plus size={12}/>
                            </button>
                          </div>
                          <div className="market-sell-bundle-pricing">
                            <strong>Rp {(item.unitAmount*item.quantity).toLocaleString('id-ID')}</strong>
                            <small>Rp {item.unitAmount.toLocaleString('id-ID')} / kartu</small>
                          </div>
                          <button
                            type="button"
                            className="market-sell-bundle-remove"
                            onClick={()=>{
                              setBundleCards(prev=>prev.filter(c=>c.id!==item.id));
                            }}
                            aria-label={locale==='ID'?'Hapus kartu':'Remove card'}
                          >
                            <Trash size={15}/>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="market-sell-add-card-btn"
                    onClick={()=>{
                      setCardSearch('');
                      setConfiguringCard(null);
                      setIsAddingAnother(true);
                      setSearchSource('catalog');
                    }}
                  >
                    <Plus size={14}/>
                    <span>{locale==='ID'?'Tambah kartu lain ke listing (Bundle / Playset)':'Add another card to listing (Bundle / Playset)'}</span>
                  </button>
                </div>
                <label>
                  {locale==='ID'?'Judul listing':'Listing title'}
                  <input
                    value={listingTitle}
                    onChange={event=>setListingTitle(event.target.value)}
                    minLength={3}
                    maxLength={100}
                    required
                  />
                </label>
                <MarketPriceMode value={listingNegotiable} onChange={setListingNegotiable} language={locale}/>
                <div className="form-row">
                  <label>
                    {locale==='ID'?'Total harga listing (IDR)':'Total listing price (IDR)'}
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={listingPrice}
                      onChange={event=>setListingPrice(event.target.value)}
                      required
                    />
                    <small style={{fontSize:11,color:'var(--muted)',marginTop:3}}>
                      {locale==='ID'?`Total akumulasi satuan: Rp ${totalCalculatedUnitSum.toLocaleString('id-ID')}`:`Calculated sum: Rp ${totalCalculatedUnitSum.toLocaleString('id-ID')}`}
                    </small>
                  </label>
                  <label>
                    {locale==='ID'?'Dikirim dari':'Ships from'}
                    <input
                      value={listingCity}
                      onChange={event=>{
                        setListingCity(event.target.value);
                        window.localStorage.setItem('vivreplay-seller-city',event.target.value);
                      }}
                      placeholder="Jakarta"
                      minLength={2}
                      maxLength={60}
                      required
                    />
                  </label>
                </div>
                {saveError&&<p role="alert" className="error-text">{saveError}</p>}
                <button className="market-list-button" disabled={busy||bundleCards.length===0}>
                  {busy
                    ?(locale==='ID'?'Mempublikasikan...':'Publishing...')
                    :bundleCards.some(it=>!it.instanceId)
                      ?(locale==='ID'?'Simpan ke koleksi & publikasikan':'Save to Vault & Publish')
                      :(locale==='ID'?'Publikasikan listing':'Publish listing')
                  }
                </button>
              </form>
            ):(
              /* VIEW 3: Card Search & Vault Picker Step */
              <div>
                {bundleCards.length>0&&(
                  <button
                    type="button"
                    className="listing-change-card-btn"
                    style={{width:'fit-content',marginBottom:12}}
                    onClick={()=>setIsAddingAnother(false)}
                  >
                    <ArrowLeft size={13}/>
                    <span>{locale==='ID'?'Kembali ke rincian listing':'Back to listing details'}</span>
                  </button>
                )}
                {/* Segmented Source Switcher if user has Vault cards */}
                {bundleCards.length===0&&(data?.collection?.length??0)>0&&<button type="button" className="market-vault-bundle-start" onClick={()=>{configLoadVersion.current++;setOpen(false);setBulkListingOpen(true)}}><Cards size={16}/>{locale==='ID'?'Pilih beberapa kartu dari koleksi':'Select multiple cards from Vault'}</button>}
                {(data?.collection?.length??0)>0&&(
                  <div className="market-sell-source-toggle" role="tablist">
                    <button
                      type="button"
                      className={searchSource==='catalog'?'active':''}
                      onClick={()=>setSearchSource('catalog')}
                      role="tab"
                      aria-selected={searchSource==='catalog'}
                    >
                      <Search size={14}/>
                      <span>{locale==='ID'?'Cari di Katalog':'Search Catalog'}</span>
                    </button>
                    <button
                      type="button"
                      className={searchSource==='vault'?'active':''}
                      onClick={()=>setSearchSource('vault')}
                      role="tab"
                      aria-selected={searchSource==='vault'}
                    >
                      <WalletCards size={14}/>
                      <span>{locale==='ID'?`Dari koleksi saya (${data!.collection.length})`:`From My Vault (${data!.collection.length})`}</span>
                    </button>
                  </div>
                )}
                {searchSource==='vault'&&(data?.collection?.length??0)>0?(
                  <VaultCardPicker
                    items={data!.collection.map(copy=>({...copy,quantity:Math.max(0,copy.quantity-(copy.listedQuantity??0)-bundleCards.filter(item=>item.instanceId===copy.id).reduce((sum,item)=>sum+item.quantity,0))})).filter(copy=>copy.type==='RAW')}
                    onSelect={(card,instanceId,qty,cond)=>loadCardForConfig(card,instanceId,qty,cond)}
                    locale={locale}
                  />
                ):(
                  <CardSearch
                    value={cardSearch}
                    onChange={setCardSearch}
                    onSelect={card=>loadCardForConfig(card)}
                    locale={locale}
                  />
                )}
              </div>
            )}
            </>}
          </div>
        </DialogContent>
      </Dialog>
      {bulkListingOpen&&<BulkListingModal open={bulkListingOpen} onClose={()=>setBulkListingOpen(false)} language={locale} stacks={groupVaultStacks((data?.collection??[]).map(item=>enrichCollectionItem(item,new Set())))} onPublished={async()=>{await refresh();await refreshAccount()}}/>}
      {publishedShare&&<ShareButton title={publishedShare.title} path={`/market/${encodeURIComponent(publishedShare.id)}`} cards={publishedShare.cards.map(item=>({card:printingToCard(item.card,item.printing),quantity:item.quantity,condition:item.condition,unitAmount:item.unitAmount}))} subtitle={locale==='ID'?`${publishedShare.cards.reduce((sum,item)=>sum+item.quantity,0)} kartu untuk dijual`:`${publishedShare.cards.reduce((sum,item)=>sum+item.quantity,0)} cards for sale`} price={formatMoney(publishedShare.price,'IDR')} openOnMount hideTrigger onOpenChange={open=>{if(!open)setPublishedShare(null)}}/>}
      {data&&<Dialog open={Boolean(accountPanel)} onOpenChange={open=>{if(!open)setAccountPanel(null)}}><DialogContent className="market-account-dialog"><div className="market-account-dialog-heading"><DialogTitle>{accountPanel==='saved'?(locale==='ID'?'Listing tersimpan':'Saved listings'):accountPanel==='orders'?(locale==='ID'?'Pesanan Market':'Market orders'):accountPanel==='offers'?(locale==='ID'?'Penawaran':'Offers'):(locale==='ID'?'Listing saya':'My listings')}</DialogTitle></div><div className="market-account-dialog-tabs" role="tablist" aria-label={locale==='ID'?'Aktivitas Market':'Market activity'}><button type="button" role="tab" aria-selected={accountPanel==='listings'} className={accountPanel==='listings'?'is-active':''} onClick={()=>setAccountPanel('listings')}>{locale==='ID'?'Listing':'Listings'}{activityCounts.listings>0&&<span className="market-activity-badge">{activityCounts.listings>99?'99+':activityCounts.listings}</span>}</button><button type="button" role="tab" aria-selected={accountPanel==='offers'} className={accountPanel==='offers'?'is-active':''} onClick={()=>setAccountPanel('offers')}>{locale==='ID'?'Penawaran':'Offers'}{activityCounts.offers>0&&<span className="market-activity-badge">{activityCounts.offers>99?'99+':activityCounts.offers}</span>}</button><button type="button" role="tab" aria-selected={accountPanel==='orders'} className={accountPanel==='orders'?'is-active':''} onClick={()=>setAccountPanel('orders')}>{locale==='ID'?'Pesanan':'Orders'}{activityCounts.orders>0&&<span className="market-activity-badge">{activityCounts.orders>99?'99+':activityCounts.orders}</span>}</button><button type="button" role="tab" aria-selected={accountPanel==='saved'} className={accountPanel==='saved'?'is-active':''} onClick={()=>setAccountPanel('saved')}>{locale==='ID'?'Tersimpan':'Saved'}</button></div><div className="market-account-dialog-body">{accountPanel==='saved'?<SavedListings language={locale}/>:accountPanel==='orders'?<OrdersTab language={locale} initialOrderId={searchParams.get('order')}/>:accountPanel==='offers'?<OffersTab language={locale} initialConversationId={searchParams.get('conversation')}/>:<ListingsTab language={locale} onCreateListing={()=>{setAccountPanel(null);beginListing()}}/>}</div></DialogContent></Dialog>}
      {data&&<MarketQuickPanel panel={quickPanel} onOpenChange={open=>{if(!open)setQuickPanel(null)}} locale={locale} account={data} onRefresh={refreshAccount} onSaved={async()=>{await refreshAccount();setQuickPanel(null)}}/>}
      <AddEditItemModal
        key={`${marketVaultCard?.id??'market-card'}-${marketVaultOpen?'open':'closed'}`}
        open={marketVaultOpen}
        onClose={()=>{setMarketVaultOpen(false);setMarketVaultCard(null);}}
        onSaved={async()=>{if(data)await refreshAccount();}}
        initialCard={marketVaultCard??undefined}
        isAnonymous={!data}
        language={locale}
      />
      {/* Collection Form modal for syncing unowned draft card with Vault */}
      {collectionCardTarget&&(
        <CollectionForm
          key={collectionCardTarget.printing.id}
          printingId={collectionCardTarget.printing.id}
          catalogCard={collectionCardTarget.card}
          name={`${collectionCardTarget.card.name} (${collectionCardTarget.card.language||'EN'})`}
          submitLabel={locale==='ID'?'Simpan ke koleksi & lanjut':'Save to Vault & Continue'}
          language={locale}
          open={collectionOpen}
          onClose={()=>{
            setCollectionOpen(false);
            setCollectionCardTarget(null);
          }}
          onSaved={afterVaultSave}
        />
      )}
    </main>
  );
}
