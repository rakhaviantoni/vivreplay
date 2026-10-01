/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {
  ArrowLeftIcon as ArrowLeft,
  ArrowRightIcon as ArrowRight,
  CardsIcon as Cards,
  CheckIcon as Check,
  ListIcon as List,
  MapPinIcon as MapPin,
  MinusIcon as Minus,
  MoonIcon as Moon,
  PlusIcon as Plus,
  MagnifyingGlassIcon as Search,
  SquaresFourIcon as Grid,
  StorefrontIcon as Store,
  SunIcon as Sun,
  TrashIcon as Trash,
  UserIcon as UserRound,
  WalletIcon as WalletCards,
  XIcon as X,
} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {Card,cardFor,cards,printingFor,printings} from '@/packages/card-data/catalog';
import {createClient} from '@/utils/supabase/client';
import {displayCardName} from './card-name';
import {printingLabel} from './card-printing-selector';
import {CollectionItem,Listing,formatMoney} from '@/packages/domain';
import {marketListingPreviews} from '@/lib/market/listing-previews';
import {api,useAccount,type AccountState} from '@/lib/client';
import {CardArt} from './card-art';
import {Picker} from './catalog';
import {CollectionForm} from './collection-form';
import {VivreMark} from './brand-assets';
import {MarketTimestamp} from './market-timestamp';
import {ShippingOptions} from './market-listing-items';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {isPlayableSet} from '@/packages/domain/release-availability';

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

