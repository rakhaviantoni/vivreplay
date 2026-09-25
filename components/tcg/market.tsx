/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {ArrowLeftIcon as ArrowLeft, MapPinIcon as MapPin, MoonIcon as Moon, PlusIcon as Plus, MagnifyingGlassIcon as Search, StorefrontIcon as Store, SunIcon as Sun, WalletIcon as WalletCards} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {Card,cardFor,cards,printingFor,printings} from '@/packages/card-data/catalog';
import {createClient} from '@/utils/supabase/client';
import {displayCardName} from './card-name';
import {Listing,formatMoney} from '@/packages/domain';
import {api,useAccount} from '@/lib/client';
import {CardArt} from './card-art';
import {Picker} from './catalog';
import {CollectionForm} from './collection-form';
import {DepthCarousel} from './depth-carousel';
import {VivreMark} from './brand-assets';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';

type MarketBenchmark={amount:number;currency:string;url:string|null;observedAt:string;confidence:string;normalizedAmount:number|null;normalizedCurrency:string|null};
type SearchIdentity={id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string;tcg_card_printings?:Array<{id:string;card_image_url:string|null;rarity:string|null;set_code:string;language:string;variant:string|null}>};
function searchedCard(identity:SearchIdentity):Card|undefined { const printing=(identity.tcg_card_printings??[]).filter(item=>item.card_image_url).sort((a,b)=>Number(a.language!=='EN')-Number(b.language!=='EN')+Number((a.variant??'').toLowerCase().includes('parallel'))-Number((b.variant??'').toLowerCase().includes('parallel')))[0];if(!printing?.card_image_url)return undefined;const canonical=cards.find(card=>card.code===identity.code);return canonical?{...canonical,imageUrl:printing.card_image_url,imageSource:'external',setCode:printing.set_code,language:printing.language}:{id:printing.id,code:identity.code,name:displayCardName(identity.name,identity.code),color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity:printing.rarity??'',art:0,effect:identity.effect_text,imageUrl:printing.card_image_url,imageSource:'external',setCode:printing.set_code,language:printing.language}; }
function CardSearch({value,onChange,onAddToVault,onSell}:{value:string;onChange:(value:string)=>void;onAddToVault:(card:Card)=>void;onSell:(card:Card)=>void}) {
  const [results,setResults]=useState<Card[]>([]); const [loading,setLoading]=useState(false);
  useEffect(()=>{const term=value.trim();if(term.length<2){setResults([]);setLoading(false);return}let active=true;const timer=window.setTimeout(async()=>{setLoading(true);const client=createClient();const {data}=await client.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text,tcg_card_printings(id,card_image_url,rarity,set_code,language,variant)').or(`code.ilike.%${term.replaceAll(',',' ')}%,name.ilike.%${term.replaceAll(',',' ')}%`).limit(7);if(active){const live=((data??[]) as SearchIdentity[]).map(searchedCard).filter((card):card is Card=>Boolean(card));setResults(live.length?live:cards.filter(card=>`${card.name} ${card.code}`.toLowerCase().includes(term.toLowerCase())).slice(0,7));setLoading(false)}},170);return()=>{active=false;window.clearTimeout(timer)}},[value]);
  return <div className="listing-card-search"><div className="header-search-input"><Search size={18}/><input autoFocus value={value} onChange={event=>onChange(event.target.value)} placeholder="Search a card name, number, or set"/><kbd>ESC</kbd></div><div className="header-search-results">{value.trim().length<2?<p>Search for a card by name or number.</p>:loading?<div className="header-search-skeleton" aria-label="Searching cards"><i/><i/><i/></div>:<><small className="header-search-group">Cards</small>{results.map(card=><div key={card.id} className="listing-search-card"><button type="button" className="header-search-result" onClick={()=>onSell(card)}><CardArt card={card}/><span><b>{card.name}</b><small>{card.code} · {card.type}</small></span></button><div><button type="button" onClick={()=>onAddToVault(card)}>Add to Vault</button><button type="button" onClick={()=>onSell(card)}>Sell</button></div></div>)}{!results.length&&<p>No cards matched that search.</p>}</>}</div></div>;
}
function MarketCardLookup({value,onAddToVault,onSell}:{value:string;onAddToVault:(card:Card)=>void;onSell:(card:Card)=>void}){
  const [results,setResults]=useState<Card[]>([]);const [loading,setLoading]=useState(false);
  useEffect(()=>{const term=value.trim();if(term.length<2){setResults([]);setLoading(false);return}let active=true;const timer=window.setTimeout(async()=>{setLoading(true);const client=createClient();const {data}=await client.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text,tcg_card_printings(id,card_image_url,rarity,set_code,language,variant)').or(`code.ilike.%${term.replaceAll(',',' ')}%,name.ilike.%${term.replaceAll(',',' ')}%`).limit(6);if(active){const live=((data??[]) as SearchIdentity[]).map(searchedCard).filter((card):card is Card=>Boolean(card));setResults(live.length?live:cards.filter(card=>`${card.name} ${card.code}`.toLowerCase().includes(term.toLowerCase())).slice(0,6));setLoading(false)}},170);return()=>{active=false;window.clearTimeout(timer)}},[value]);
  if(value.trim().length<2)return null;return <section className="market-card-lookup" aria-live="polite"><header><span>Cards</span><small>{loading?'Searching…':results.length?`${results.length} matches`:'No cards found'}</small></header>{loading?<div className="market-card-lookup-skeleton"><i/><i/><i/></div>:<div>{results.map(card=><article key={card.id}><Link href={`/cards/${card.code}`} className="market-card-lookup-art"><CardArt card={card}/></Link><div><strong>{card.name}</strong><span>{card.code} · {card.type}</span></div><div className="market-card-lookup-actions"><button type="button" onClick={()=>onAddToVault(card)}>Add to Vault</button><button type="button" onClick={()=>onSell(card)}>Sell</button></div></article>)}</div>}</section>;
}

export function Market({initialCards=[]}:{initialCards?:string[]}) {
  const {data,loading:accountLoading,refresh:refreshAccount}=useAccount();
  const searchParams=useSearchParams();
  const router=useRouter();
  const [listings,setListings]=useState<Listing[]>([]);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [lang,setLang]=useState('All languages');
  const [sort,setSort]=useState('Newest');
  const [open,setOpen]=useState(false);
  const [instance,setInstance]=useState('');
  const [selectedCard,setSelectedCard]=useState<Card>();
  const [cardSearch,setCardSearch]=useState('');
  const [collectionOpen,setCollectionOpen]=useState(false);
  const [continueToListing,setContinueToListing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  const [benchmark,setBenchmark]=useState<MarketBenchmark|null>(null);
  const [benchmarkLoading,setBenchmarkLoading]=useState(false);
  const [benchmarkMultiplier,setBenchmarkMultiplier]=useState(100);
  const [listingPrice,setListingPrice]=useState('');
  const [listingTitle,setListingTitle]=useState('');
  const [listingCity,setListingCity]=useState('');
  useEffect(()=>{const next=window.localStorage.getItem('vivreplay-theme')==='dark'?'dark':'light';const language=window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN';setTheme(next);setLocale(language)},[]);
  // Search results come from the live printing table, while the legacy demo cards use `printingFor`.
  // Preserve either valid printing id instead of assuming every result exists in the demo list.
  const selectedPrintingId=selectedCard?(printings.some(item=>item.id===selectedCard.id)?selectedCard.id:(printingFor(selectedCard.id,'EN')?.id??selectedCard.id)):undefined;
  const ownedInstances=(data?.collection??[]).filter(item=>selectedCard&&(item.printingId===selectedCard.id||cardFor(item.printingId)?.id===selectedCard.id));

  async function refresh(){try{const result=await api<{listings:Listing[]}>('/api/listings');setListings(result.listings);setError('')}catch(cause){setError((cause as Error).message)}}
  useEffect(()=>{void refresh()},[]);
  useEffect(()=>{const sell=searchParams.get('sell');if(!sell)return;const card=cardFor(sell);if(card){setSelectedCard(card);setOpen(true)}},[searchParams]);
  useEffect(()=>{if(!ownedInstances.some(item=>item.id===instance))setInstance(ownedInstances[0]?.id||'')},[instance,ownedInstances]);
  useEffect(()=>{if(!selectedPrintingId){setBenchmark(null);return}let active=true;setBenchmarkLoading(true);fetch(`/api/market/benchmark?printingId=${encodeURIComponent(selectedPrintingId)}`).then(async response=>response.ok?await response.json() as {benchmark?:MarketBenchmark|null}:{benchmark:null}).then(result=>{if(active)setBenchmark(result.benchmark??null)}).catch(()=>{if(active)setBenchmark(null)}).finally(()=>{if(active)setBenchmarkLoading(false)});return()=>{active=false}},[selectedPrintingId]);
  useEffect(()=>{if(benchmark?.normalizedAmount){setListingPrice(String(Math.round(benchmark.normalizedAmount*benchmarkMultiplier/100)))}},[benchmark,benchmarkMultiplier]);
  const visible=useMemo(()=>{
    const term=query.trim().toLowerCase();
    const matches=listings.filter(listing=>{
      const card=cardFor(listing.printingId); const printing=printings.find(item=>item.id===listing.printingId);
      return Boolean(card)&&(!initialCards.length||initialCards.includes(card!.id))&&(!term||[listing.title,card!.name,card!.code].some(value=>value.toLowerCase().includes(term)))&&(lang==='All languages'||printing?.language===lang);
    });
    return sort==='Price: low to high'?[...matches].sort((a,b)=>a.amount-b.amount):matches;
  },[initialCards,lang,listings,query,sort]);
  const signInToContinue=(returnTo='/market')=>{if(accountLoading){toast.message('Checking your account…');return false}if(data)return true;router.push(`/sign-in?return_to=${encodeURIComponent(returnTo)}`);return false};
  const beginListing=()=>{if(!signInToContinue())return;setCollectionOpen(false);setContinueToListing(false);setSelectedCard(undefined);setCardSearch('');setSaveError('');setListingPrice('');setListingTitle('');setListingCity('');setBenchmarkMultiplier(100);setOpen(true)};
  const sellCard=(card:Card)=>{if(!signInToContinue(`/market?sell=${card.id}`))return;setCollectionOpen(false);setContinueToListing(false);setSelectedCard(card);setCardSearch(card.name);setSaveError('');setListingPrice('');setListingTitle(card.name);setListingCity('Jakarta');setBenchmarkMultiplier(100);setOpen(true)};
  const addToVault=(card:Card)=>{if(!signInToContinue(`/market?sell=${card.id}`))return;setSelectedCard(card);setContinueToListing(false);setCollectionOpen(true)};
  const toggleTheme=()=>{const next=theme==='light'?'dark':'light';setTheme(next);document.documentElement.dataset.theme=next;window.localStorage.setItem('vivreplay-theme',next);window.dispatchEvent(new CustomEvent('vivreplay:theme',{detail:next}));};
  const toggleLocale=()=>{const next=locale==='EN'?'ID':'EN';setLocale(next);document.documentElement.lang=next==='ID'?'id':'en';window.localStorage.setItem('vivreplay-locale',next);window.dispatchEvent(new CustomEvent('vivreplay:locale',{detail:next}));};
  const afterVaultSave=async()=>{await refreshAccount();setCollectionOpen(false);if(continueToListing){setContinueToListing(false);setOpen(true)}};

  return <main className="market-feed-page"><div className="market-store-promo">{locale==='ID'?'Koleksi yang tepat, satu kartu pada satu waktu.':'Build your collection, one exact card at a time.'}</div><nav className="market-store-nav" aria-label="VivrePlay Market"><Link href="/" className="market-back-link"><ArrowLeft size={15}/><VivreMark size={18}/><span>VivrePlay</span></Link><i className="market-nav-divider"/><Link href="/market" className="market-store-wordmark"><b>Market</b></Link><label className="market-store-search"><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={locale==='ID'?'Cari kartu atau listing':'Search cards and listings'} aria-label="Search cards and listings"/></label><Link href="/vault" className="market-store-link">{locale==='ID'?'Vault saya':'Vault'}</Link><button className="market-store-locale" type="button" onClick={toggleLocale} aria-label="Switch language">{locale}</button><button className="market-store-theme" type="button" onClick={toggleTheme} aria-label={`Use ${theme==='light'?'dark':'light'} mode`}>{theme==='light'?<Moon size={17}/>:<Sun size={17}/>}</button><button className="market-list-button" onClick={beginListing}><Plus size={15}/>{locale==='ID'?'Jual':'Sell'}</button></nav><div className="market-feed-shell">


    {initialCards.length>0&&<div className="market-feed-note">Showing cards missing from your deck. <Link href="/market">Browse the whole market</Link></div>}
    <MarketCardLookup value={query} onAddToVault={addToVault} onSell={sellCard}/>
    <div className="market-feed-tabs"><button className="active">Feed</button><span>Latest offers from collectors</span><div><Picker label="Listing language" value={lang} onChange={setLang} options={['All languages','EN','JP']}/><Picker label="Sort listings" value={sort} onChange={setSort} options={['Newest','Price: low to high']}/></div></div>
    {error&&<p className="error-text market-feed-error" role="alert">Live listings could not load. {error}</p>}
    <section className="market-feed-list" aria-label="Live marketplace listings">{visible.map(listing=>{
      const card=cardFor(listing.printingId)!; const printing=printings.find(item=>item.id===listing.printingId);
      return <Link href={`/market/${listing.id}`} key={listing.id} className="market-feed-row">
        <div className="market-feed-art"><CardArt card={card}/></div>
        <div className="market-feed-copy"><h2>{listing.title}</h2><p>{card.name} <i>·</i> {card.code} <i>·</i> {printing?.language||'EN'}</p><small><MapPin size={11}/>{listing.city} <b>·</b> {listing.seller}</small></div>
        <div className="market-feed-status"><b>{listing.type||'WTS'}</b><span>{listing.quantity} available</span></div>
        <div className="market-feed-price"><strong>{formatMoney(listing.amount,listing.currency)}</strong><span>{listing.condition}</span></div>
      </Link>;
    })}</section>
    {!visible.length&&query.trim().length<2&&<div className="market-feed-empty"><Store size={22}/><h2>No live listings yet</h2><p>Search for a card, or be the first collector to list one.</p><button className="market-list-button" onClick={beginListing}><Plus size={15}/>Sell a card</button></div>}
  </div>

  <Dialog open={open} onOpenChange={setOpen}><DialogContent className="listing-dialog market-sell-dialog"><div className="market-sell-heading"><span>CREATE LISTING</span><DialogTitle>Create a card listing.</DialogTitle><DialogDescription>Select the exact printing and set the details. Vault is only needed when you publish.</DialogDescription></div>{Boolean(data?.collection.length)&&<section className="listing-vault-carousel"><header><span>FROM YOUR VAULT</span><small>Choose a card</small></header><DepthCarousel className="listing-depth-carousel" label="Cards in your Vault" items={data!.collection.map(item=>{const card=cardFor(item.printingId);return card?{id:item.id,label:`Choose ${card.name}`,onSelect:()=>{setSelectedCard(card);setCardSearch(card.name)},content:<CardArt card={card}/>} : null}).filter((item):item is NonNullable<typeof item>=>Boolean(item))}/></section>}{!selectedCard?<CardSearch value={cardSearch} onChange={setCardSearch} onAddToVault={addToVault} onSell={sellCard}/>:<div className="listing-selection"><button type="button" className="listing-selection-card" onClick={()=>{setSelectedCard(undefined);setCardSearch('')}}><CardArt card={selectedCard}/><span>Change card</span></button><div><p className="eyebrow">SELECTED CARD</p><h3>{selectedCard.name}</h3><p>{selectedCard.code} · {selectedCard.type}</p>{ownedInstances.length?<><label>Choose a Vault copy<Picker label="Vault copy" value={instance} onChange={setInstance} options={ownedInstances.map(item=>({value:item.id,label:`${item.condition} · ${item.quantity} ${item.quantity===1?'copy':'copies'} in Vault`}))}/></label><p className="listing-sync-note"><WalletCards size={15}/> Listed copies stay connected to your Vault.</p></>:<form className="form-stack listing-draft-form" onSubmit={event=>{event.preventDefault();setContinueToListing(true);setOpen(false);setCollectionOpen(true)}}><p>Set the listing details. Add the exact printing to Vault only when you are ready to publish.</p><label>Listing title<input value={listingTitle} onChange={event=>setListingTitle(event.target.value)} minLength={3} maxLength={100} required/></label><div className="form-row"><label>Price per card (IDR)<input type="number" min="1" value={listingPrice} onChange={event=>setListingPrice(event.target.value)} required/></label><label>Ships from<input value={listingCity} onChange={event=>setListingCity(event.target.value)} minLength={2} maxLength={60} required/></label></div><button type="submit" className="market-list-button">Continue to publish</button></form>}</div></div>}{selectedCard&&ownedInstances.length>0&&<form className="form-stack listing-form" onSubmit={async event=>{event.preventDefault();setBusy(true);setSaveError('');const form=new FormData(event.currentTarget);try{await api('/api/listings',{instanceId:instance,title:String(form.get('title')),amount:Number(form.get('amount')),quantity:Number(form.get('quantity')),city:String(form.get('city')),type:'WTS'});await refresh();setOpen(false);toast.success('Listing published')}catch(cause){setSaveError((cause as Error).message)}finally{setBusy(false)}}}><label>Listing title<input name="title" value={listingTitle||selectedCard.name} onChange={event=>setListingTitle(event.target.value)} minLength={3} maxLength={100} required/></label><div className="listing-benchmark"><div><strong>Yuyutei benchmark</strong><span>{benchmarkLoading?'Checking current benchmark…':benchmark?`${benchmark.currency==='JPY'?'¥':''}${benchmark.amount.toLocaleString()} · ${benchmark.confidence}`:'No imported benchmark for this JP printing yet.'}</span></div>{benchmark?.normalizedAmount&&<label>Rate <select value={benchmarkMultiplier} onChange={event=>setBenchmarkMultiplier(Number(event.target.value))}><option value={85}>85%</option><option value={90}>90%</option><option value={100}>100%</option><option value={110}>110%</option><option value={125}>125%</option></select></label>}</div><div className="form-row"><label>Price per card (IDR)<input name="amount" type="number" min="1" step="1" value={listingPrice} onChange={event=>setListingPrice(event.target.value)} required/></label><label>Quantity<input name="quantity" type="number" min="1" max={ownedInstances.find(item=>item.id===instance)?.quantity||1} defaultValue="1" required/></label></div><label>Ships from<input name="city" value={listingCity} onChange={event=>setListingCity(event.target.value)} placeholder="Jakarta" minLength={2} maxLength={60} required/></label>{saveError&&<p role="alert" className="error-text">{saveError}</p>}<button className="market-list-button" disabled={busy||!instance}>{busy?'Publishing…':'Publish listing'}</button></form>}</DialogContent></Dialog>
  {selectedPrintingId&&<CollectionForm key={selectedPrintingId} printingId={selectedPrintingId} catalogCard={selectedCard} name={`${selectedCard?.name} · EN`} submitLabel={continueToListing?'Add to Vault & continue':'Add to Vault'} open={collectionOpen} onClose={()=>{setCollectionOpen(false);setContinueToListing(false)}} onSaved={afterVaultSave}/>}
  </main>;
}