function searchedCard(identity:SearchIdentity):MarketCard|undefined {
  const printingsList=(identity.tcg_card_printings??[]).filter(item=>item.card_image_url&&isPlayableSet(item.set_code));
  const sorted=[...printingsList].sort((a,b)=>Number(a.language!=='EN')-Number(b.language!=='EN')+Number((a.variant??'').toLowerCase().includes('parallel'))-Number((b.variant??'').toLowerCase().includes('parallel')));
  const printing=sorted[0];
  if(!printing?.card_image_url)return undefined;
  const canonical=cards.find(card=>card.code===identity.code);
  const image={imageUrl:printing.card_image_url,imageSource:'external' as const,setCode:printing.set_code,language:printing.language,printingCode:printing.printing_code??identity.code,variant:printing.variant??undefined};
  const baseCard=canonical?{...canonical,...image}:{id:printing.id,code:identity.code,name:displayCardName(identity.name,identity.code),color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:printing.rarity??'',art:0,effect:identity.effect_text,...image};
  return {...baseCard,availablePrintings:printingsList.map(item=>({id:item.id,language:item.language,variant:item.variant,printing_code:item.printing_code,card_image_url:item.card_image_url,rarity:item.rarity,set_code:item.set_code}))};
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
                      <span className="market-sell-dot">·</span>
                      <span>{card.type}</span>
                      {card.rarity&&(
                        <>
                          <span className="market-sell-dot">·</span>
                          <span className="market-sell-rarity">{card.rarity}</span>
                        </>
                      )}
                      {card.setCode&&(
                        <>
                          <span className="market-sell-dot">·</span>
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
            onClick={()=>onSelect(card as MarketCard,item.id,item.quantity,item.condition||'NM')}
          >
            <div className="market-vault-card-thumb">
              <CardArt card={card}/>
            </div>
            <div className="market-vault-card-info">
              <strong>{card.name}</strong>
              <small>{card.code} · {item.condition} · {item.quantity} {locale==='ID'?'di Vault':'in Vault'}</small>
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
                    <span>·</span>
                    <span>{card.type}</span>
                    {card.color && (
                      <>
                        <span>·</span>
                        <span>{card.color}</span>
                      </>
                    )}
                    {card.rarity && (
                      <>
                        <span>·</span>
                        <span className="market-sell-rarity">{card.rarity}</span>
                      </>
                    )}
                    {card.setCode && (
                      <>
                        <span>·</span>
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
                    {locale === 'ID' ? 'Simpan ke Vault' : 'Add to Vault'}
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

export function Market({initialCards=[]}:{initialCards?:string[]}) {
  const {data,loading:accountLoading,refresh:refreshAccount}=useAccount();
  const searchParams=useSearchParams();
  const [listings,setListings]=useState<Listing[]>([]);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [lang,setLang]=useState<'all'|'EN'|'JP'>('all');
  const [sort,setSort]=useState<'newest'|'price_asc'|'price_desc'>('newest');
  const [tradeType,setTradeType]=useState<'all'|'WTS'|'WTB'>('all');
  const [listingView,setListingView]=useState<'list'|'grid'>('list');
  const [feedScope,setFeedScope]=useState<'listings'|'cards'>('listings');
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');

  // Bundle & Card Listing Draft State
  const [bundleCards,setBundleCards]=useState<ListingBundleCard[]>([]);
  const [configuringCard,setConfiguringCard]=useState<MarketCard|null>(null);
  const [cardPrintings,setCardPrintings]=useState<CardPrintingItem[]>([]);
  const [selectedPrintingId,setSelectedPrintingId]=useState<string>('');
  const [printingLang,setPrintingLang]=useState<'EN'|'JP'>('EN');
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
  const [listingCity,setListingCity]=useState('');

  // Benchmark State
  const [benchmark,setBenchmark]=useState<MarketBenchmark|null>(null);
  const [benchmarkLoading,setBenchmarkLoading]=useState(false);
  const [benchmarkMultiplier,setBenchmarkMultiplier]=useState(100);

  // Vault Sync Form
  const [collectionOpen,setCollectionOpen]=useState(false);
  const [collectionCardTarget,setCollectionCardTarget]=useState<ListingBundleCard|null>(null);

  useEffect(()=>{
    const next=window.localStorage.getItem('vivreplay-theme')==='dark'?'dark':'light';
    const language=window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN';
    setTheme(next);
    setLocale(language);
    const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
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
    try{
      const result=await api<{listings:Listing[]}>('/api/listings');
      setListings(result.listings);
      setError('');
    }catch(cause){
      setError(cause instanceof Error?cause.message:(locale==='ID'?'Listing tidak dapat dimuat sementara. Silakan coba lagi.':'Live listings are temporarily unavailable. Please retry.'));
    }
  }

  useEffect(()=>{void refresh()},[]);

  useEffect(()=>{
    const card=searchParams.get('card');
    if(!card)return;
    setQuery(cardFor(card)?.name??card);
  },[searchParams]);

  // Load printings and benchmark whenever a card is opened for configuration
  const loadCardForConfig=async(card:Card,presetInstanceId?:string,presetQty=1,presetCondition='NM')=>{
    setConfiguringCard(card as MarketCard);
    setItemQuantity(presetQty);
    setItemCondition(presetCondition);
    setItemInstance(presetInstanceId||'');
    setItemPrice('');
    setBenchmarkMultiplier(100);

    const lang=(card.language as 'EN'|'JP')||'EN';
    setPrintingLang(lang);

    if((card as MarketCard).availablePrintings?.length){
      const list=(card as MarketCard).availablePrintings!;
      setCardPrintings(list);
      const chosen=list.find(p=>p.id===card.id)||list[0];
      setSelectedPrintingId(chosen.id);
      return;
    }

    try{
      const client=createClient();
      let {data:lookup}=await client.from('tcg_card_printings').select('identity_id').eq('id',card.id).maybeSingle();
      if(!lookup){
        const {data:byCode}=await client.from('tcg_card_identities').select('id').ilike('code',card.code).maybeSingle();
        if(byCode)lookup={identity_id:byCode.id};
      }
      if(lookup?.identity_id){
        const {data:rows}=await client.from('tcg_card_printings').select('id,language,variant,rarity,set_code,printing_code,card_image_url').eq('identity_id',lookup.identity_id).order('language').order('variant');
        if(rows&&rows.length>0){
          const list=rows as CardPrintingItem[];
          setCardPrintings(list);
          const chosen=list.find(p=>p.id===card.id)||list[0];
          setSelectedPrintingId(chosen.id);
          return;
        }
      }
    }catch{}

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
    const legacy=cardFor(sell);
    if(legacy){
      sellCard(legacy);
      return;
    }
    let active=true;
    void (async()=>{
      const client=createClient();
      const {data}=await client.from('tcg_card_printings').select('id,card_image_url,rarity,set_code,language,tcg_card_identities!inner(code,name,color,card_type,cost,power,effect_text)').eq('id',sell).maybeSingle();
      if(!active||!data)return;
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
      return;
    }
    let active=true;
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
    return (data?.collection??[]).filter(c=>c.printingId===selectedPrintingId||cardFor(c.printingId)?.id===activeCardObj.id);
  },[activeCardObj,data?.collection,selectedPrintingId]);

  useEffect(()=>{
    if(ownedCopiesForConfig.length>0&&!ownedCopiesForConfig.some(c=>c.id===itemInstance)){
      setItemInstance(ownedCopiesForConfig[0].id);
      if(ownedCopiesForConfig[0].condition)setItemCondition(ownedCopiesForConfig[0].condition);
    }
  },[ownedCopiesForConfig,itemInstance]);

  const printingLanguages=useMemo(()=>[...new Set(cardPrintings.map(item=>item.language))],[cardPrintings]);

  const handleSelectPrinting=(printingId:string)=>{
    const chosen=cardPrintings.find(p=>p.id===printingId);
    if(!chosen||!configuringCard)return;
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

  const displayListings=useMemo(()=>{
    if(listings.length||query.trim()||initialCards.length)return visible;
    return marketListingPreviews
      .filter(listing=>tradeType==='all'||listing.type===tradeType)
      .filter(listing=>lang==='all'||lang==='EN')
      .filter(listing=>!query.trim()||[listing.title,...(listing.items??[]).flatMap(item=>[cardFor(item.printingId)?.name,cardFor(item.printingId)?.code])].some(value=>value?.toLowerCase().includes(query.trim().toLowerCase())));
  },[initialCards.length,lang,listings.length,query,tradeType,visible]);

  const tradeCounts = useMemo(() => {
    const base = listings.length ? listings : marketListingPreviews;
    const wts = base.filter(l => l.type === 'WTS').length;
    const wtb = base.filter(l => l.type === 'WTB').length;
    return { all: base.length, wts, wtb };
  }, [listings]);

  const signInToContinue=()=>{
    if(accountLoading){
      toast.message(locale==='ID'?'Memeriksa akun Anda...':'Checking your account...');
      return false;
    }
    if(data)return true;
    window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));
    return false;
  };

  const beginListing=()=>{
    if(!signInToContinue())return;
    setBundleCards([]);
    setConfiguringCard(null);
    setCardSearch('');
    setCardPrintings([]);
    setSaveError('');
    setListingPrice('');
    setListingTitle('');
    setIsAddingAnother(false);
    setSearchSource('catalog');
    setBenchmarkMultiplier(100);
    const savedCity=window.localStorage.getItem('vivreplay-seller-city')||'Jakarta';
    setListingCity(savedCity);
    setOpen(true);
  };

  const sellCard=(card:Card)=>{
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
    setOpen(true);
  };

  const addToVault=(card:Card)=>{
    if(!signInToContinue())return;
    loadCardForConfig(card);
    setCollectionCardTarget(null);
    setCollectionOpen(true);
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

    const owned=(data?.collection??[]).filter(c=>c.printingId===selectedPrintingId||cardFor(c.printingId)?.id===activeCardObj.id);
    const matchedInstance=itemInstance||owned[0]?.id;

    const newItem:ListingBundleCard={
      id:crypto.randomUUID(),
      card:activeCardObj,
      printing:chosenPrinting,
      instanceId:matchedInstance,
      quantity:itemQuantity,
      condition:itemCondition,
      unitAmount:Number(itemPrice)||0,
      availableQuantity:owned.find(c=>c.id===matchedInstance)?.quantity||4,
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
      await api('/api/listings',{
        instanceId:primary.instanceId,
        title:listingTitle||primary.card.name,
        amount:Number(listingPrice),
        quantity:totalQty,
        city:listingCity||'Jakarta',
        type:'WTS',
        items:bundleCards.map(item=>({
          instanceId:item.instanceId,
          printingId:item.printing.id,
          quantity:item.quantity,
          condition:item.condition,
          unitAmount:item.unitAmount,
        })),
      });
      await refresh();
      setOpen(false);
      setBundleCards([]);
      toast.success(locale==='ID'?'Listing berhasil dipublikasikan':'Listing published');
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
        const match=fresh.collection.find(it=>it.printingId===collectionCardTarget.printing.id||cardFor(it.printingId)?.id===collectionCardTarget.card.id);
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
    <main className="market-feed-page">
      <div className="market-store-promo">
        {locale==='ID'?'Koleksi yang tepat, satu kartu pada satu waktu.':'Build your collection, one exact card at a time.'}
      </div>

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
        <Link href="/vault" className="market-store-link">
          {locale==='ID'?'Vault saya':'Vault'}
        </Link>
        {data ? (
          <Link href="/profile" className="market-store-profile" aria-label={locale === 'ID' ? 'Buka profil saya' : 'Open my profile'}>
            <div className="market-profile-avatar">
              {data.profile.display_name?.charAt(0).toUpperCase() || data.profile.username?.charAt(0).toUpperCase() || <UserRound size={15}/>}
            </div>
            <span className="market-profile-name">{data.profile.display_name || `@${data.profile.username}`}</span>
          </Link>
        ) : (
          <button
            type="button"
            className="market-store-link market-signin-link"
            onClick={() => window.dispatchEvent(new CustomEvent('vivreplay:open-auth', { detail: 'sign-in' }))}
            aria-label={locale === 'ID' ? 'Masuk ke akun' : 'Sign in to account'}
          >
            <UserRound size={16} />
            <span>{locale === 'ID' ? 'Masuk' : 'Sign in'}</span>
          </button>
        )}
        <button className="market-store-locale" type="button" onClick={toggleLocale} aria-label={locale==='ID'?'Ganti bahasa':'Switch language'}>
          {locale}
        </button>
        <button className="market-store-theme" type="button" onClick={toggleTheme} aria-label={locale==='ID'?`Gunakan mode ${theme==='light'?'gelap':'terang'}`:`Use ${theme==='light'?'dark':'light'} mode`}>
          {theme==='light'?<Moon size={17}/>:<Sun size={17}/>}
        </button>
        <button className="market-list-button" onClick={beginListing}>
          <Plus size={15}/>
          <span className="market-list-button-text">
            {data?(locale==='ID'?'Jual kartu':'Sell'):(locale==='ID'?'Masuk untuk menjual':'Sign in to sell')}
          </span>
          <span className="market-list-button-short">{locale==='ID'?'Jual':'Sell'}</span>
        </button>
      </nav>

      <div className="market-feed-shell">
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

            <div className="market-feed-tabs-meta">
              <span className="market-feed-tabs-caption">
                {feedScope === 'listings'
                  ? (locale === 'ID' ? 'Penawaran langsung dari para kolektor' : 'Direct offers and buy requests from collectors')
                  : (locale === 'ID' ? 'Database kartu resmi untuk jual, beli, atau simpan ke Vault' : 'Official card database to browse, sell, or collect')}
              </span>
            </div>

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
                    onChange={v => setLang(v as any)}
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
                    onChange={v => setSort(v as any)}
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
            <section className={`market-feed-list is-${listingView}`} aria-label={locale==='ID'?'Daftar listing Market aktif':'Live marketplace listings'}>
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
                      <p>{totalCards} {locale==='ID'?'kartu':(totalCards===1?'card':'cards')}{items.length===1&&<> <i>·</i> {cardLanguage}</>}</p>
                      <small>
                        <MapPin size={11}/>{listing.city} <b>·</b> {listing.seller}
                        {listing.type==='WTS'&&<><b>·</b><ShippingOptions listingId={listing.id} courierCount={listing.shippingOptionCount??0} variant="compact"/></>}
                        {listing.createdAt&&<><b>·</b><MarketTimestamp value={listing.createdAt}/></>}
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
                const rowClass=`market-feed-row ${listing.type==='WTB'?'is-wtb':'is-wts'}`;
                return <a href={`/market/${listing.id}`} key={listing.id} className={rowClass} aria-label={locale==='ID'?`Buka ${listing.title}`:`Open ${listing.title}`}>{content}</a>;
              })}
            </section>

            {!displayListings.length && (
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="listing-dialog market-sell-dialog">
          <div className="market-sell-heading">
            <span>{locale==='ID'?'BUAT LISTING':'CREATE LISTING'}</span>
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
                  : (locale==='ID'?'Cari kartu dari katalog atau pilih dari Vault Anda.':'Search card from catalog or select from your Vault.')
              }
            </DialogDescription>
          </div>

          <div className="market-sell-body">
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
                      <span className="market-sell-dot">·</span>
                      <span>{activeCardObj.type}</span>
                      {activeCardObj.rarity&&<><span className="market-sell-dot">·</span><span className="market-sell-rarity">{activeCardObj.rarity}</span></>}
                      {activeCardObj.setCode&&<><span className="market-sell-dot">·</span><span>{activeCardObj.setCode}</span></>}
                      {activeCardObj.variant&&<><span className="market-sell-dot">·</span><span className="listing-variant-tag">{locale==='ID'&&printingLabel(activeCardObj.variant)==='Standard'?'Standar':printingLabel(activeCardObj.variant)}</span></>}
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
                                  setPrintingLang(l as 'EN'|'JP');
                                  const firstForLang=cardPrintings.find(p=>p.language===l);
                                  if(firstForLang&&firstForLang.id!==selectedPrintingId){
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
                      <div className="listing-printings-strip" role="radiogroup" aria-label={locale==='ID'?'Versi cetak kartu':'Card printings'}>
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
                                <small>{p.set_code??configuringCard.setCode??''} {p.rarity?`· ${p.rarity}`:''}</small>
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
                    <label>
                      {locale==='ID'?'Pilih salinan dari Vault':'Choose a Vault copy'}
                      <Picker
                        label={locale==='ID'?'Salinan Vault':'Vault copy'}
                        value={itemInstance}
                        onChange={v=>{
                          setItemInstance(v);
                          const chosen=ownedCopiesForConfig.find(c=>c.id===v);
                          if(chosen?.condition)setItemCondition(chosen.condition);
                        }}
                        options={ownedCopiesForConfig.map(item=>({
                          value:item.id,
                          label:`${item.condition} · ${item.quantity} ${locale==='ID'?'salinan di Vault':(item.quantity===1?'copy in Vault':'copies in Vault')}`,
                        }))}
                      />
                    </label>
                  ):(
                    <div className="form-row">
                      <label>
                        {locale==='ID'?'Kondisi kartu':'Card condition'}
                        <Picker
                          label={locale==='ID'?'Kondisi kartu':'Card condition'}
                          value={itemCondition}
                          onChange={setItemCondition}
                          options={['NM','LP','MP','HP','DMG']}
                        />
                      </label>
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
                        step="1"
                        value={itemPrice}
                        onChange={e=>setItemPrice(e.target.value)}
                        placeholder="Contoh: 75000"
                        required
                      />
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
                              <span>·</span>
                              <span>{displayLabel}</span>
                              <span>·</span>
                              <span>{item.card.language??'EN'}</span>
                              <span>·</span>
                              <span className="listing-variant-tag">{item.condition}</span>
                              {!item.instanceId&&(
                                <span className="listing-variant-tag" style={{background:'color-mix(in srgb, #e5484d 15%, transparent)',color:'#e5484d'}}>
                                  {locale==='ID'?'Belum di Vault':'Not in Vault'}
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
                      ?(locale==='ID'?'Simpan ke Vault & Publikasikan':'Save to Vault & Publish')
                      :(locale==='ID'?`Publikasikan listing (${totalBundleQuantity} kartu · Rp ${Number(listingPrice||0).toLocaleString('id-ID')})`:`Publish listing (${totalBundleQuantity} cards · Rp ${Number(listingPrice||0).toLocaleString('id-ID')})`)
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
                      <span>{locale==='ID'?`Dari Vault Saya (${data!.collection.length})`:`From My Vault (${data!.collection.length})`}</span>
                    </button>
                  </div>
                )}

                {searchSource==='vault'&&(data?.collection?.length??0)>0?(
                  <VaultCardPicker
                    items={data!.collection}
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Collection Form modal for syncing unowned draft card with Vault */}
      {collectionCardTarget&&(
        <CollectionForm
          key={collectionCardTarget.printing.id}
          printingId={collectionCardTarget.printing.id}
          catalogCard={collectionCardTarget.card}
          name={`${collectionCardTarget.card.name} · ${collectionCardTarget.card.language||'EN'}`}
          submitLabel={locale==='ID'?'Simpan ke Vault & Lanjut':'Save to Vault & Continue'}
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
