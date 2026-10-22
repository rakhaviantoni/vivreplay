/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {SaveListingButton} from './market-saved';
import {useRouter,useSearchParams} from 'next/navigation';
import {
  ArrowLeftIcon as ArrowLeft,
  ArrowRightIcon as ArrowRight,
  ArrowsDownUpIcon as ArrowsDownUp,
  CheckIcon as Check,
  CardsIcon as Cards,
  CardsIcon as VaultIcon,
  CaretDownIcon as ChevronDown,
  ListIcon as List,
  MapPinIcon as MapPin,
  MinusIcon as Minus,
  PlusIcon as Plus,
  MagnifyingGlassIcon as Search,
  SquaresFourIcon as Grid,
  UserIcon as UserRound,
  ClipboardTextIcon as ClipboardText,
  ShoppingCartIcon as Cart,
  SlidersHorizontalIcon as SlidersHorizontal,
  StorefrontIcon as Store,
  TrashIcon as Trash,
  TranslateIcon as Translate,
  WalletIcon as WalletCards,
  XIcon as X,
} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {Card,cardFor,cards,printings} from '@/packages/card-data/catalog';
import {displayCardName} from './card-name';
import {printingLabel} from './card-printing-selector';
import {pokemonRarityLabel} from '@/lib/pokemon-rarity';
import {CollectionItem,Listing,formatMoney} from '@/packages/domain';
import {api,useAccount,type AccountState} from '@/lib/client';
import {loadMarketActivityCounts} from '@/lib/market/activity-client';
import {CardArt} from './card-art';
import {FeedbackLaunchButton} from './feedback-launch';
import {CardMarketPanel} from './card-market-panel';
import {MultiFilter,Picker} from './catalog';
import {EnergySymbol,energyTypeFromName} from './pokemon-card-text';
import {CollectionForm} from './collection-form';
import {AddEditItemModal} from './vault/modals/add-edit-item-modal';
import {MarketTimestamp} from './market-timestamp';
import {calculateSellerServiceFee,LISTING_POLICIES} from '@/lib/market/policy';
import {ShippingCouriers} from './market-listing-items';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {MarketPriceMode} from './market-price-mode';
import {ShareButton} from './share';
import {BulkListingModal} from './vault/modals/bulk-listing-modal';
import {Slider} from '@/components/ui/slider';
import {MarketQuickPanel} from './market-quick-panel';
import {MarketStoreNav} from './market-store-nav';
import {enrichCollectionItem,groupVaultStacks} from './vault/vault-utils';
import {isPlayableSet} from '@/packages/domain/release-availability';
import {uniquePrintingIds,matchingPrintingCopies,selectedPrintingCopy} from '@/lib/market/printing-selection';
import {marketListingPath} from '@/lib/market/listing-url';
import {listingLimitMessage,listingLimitViolation} from '@/lib/market/listing-limits';
import {useMarketListingLimits} from '@/lib/market/use-listing-limits';
import {versionedCardCatalogUrl} from '@/lib/card-catalog-cache';
import '@/app/market-account.css';
type MarketBenchmark={amount:number;currency:string;url:string|null;observedAt:string;confidence:string;normalizedAmount:number|null;normalizedCurrency:string|null};
type CardPrintingItem={id:string;language:string;variant:string|null;printing_code:string|null;card_image_url:string|null;rarity?:string|null;set_code?:string;tcg_card_assets?:Array<{kind:string;object_key:string}>};
type MarketCard=Card&{availablePrintings?:CardPrintingItem[];gameSlug?:'one-piece'|'pokemon';pokemonTypes?:string[];pokemonCategory?:string;pokemonSetName?:string;pokemonIllustrator?:string};
type SearchIdentity={id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string;tcg_card_printings?:Array<{id:string;card_image_url:string|null;rarity:string|null;set_code:string;language:string;variant:string|null;printing_code:string|null;tcg_card_assets?:Array<{kind:string;object_key:string}>}>};
type PokemonMarketCard={id:string;rarity?:string|null;variant:string;set_code:string;set_name:string;printing_code:string;language:string;card_image_url?:string|null;source_payload?:{illustrator?:string;category?:string;types?:string[];rarity?:string;localId?:string;set?:{name?:string;cardCount?:{official?:number;total?:number}};[key:string]:unknown};tcg_card_identities?:{code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string}};
type PokemonMarketSet={code:string;name:string;series?:string;releaseYear?:number;productImageUrl?:string};
type PokemonMarketFacets={rarities?:string[];illustrators?:string[];types?:string[];categories?:string[];stages?:string[]};
type PokemonSearchOptions={language:string;sets:string[];types:string[];rarities:string[];categories:string[];stages:string[];illustrators:string[];hpMin:string;hpMax:string};
type CardSearchFilters={nameTerms:string[];code:string|null;setCode:string|null;cardType:string|null;rarities:string[];color:string|null;cost:number|null};
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
type PublishedShare={id:string;title:string;price:number;cards:ListingBundleCard[];seller?:string;city?:string;expiresAt?:string;timeZone?:string};
function PokemonMarketType({card}:{card:MarketCard}){
  if(card.pokemonCategory==='Energy'){
    const type=energyTypeFromName(card.name);
    return type?<EnergySymbol type={type}/>:<span>Energy</span>;
  }
  return <span>{card.pokemonTypes?.join(' / ')||card.pokemonCategory||card.type}</span>;
}
function MarketLookupCardThumb({card,gameSlug}:{card:MarketCard;gameSlug:'one-piece'|'pokemon'}){
  const [missing,setMissing]=useState(false);
  return <div className="market-card-lookup-art-wrap"><Link href={gameSlug==='pokemon'?`/pokemon?q=${encodeURIComponent(card.name)}`:`/cards/${card.code}`} className="market-card-lookup-art"><CardArt card={card} small onImageMissing={()=>setMissing(true)}/></Link>{gameSlug==='pokemon'&&missing&&<FeedbackLaunchButton className="market-lookup-missing-image" request={{initialCategory:'missing-printing',cardCode:card.code,printingId:card.id}} title="Report this missing card image">Report</FeedbackLaunchButton>}</div>;
}
function addFeedListingToCart(listing:Listing,printingId:string,locale:'EN'|'ID'){
  const cartKey='vivreplay-market-cart-v1';
  let cart:{lines:{listingId:string;listingTitle:string;items:{printingId:string;quantity:number}[]}[]}={lines:[]};
  try{const saved=JSON.parse(window.localStorage.getItem(cartKey)||'null');if(saved&&Array.isArray(saved.lines))cart={lines:saved.lines.filter((line:{listingId?:unknown;items?:unknown})=>typeof line.listingId==='string'&&Array.isArray(line.items)).map((line:{listingId:string;listingTitle?:string;items:{printingId:string;quantity:number}[]})=>({listingId:line.listingId,listingTitle:line.listingTitle??'',items:line.items.filter(item=>typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&item.quantity>0).map(item=>({printingId:item.printingId,quantity:item.quantity}))}))};}catch{}
  if(cart.lines.some(line=>line.listingId===listing.id&&line.items.some(item=>item.printingId===printingId)))return false;
  // Keep listings from every seller in the cart; checkout chooses one seller at a time.
  if(!cart.lines.some(line=>line.listingId===listing.id)&&cart.lines.length>=10){toast.error(locale==='ID'?'Keranjang dapat berisi hingga 10 listing.':'A cart can hold up to 10 listings.');return;}
  const line=cart.lines.find(item=>item.listingId===listing.id);
  if(line){const existing=line.items.find(item=>item.printingId===printingId);if(existing)return false;line.items.push({printingId,quantity:1});}
  else cart.lines.push({listingId:listing.id,listingTitle:listing.title,items:[{printingId,quantity:1}]});
  window.localStorage.setItem(cartKey,JSON.stringify(cart));window.dispatchEvent(new Event('vivreplay:market-cart-updated'));
  toast.success(locale==='ID'?'1 kartu ditambahkan':'Added 1 card',{action:{label:locale==='ID'?'Lihat keranjang':'View cart',onClick:()=>window.dispatchEvent(new Event('vivreplay:open-market-cart'))}});
  return true;
}
function MarketFeedCartButton({listing,printingId,locale}:{listing:Listing;printingId:string;locale:'EN'|'ID'}){
  const [inCart,setInCart]=useState(false);
  useEffect(()=>{
    const sync=()=>{try{const cart=JSON.parse(window.localStorage.getItem('vivreplay-market-cart-v1')||'null');setInCart(Boolean(cart?.lines?.some((line:{listingId:string;items:{printingId:string}[]})=>line.listingId===listing.id&&line.items.some(item=>item.printingId===printingId))))}catch{setInCart(false)}};
    sync();window.addEventListener('vivreplay:market-cart-updated',sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener('vivreplay:market-cart-updated',sync);window.removeEventListener('storage',sync)};
  },[listing.id,printingId]);
  const label=locale==='ID'?(inCart?'Sudah di keranjang':'Tambahkan 1 kartu ke keranjang'):(inCart?'In cart · View cart':'Add 1 card to cart');
  return <button type="button" className={`button secondary is-icon-only market-icon-action market-feed-add-cart${inCart?' is-in-cart':''}`} title={label} aria-label={label} aria-pressed={inCart} onClick={event=>{event.preventDefault();event.stopPropagation();if(inCart){window.dispatchEvent(new Event('vivreplay:open-market-cart'));return;}addFeedListingToCart(listing,printingId,locale)}}>{inCart?<Check size={17}/>:<Cart size={17}/>}</button>;
}
function printingToCard(baseCard:MarketCard,p:CardPrintingItem):MarketCard{
  return {
    ...baseCard,
    id:p.id,
    setCode:p.set_code??baseCard.setCode,
    language:p.language,
    printingCode:p.printing_code??baseCard.code,
    variant:p.variant??undefined,
    rarity:baseCard.gameSlug==='pokemon'?pokemonRarityLabel(p.rarity??baseCard.rarity,p.language):(p.rarity??baseCard.rarity),
    imageUrl:p.card_image_url??baseCard.imageUrl,
    assetPath:p.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key??baseCard.assetPath,
    imageSource:'external',
  };
}
function uniqueCardPrintings(items:CardPrintingItem[]):CardPrintingItem[]{
  return uniquePrintingIds(items);
}
function marketRarity(card:Card|undefined,language?:string){
  if(!card)return '';
  return (card as MarketCard).gameSlug==='pokemon'?pokemonRarityLabel(card.rarity,language??card.language):card.rarity;
}
function marketCardIdentity(card:Card){
  return `${(card as MarketCard).gameSlug??'one-piece'}:${card.code}`;
}
function marketListingLimit(items:ListingBundleCard[],limits:ReturnType<typeof useMarketListingLimits>){
  const identities=new Map(items.map(item=>[item.printing.id,marketCardIdentity(item.card)]));
  return listingLimitViolation(items.map(item=>({printingId:item.printing.id,quantity:item.quantity})),identities,limits);
}
function searchedCard(identity:SearchIdentity,gameSlug:'one-piece'|'pokemon'='one-piece'):MarketCard|undefined {
  const printingsList=(identity.tcg_card_printings??[]).filter(item=>(item.card_image_url||item.tcg_card_assets?.some(asset=>asset.kind==='small'&&asset.object_key))&&(gameSlug==='pokemon'||isPlayableSet(item.set_code)));
  const sorted=[...printingsList].sort((a,b)=>Number(a.language!=='EN')-Number(b.language!=='EN')+Number((a.variant??'').toLowerCase().includes('parallel'))-Number((b.variant??'').toLowerCase().includes('parallel')));
  const printing=sorted[0];
  if(!printing)return undefined;
  const canonical=cards.find(card=>card.code===identity.code);
  const image={imageUrl:printing.card_image_url??undefined,imageSource:'external' as const,setCode:printing.set_code,language:printing.language,printingCode:printing.printing_code??identity.code,variant:printing.variant??undefined,assetPath:printing.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key};
  const rawRarity=printing.rarity??'';
  const rarity=gameSlug==='pokemon'?pokemonRarityLabel(rawRarity,printing.language):rawRarity;
  const baseCard=canonical?{...canonical,...image,rarity}:{id:printing.id,code:identity.code,name:displayCardName(identity.name,identity.code),color:identity.color,type:identity.card_type,cost:identity.cost,power:identity.power,rarity,art:0,effect:identity.effect_text,...image};
  return {...baseCard,id:printing.id,gameSlug,availablePrintings:printingsList.map(item=>({id:item.id,language:item.language,variant:item.variant,printing_code:item.printing_code,card_image_url:item.card_image_url,rarity:item.rarity,set_code:item.set_code,tcg_card_assets:item.tcg_card_assets}))};
}
function parseCardSearch(value:string):CardSearchFilters{
  const words=value.trim().split(/\s+/).filter(Boolean);const removed=new Set<number>();let code:string|null=null,setCode:string|null=null,cardType:string|null=null,color:string|null=null,cost:number|null=null;const rarities:string[]=[];
  const codePattern=/^(OP|EB|ST|PRB|DON|P)[- ]?0*\d{1,3}-\d{1,3}$/i;const setPattern=/^(OP|EB|ST|PRB|DON|P)[- ]?0*\d{1,3}$/i;
  words.forEach((word,index)=>{const cleaned=word.replace(/[.,]/g,'');if(codePattern.test(cleaned)){code=cleaned.toUpperCase().replace(/\s+/g,'').replace(/^(OP|EB|ST|PRB|DON|P)-?(\d)/,'$1$2');removed.add(index);const match=code.match(/^(OP|EB|ST|PRB|DON|P)0*(\d{1,3})-/);if(match)setCode=`${match[1]}${match[2]}`;}});
  words.forEach((word,index)=>{if(removed.has(index))return;const cleaned=word.replace(/[.,]/g,'');if(setPattern.test(cleaned)){const match=cleaned.toUpperCase().match(/^(OP|EB|ST|PRB|DON|P)[- ]?0*(\d{1,3})$/);if(match)setCode=`${match[1]}${match[2]}`;removed.add(index);}});
  const typeAliases=new Map([['leader','Leader'],['leaders','Leader'],['character','Character'],['characters','Character'],['event','Event'],['events','Event'],['stage','Stage'],['stages','Stage'],['don','DON!!'],['don!!','DON!!']]);
  const rarityAliases=new Set(['C','UC','R','SR','SEC','PSEC','SP','L','TR','DON']);
  const colorAliases=new Map([['red','Red'],['blue','Blue'],['green','Green'],['purple','Purple'],['black','Black'],['yellow','Yellow']]);
  words.forEach((word,index)=>{if(removed.has(index))return;const lower=word.toLowerCase();const upper=word.toUpperCase();
    const costCompact=lower.match(/^(\d{1,2})c$/);if(costCompact){cost=Number(costCompact[1]);removed.add(index);return;}
    if(/^\d{1,2}$/.test(word)&&words[index+1]?.toLowerCase()==='cost'){cost=Number(word);removed.add(index);removed.add(index+1);return;}
    if(lower==='cost'&&/^\d{1,2}$/.test(words[index+1]??'')){cost=Number(words[index+1]);removed.add(index);removed.add(index+1);return;}
    if(typeAliases.has(lower)){cardType=typeAliases.get(lower)??null;removed.add(index);return;}
    if(colorAliases.has(lower)){color=colorAliases.get(lower)??null;removed.add(index);return;}
    if(rarityAliases.has(upper)&&(upper.length>1||word===upper)){rarities.push(upper);removed.add(index);}
  });
  const nameTerms=words.filter((_,index)=>!removed.has(index)).map(word=>word.toLowerCase().replace(/[^a-z0-9]/g,'')).filter(Boolean);
  return {nameTerms,code,setCode,cardType,rarities:[...new Set(rarities)],color,cost};
}
function matchesCardSearch(card:Card,filters:CardSearchFilters){
  const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');const name=normalize(card.name),code=normalize(card.code),full=`${name} ${code}`;
  return (!filters.code||code===normalize(filters.code))&&(!filters.setCode||normalize(card.setCode??'').startsWith(normalize(filters.setCode))||code.startsWith(normalize(filters.setCode)))&&(!filters.cardType||card.type.toLowerCase()===filters.cardType.toLowerCase())&&(!filters.rarities.length||filters.rarities.includes(card.rarity.toUpperCase()))&&(!filters.color||card.color.toLowerCase().includes(filters.color.toLowerCase()))&&(filters.cost===null||card.cost===filters.cost)&&filters.nameTerms.every(term=>full.includes(term));
}
async function searchMarketCards(value:string,limit:number,gameSlug:'one-piece'|'pokemon'|'all'='one-piece',pokemonOptions?:PokemonSearchOptions):Promise<MarketCard[]>{
  if(gameSlug==='all'){
    const [onePiece,pokemon]=await Promise.all([
      searchMarketCards(value,limit,'one-piece'),
      searchMarketCards(value,limit,'pokemon',{language:pokemonOptions?.language??'EN',sets:[],types:[],rarities:[],categories:[],stages:[],illustrators:[],hpMin:'',hpMax:''}),
    ]);
    return [...onePiece,...pokemon].slice(0,limit*2);
  }
  if(gameSlug==='pokemon'){
    const params=new URLSearchParams({game:'pokemon',language:pokemonOptions?.language??'EN',q:value,limit:'500'});
    pokemonOptions?.sets.forEach(item=>params.append('set',item));pokemonOptions?.types.forEach(item=>params.append('type',item));pokemonOptions?.rarities.forEach(item=>params.append('rarity',item));pokemonOptions?.categories.forEach(item=>params.append('category',item));pokemonOptions?.stages.forEach(item=>params.append('stage',item));pokemonOptions?.illustrators.forEach(item=>params.append('illustrator',item));
    if(pokemonOptions?.hpMin)params.set('minHp',pokemonOptions.hpMin);if(pokemonOptions?.hpMax)params.set('maxHp',pokemonOptions.hpMax);
    const response=await fetch(versionedCardCatalogUrl(`/api/cards/catalog?${params}`),{cache:'no-store'});
    if(!response.ok)throw new Error('Card catalog is unavailable.');
    const payload=await response.json() as {cards?:PokemonMarketCard[]};
    const grouped=new Map<string,MarketCard>();
    for(const item of payload.cards??[]){
      const identity=item.tcg_card_identities;
      if(!identity)continue;
      const code=identity.code;
      const printing:CardPrintingItem={id:item.id,language:item.language,variant:item.variant,printing_code:item.printing_code,card_image_url:item.card_image_url??null,rarity:item.rarity,set_code:item.set_code,tcg_card_assets:[]};
      const current=grouped.get(code);
      if(current){current.availablePrintings=[...(current.availablePrintings??[]),printing];continue;}
      const rarity=pokemonRarityLabel(item.rarity??item.source_payload?.rarity,item.language);
      grouped.set(code,{id:item.id,code,name:displayCardName(identity.name,code),color:identity.color||'Colorless',type:(identity.card_type||item.source_payload?.category||'Pokémon') as Card['type'],cost:identity.cost??0,power:identity.power??0,rarity,art:0,effect:identity.effect_text??'',imageUrl:item.card_image_url??undefined,imageSource:'external',setCode:item.set_code,language:item.language,printingCode:item.printing_code,variant:item.variant,gameSlug:'pokemon',pokemonTypes:item.source_payload?.types??[],pokemonCategory:item.source_payload?.category,pokemonSetName:item.source_payload?.set?.name??item.set_name,pokemonIllustrator:item.source_payload?.illustrator,availablePrintings:[printing]});
    }
    return [...grouped.values()].slice(0,limit);
  }
  const response=await fetch(`/api/cards/identities?game=${gameSlug}&q=${encodeURIComponent(value)}`,{cache:'no-store'});
  if(!response.ok)throw new Error('Card catalog is unavailable.');
  const payload=await response.json() as {cards?:Array<{id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string}>};
  const identities=(payload.cards??[]).slice(0,limit);
  return (await Promise.all(identities.map(async identity=>{
    const detailResponse=await fetch(`/api/cards/${encodeURIComponent(identity.code)}?game=${gameSlug}`,{cache:'force-cache'});
    if(!detailResponse.ok)return undefined;
    const detail=await detailResponse.json() as {printings?:Array<{id:string;language:string;variant:string|null;rarity:string|null;set_code:string|null;printing_code:string|null;card_image_url:string|null;tcg_card_assets?:Array<{kind:string;object_key:string}>}>};
    return searchedCard({...identity,tcg_card_printings:(detail.printings??[]).map(item=>({...item,set_code:item.set_code??'',card_image_url:item.card_image_url}))},gameSlug);
  }))).filter((card):card is MarketCard=>Boolean(card)).slice(0,limit);
}
function WishlistCardPicker({items,gameSlug,value,onSelect,locale}:{items:Array<{printingId:string;card?:{name:string;code:string;language:string;variant:string;rarity:string;setCode:string;printingCode?:string;imageUrl:string|null;gameSlug?:'one-piece'|'pokemon'}|null}>;gameSlug:'one-piece'|'pokemon'|'all';value:string;onSelect:(card:MarketCard)=>void;locale:'EN'|'ID'}){
  const cards=items.flatMap(item=>{
    const saved=item.card;
    const actualGame=saved?.gameSlug??((cardFor(item.printingId) as MarketCard|undefined)?.gameSlug??(/^PK-/i.test(saved?.code??'')?'pokemon':'one-piece'));
    if(!saved||(gameSlug!=='all'&&actualGame!==gameSlug))return [];
    const card:MarketCard={id:item.printingId,code:saved.code,name:saved.name,color:'Colorless',type:(actualGame==='pokemon'?'Pokémon':'Character') as Card['type'],cost:0,power:0,rarity:saved.rarity,art:0,effect:'',imageUrl:saved.imageUrl??undefined,imageSource:'external',setCode:saved.setCode,language:saved.language,printingCode:saved.printingCode??saved.code,variant:saved.variant,gameSlug:actualGame,availablePrintings:[{id:item.printingId,language:saved.language,variant:saved.variant,printing_code:saved.printingCode??saved.code,card_image_url:saved.imageUrl,rarity:saved.rarity,set_code:saved.setCode}]};
    return [card];
  }).filter(card=>!value.trim()||`${card.name} ${card.code} ${card.printingCode} ${card.setCode}`.toLowerCase().includes(value.trim().toLowerCase()));
  return <div className="market-sell-search-results market-wishlist-card-picker">{cards.length?cards.map(card=><div key={`${card.gameSlug}:${card.id}`} className="market-sell-card-result"><div className="market-sell-card-thumb"><CardArt card={card} small/></div><div className="market-sell-card-meta"><strong>{card.name}</strong><div className="market-sell-card-sub">{gameSlug==='all'&&<span className="market-sell-game-badge">{card.gameSlug==='pokemon'?'Pokémon':'One Piece'}</span>}<span className="market-sell-code">{card.printingCode}</span><span>{card.language}</span>{card.setCode&&<span>{card.setCode}</span>}</div></div><div className="market-sell-card-actions"><button type="button" className="market-sell-card-select-btn" onClick={()=>onSelect(card)}><span>{locale==='ID'?'Pilih kartu':'Choose card'}</span><ArrowRight size={14}/></button></div></div>):<div className="market-sell-search-empty"><p>{value.trim()?locale==='ID'?'Tidak ada kartu wishlist yang cocok.':'No saved cards match this search.':locale==='ID'?'Belum ada kartu untuk game ini di wishlist.':'No saved cards for this game yet.'}</p></div>}</div>;
}

function CardSearch({value,onChange,onSelect,onAddToVault,locale='EN',wanted=false,gameSlug='one-piece'}:{value:string;onChange:(value:string)=>void;onSelect:(card:MarketCard)=>void;onAddToVault:(card:MarketCard)=>void;locale?:'EN'|'ID';wanted?:boolean;gameSlug?:'one-piece'|'pokemon'|'all'}) {
  const [results,setResults]=useState<MarketCard[]>([]);
  const [loading,setLoading]=useState(false);
  const [pokemonLanguage,setPokemonLanguage]=useState<'EN'|'ID'|'JP'>('EN');
  const [pokemonSets,setPokemonSets]=useState<PokemonMarketSet[]>([]);
  const [pokemonFacets,setPokemonFacets]=useState<PokemonMarketFacets>({});
  const [setFilters,setSetFilters]=useState<string[]>([]);const [typeFilters,setTypeFilters]=useState<string[]>([]);const [rarityFilters,setRarityFilters]=useState<string[]>([]);const [categoryFilters,setCategoryFilters]=useState<string[]>([]);const [stageFilters,setStageFilters]=useState<string[]>([]);const [illustratorFilters,setIllustratorFilters]=useState<string[]>([]);const [hpMin,setHpMin]=useState('');const [hpMax,setHpMax]=useState('');const [moreFilters,setMoreFilters]=useState(false);
  const [mobileFiltersOpen,setMobileFiltersOpen]=useState(false);
  const [onePieceFilters,setOnePieceFilters]=useState<{set:string[];type:string[];color:string[];rarity:string[];cost:string[]}>({set:[],type:[],color:[],rarity:[],cost:[]});
  const [onePieceSets,setOnePieceSets]=useState<Array<{code:string;name:string;series?:string;releaseYear?:number}>>([]);
  useEffect(()=>{
    setResults([]);setSetFilters([]);setTypeFilters([]);setRarityFilters([]);setCategoryFilters([]);setStageFilters([]);setIllustratorFilters([]);setHpMin('');setHpMax('');setMoreFilters(false);setMobileFiltersOpen(false);setOnePieceFilters({set:[],type:[],color:[],rarity:[],cost:[]});setPokemonLanguage('EN');
    if(gameSlug!=='pokemon'){setPokemonSets([]);setPokemonFacets({});}
  },[gameSlug]);
  useEffect(()=>{
    if(gameSlug!=='pokemon')return;
    const controller=new AbortController();
    Promise.all([
      fetch(versionedCardCatalogUrl(`/api/cards/sets?game=pokemon&language=${pokemonLanguage}`),{signal:controller.signal}).then(response=>response.ok?response.json() as Promise<{sets?:PokemonMarketSet[]}>:{sets:[]}),
      fetch(versionedCardCatalogUrl(`/api/cards/catalog/facets?game=pokemon&language=${pokemonLanguage}`),{signal:controller.signal}).then(response=>response.ok?response.json() as Promise<PokemonMarketFacets>:{}),
    ]).then(([setData,facets])=>{setPokemonSets(setData.sets??[]);setPokemonFacets(facets)}).catch(()=>{if(!controller.signal.aborted){setPokemonSets([]);setPokemonFacets({})}});
    return()=>controller.abort();
  },[gameSlug,pokemonLanguage]);
  useEffect(()=>{
    if(gameSlug!=='one-piece')return;
    const controller=new AbortController();
    fetch(versionedCardCatalogUrl('/api/cards/sets?game=one-piece&language=EN'),{signal:controller.signal}).then(response=>response.ok?response.json() as Promise<{sets?:Array<{code:string;name:string;series?:string;releaseYear?:number}>}>:{sets:[]}).then(payload=>setOnePieceSets(payload.sets??[])).catch(()=>{if(!controller.signal.aborted)setOnePieceSets([])});
    return()=>controller.abort();
  },[gameSlug]);
  const pokemonOptions=useMemo<PokemonSearchOptions>(()=>({language:pokemonLanguage,sets:setFilters,types:typeFilters,rarities:rarityFilters,categories:categoryFilters,stages:stageFilters,illustrators:illustratorFilters,hpMin,hpMax}),[pokemonLanguage,setFilters,typeFilters,rarityFilters,categoryFilters,stageFilters,illustratorFilters,hpMin,hpMax]);
  useEffect(()=>{
    const term=value.trim();
    if(term.length<2){setResults([]);setLoading(false);return}
    let active=true;
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      const searchTerm=gameSlug==='pokemon'||gameSlug==='all'?term:[term,...onePieceFilters.set,...onePieceFilters.type,...onePieceFilters.color,...onePieceFilters.rarity,...onePieceFilters.cost.map(cost=>`${cost} cost`)].filter(Boolean).join(' ');
      try{const found=await searchMarketCards(searchTerm,7,gameSlug,gameSlug==='pokemon'||gameSlug==='all'?pokemonOptions:undefined);if(active)setResults(found)}catch{if(active)setResults([])}finally{if(active)setLoading(false)}
    },170);
    return()=>{active=false;window.clearTimeout(timer)};
  },[value,gameSlug,pokemonOptions,onePieceFilters]);
  const hasPokemonFilters=Boolean(setFilters.length||typeFilters.length||rarityFilters.length||categoryFilters.length||stageFilters.length||illustratorFilters.length||hpMin||hpMax);
  const onePieceFilterCount=Object.values(onePieceFilters).reduce((total,values)=>total+values.length,0);
  const hasSearchFilters=gameSlug==='pokemon'?hasPokemonFilters:gameSlug==='one-piece'?onePieceFilterCount>0:false;
  const onePieceFilterOptions=useMemo(()=>({
    sets:onePieceSets.map(set=>({value:set.code,label:set.name?`${set.name} (${set.code})`:set.code,group:set.series||(set.releaseYear?String(set.releaseYear):'')})),
    types:['Leader','Character','Event','Stage','DON!!'],
    colors:['Red','Blue','Green','Purple','Black','Yellow'],
    rarities:['C','UC','R','SR','SEC','PSEC','SP','L','TR'],
    costs:Array.from({length:11},(_,index)=>String(index)),
  }),[onePieceSets]);
  const toggleOnePieceFilter=(key:keyof typeof onePieceFilters,value:string)=>setOnePieceFilters(previous=>({...previous,[key]:previous[key].includes(value)?[]:[value]}));
  const clearSearchFilters=()=>{if(gameSlug==='pokemon'){setSetFilters([]);setTypeFilters([]);setRarityFilters([]);setCategoryFilters([]);setStageFilters([]);setIllustratorFilters([]);setHpMin('');setHpMax('');return}setOnePieceFilters({set:[],type:[],color:[],rarity:[],cost:[]})};
  const togglePokemonFilter=(current:string[],setter:(value:string[]|((previous:string[])=>string[]))=>void,value:string)=>setter(previous=>previous.includes(value)?previous.filter(item=>item!==value):[...previous,value]);
  return (
    <div className="market-sell-search-container">
      <div className="market-sell-search-bar">
        <Search size={18} className="market-sell-search-icon"/>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={event=>onChange(event.target.value)}
          placeholder={gameSlug==='pokemon'||gameSlug==='all'?(locale==='ID'?'Cari nama, nomor kartu, atau set':'Search card name, number, or set'):(locale==='ID'?'Nama, set, tipe, rarity, atau biaya (mis. OP17 Leader)':'Name, set, type, rarity, or cost (e.g. OP17 Leader)')}
          aria-label={wanted?(locale==='ID'?'Cari kartu yang ingin dibeli':'Search cards you want to buy'):(locale==='ID'?'Cari kartu untuk dijual':'Search cards to sell')}
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
      {gameSlug==='all'&&<div className="market-listing-search-language"><span>{locale==='ID'?'Bahasa kartu Pokémon':'Pokémon language'}</span><div className="language-switch" role="group" aria-label={locale==='ID'?'Bahasa Pokémon':'Pokémon language'}>{(['EN','ID','JP'] as const).map(item=><button key={item} type="button" aria-pressed={pokemonLanguage===item} onClick={()=>setPokemonLanguage(item)}>{item}</button>)}</div></div>}
      {gameSlug!=='all'&&<div className={`market-pokemon-search-filters market-popup-search-filters ${gameSlug==='pokemon'?'is-pokemon':'is-one-piece'}${mobileFiltersOpen?' mobile-filters-open':''}`}>
        <button type="button" className={`market-mobile-filter-toggle${mobileFiltersOpen?' is-open':''}`} aria-expanded={mobileFiltersOpen} onClick={()=>setMobileFiltersOpen(value=>!value)}><SlidersHorizontal size={15}/><span>{locale==='ID'?'Filter':'Filters'}</span>{hasSearchFilters&&<b>{gameSlug==='pokemon'?Number(setFilters.length>0)+Number(typeFilters.length>0)+Number(rarityFilters.length>0)+Number(categoryFilters.length>0)+Number(stageFilters.length>0)+Number(illustratorFilters.length>0)+Number(Boolean(hpMin||hpMax)):onePieceFilterCount}</b>}<ChevronDown size={15}/></button>
      {gameSlug==='one-piece'&&<div className="market-pokemon-search-filter-row market-one-piece-search-filter-row">
        <MultiFilter portal label="Set" values={onePieceFilterOptions.sets} selected={onePieceFilters.set} onToggle={item=>toggleOnePieceFilter('set',item)} searchPlaceholder={locale==='ID'?'Cari set':'Find a set'}/>
        <MultiFilter portal label={locale==='ID'?'Tipe':'Type'} values={onePieceFilterOptions.types} selected={onePieceFilters.type} onToggle={item=>toggleOnePieceFilter('type',item)} searchPlaceholder={locale==='ID'?'Cari tipe':'Find a type'}/>
        <MultiFilter portal label={locale==='ID'?'Warna':'Colour'} values={onePieceFilterOptions.colors} selected={onePieceFilters.color} onToggle={item=>toggleOnePieceFilter('color',item)} searchPlaceholder={locale==='ID'?'Cari warna':'Find a colour'}/>
        <MultiFilter portal label={locale==='ID'?'Kelangkaan':'Rarity'} values={onePieceFilterOptions.rarities} selected={onePieceFilters.rarity} onToggle={item=>toggleOnePieceFilter('rarity',item)} searchPlaceholder={locale==='ID'?'Cari rarity':'Find a rarity'}/>
        <MultiFilter portal label={locale==='ID'?'Biaya':'Cost'} values={onePieceFilterOptions.costs} selected={onePieceFilters.cost} onToggle={item=>toggleOnePieceFilter('cost',item)}/>
        {hasSearchFilters&&<button type="button" className="market-pokemon-clear-filters" onClick={clearSearchFilters}>{locale==='ID'?'Hapus filter':'Clear filters'}</button>}
      </div>}
      {gameSlug==='pokemon'&&<>
        <div className="market-pokemon-search-filter-row">
          <MultiFilter portal label="Set" values={pokemonSets.map(set=>({value:set.code,label:`${set.name} (${set.code})`,group:set.series||(set.releaseYear?String(set.releaseYear):'Other sets')}))} selected={setFilters} onToggle={item=>togglePokemonFilter(setFilters,setSetFilters,item)} searchPlaceholder={locale==='ID'?'Cari set':'Find a set'}/>
          <MultiFilter portal label={locale==='ID'?'Tipe':'Type'} values={pokemonFacets.types??[]} selected={typeFilters} onToggle={item=>togglePokemonFilter(typeFilters,setTypeFilters,item)} searchPlaceholder={locale==='ID'?'Cari tipe':'Find a type'}/>
          <MultiFilter portal label={locale==='ID'?'Kelangkaan':'Rarity'} values={(pokemonFacets.rarities??[]).map(value=>({value,label:pokemonRarityLabel(value,pokemonLanguage)}))} selected={rarityFilters} onToggle={item=>togglePokemonFilter(rarityFilters,setRarityFilters,item)} searchPlaceholder={locale==='ID'?'Cari rarity':'Find a rarity'}/>
          <MultiFilter portal label={locale==='ID'?'Jenis kartu':'Card type'} values={(pokemonFacets.categories??[]).map(item=>({value:item,label:item}))} selected={categoryFilters} onToggle={item=>togglePokemonFilter(categoryFilters,setCategoryFilters,item)}/>
          <button type="button" className={`market-pokemon-more-filters${moreFilters?' is-open':''}`} aria-expanded={moreFilters} onClick={()=>setMoreFilters(current=>!current)}>{locale==='ID'?'Lainnya':'More'}<span>{stageFilters.length+illustratorFilters.length+(hpMin||hpMax?1:0)||''}</span></button>
          <div className="language-switch market-pokemon-language" aria-label={locale==='ID'?'Bahasa kartu':'Card language'}>{(['EN','ID','JP'] as const).map(item=><button key={item} type="button" aria-pressed={pokemonLanguage===item} onClick={()=>setPokemonLanguage(item)}>{item}</button>)}</div>
          {hasPokemonFilters&&<button type="button" className="market-pokemon-clear-filters" onClick={clearSearchFilters}>{locale==='ID'?'Hapus filter':'Clear filters'}</button>}
        </div>
        {moreFilters&&<div className="market-pokemon-search-filter-row is-advanced">
          <MultiFilter portal label={locale==='ID'?'Tahap':'Stage'} values={pokemonFacets.stages??[]} selected={stageFilters} onToggle={item=>togglePokemonFilter(stageFilters,setStageFilters,item)} searchPlaceholder={locale==='ID'?'Cari tahap':'Find a stage'}/>
          <MultiFilter portal label={locale==='ID'?'Ilustrator':'Illustrator'} values={pokemonFacets.illustrators??[]} selected={illustratorFilters} onToggle={item=>togglePokemonFilter(illustratorFilters,setIllustratorFilters,item)} searchPlaceholder={locale==='ID'?'Cari ilustrator':'Find an illustrator'}/>
          <label className="market-pokemon-hp-range"><span>HP</span><input type="number" min="0" max="999" value={hpMin} onChange={event=>setHpMin(event.target.value)} placeholder={locale==='ID'?'Min':'Min'} aria-label={locale==='ID'?'HP minimum':'Minimum HP'}/><i>–</i><input type="number" min="0" max="999" value={hpMax} onChange={event=>setHpMax(event.target.value)} placeholder={locale==='ID'?'Maks':'Max'} aria-label={locale==='ID'?'HP maksimum':'Maximum HP'}/></label>
        </div>}
      </>}
      </div>}
      <div className="market-sell-search-body">
        {value.trim().length<2?(
          <div className="market-sell-search-empty">
            <Search size={22}/>
            <p>{gameSlug==='pokemon'?(locale==='ID'?'Ketik nama atau nomor kartu Pokémon, lalu gunakan filter set, tipe, dan rarity.':'Type a Pokémon name or card number, then narrow by set, type, or rarity.'):gameSlug==='all'?(locale==='ID'?'Cari kartu One Piece dan Pokémon sekaligus.':'Search One Piece and Pokémon cards together.'):(locale==='ID'?'Ketik nama atau kode kartu (contoh: OP01-001 atau Luffy).':'Type a card name or card number (e.g. OP01-001 or Luffy).')}</p>
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
                <div key={`${card.gameSlug??'one-piece'}:${card.id}`} className="market-sell-card-result">
                  <div className="market-sell-card-thumb">
                  <CardArt card={card} small missingImageAction={card.gameSlug==='pokemon'&&<FeedbackLaunchButton className="pokemon-missing-image-report" request={{initialCategory:'missing-printing',cardCode:card.code,printingId:card.id}} title="Report this missing card image">Report</FeedbackLaunchButton>}/>
                  </div>
                  <div className="market-sell-card-meta">
                    <strong>{card.name}</strong>
                    <div className="market-sell-card-sub">
                      {gameSlug==='all'&&<span className="market-sell-game-badge">{card.gameSlug==='pokemon'?'Pokémon':'One Piece'}</span>}
                      {card.gameSlug==='pokemon'?<span className={`pokemon-card-meta-row${card.pokemonIllustrator?' has-illustrator':''}`} aria-label={[card.pokemonSetName,card.setCode,card.printingCode,marketRarity(card),card.pokemonIllustrator&&`Illustrator ${card.pokemonIllustrator}`].filter(Boolean).join(' ')}>
                        {card.pokemonSetName&&<small className="pokemon-card-set-name" title={card.pokemonSetName}>{card.pokemonSetName}</small>}
                        {card.setCode&&<small className="pokemon-card-set-badge">{card.setCode.toLowerCase()}</small>}
                        {card.setCode&&card.printingCode&&<span className="pokemon-card-meta-divider" aria-hidden="true"/>}
                        {card.printingCode&&<small className="pokemon-card-number">{card.printingCode}</small>}
                        {marketRarity(card)&&<small className="pokemon-card-rarity">{marketRarity(card)}</small>}
                        {card.pokemonIllustrator&&<span className="pokemon-card-illustrator-inline"><small>{locale==='ID'?'Ilustrator':'Illustrator'}</small><Link href={`${locale==='ID'?'/id':''}/pokemon?illustrator=${encodeURIComponent(card.pokemonIllustrator)}`}><strong>{card.pokemonIllustrator}</strong></Link></span>}
                      </span>:<><span className="market-sell-code">{card.code}</span><span>{card.type}</span>{marketRarity(card)&&<span className="market-sell-rarity">{marketRarity(card)}</span>}{card.setCode&&<span>{card.setCode}</span>}</>}
                    </div>
                    {printingsCount>1&&(
                      <span className="market-sell-printings-badge">
                        <Grid size={12}/>
                        {printingsCount} {locale==='ID'?'versi cetak':'printings'}
                      </span>
                    )}
                  </div>
                  <div className="market-sell-card-actions">
                    <button type="button" className="market-sell-card-select-btn" onClick={()=>onSelect(card)}>
                      <span>{wanted?(locale==='ID'?'Pilih kartu':'Choose card'):(locale==='ID'?'Pilih':'Select')}</span><ArrowRight size={14}/>
                    </button>
                    {!wanted&&<button type="button" className="market-sell-card-vault-btn" onClick={()=>onAddToVault(card)}>
                      {locale==='ID'?'Tambah ke Vault':'Add to Vault'}
                    </button>}
                  </div>
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
function VaultCardPicker({items,onSelect,locale='EN',gameSlug='one-piece'}:{items:CollectionItem[];onSelect:(card:MarketCard,instanceId:string,quantity:number,condition:string)=>void;locale?:'EN'|'ID';gameSlug?:'one-piece'|'pokemon'|'all'}) {
  const [query,setQuery]=useState('');
  const itemGame=(item:CollectionItem)=>{const card=item.card as MarketCard|undefined;return card?.gameSlug??(/^PK-/i.test(card?.code??item.printingId)?'pokemon':'one-piece')};
  const availableItems=items.filter(item=>item.quantity>0&&(gameSlug==='all'||itemGame(item)===gameSlug));
  const filtered=availableItems.filter(item=>{
    const card=(item.card as MarketCard|undefined)??cardFor(item.printingId);
    if(!card)return false;
    const term=query.trim().toLocaleLowerCase();
    return !term||[card.name,card.code,item.setCode??card.setCode??''].some(value=>value.toLocaleLowerCase().includes(term));
  });
  return (
    <div className="market-vault-picker">
      <label className="market-vault-picker-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={locale==='ID'?'Cari di Vault':'Search your Vault'} aria-label={locale==='ID'?'Cari kartu di Vault':'Search cards in your Vault'}/>{query&&<button type="button" onClick={()=>setQuery('')} aria-label={locale==='ID'?'Hapus pencarian':'Clear search'}><X size={14}/></button>}</label>
      <div className="market-vault-picker-heading"><strong>{locale==='ID'?'Kartu di Vault':'Available in your Vault'}</strong><span>{filtered.length} {locale==='ID'?'kartu':filtered.length===1?'card':'cards'}</span></div>
      <div className="market-vault-picker-grid">
      {filtered.map(item=>{
        const card=(item.card as MarketCard|undefined)??cardFor(item.printingId);
        if(!card)return null;
        return <MarketVaultPickerCard key={item.id} card={card} item={item} locale={locale} showGame={gameSlug==='all'} onSelect={onSelect}/>;
      })}
      {!filtered.length&&<p className="market-vault-picker-empty">{query.trim()?(locale==='ID'?'Tidak ada kartu yang cocok.':'No cards match this search.'):(availableItems.length===0?(locale==='ID'?'Tidak ada salinan Vault lain yang bisa ditambahkan.':'No more Vault copies are available to add.'):(locale==='ID'?'Tidak ada kartu yang cocok.':'No cards match this search.'))}</p>}
      </div>
    </div>
  );
}
function MarketVaultPickerCard({card,item,locale,showGame,onSelect}:{card:MarketCard;item:CollectionItem;locale:'EN'|'ID';showGame:boolean;onSelect:(card:MarketCard,instanceId:string,quantity:number,condition:string)=>void}){
  const [missing,setMissing]=useState(false);
  const actualGame=card.gameSlug??(/^PK-/i.test(card.code)?'pokemon':'one-piece');
  return <div className="market-vault-card-option"><button type="button" className="market-vault-card-item" disabled={item.quantity<=0} onClick={()=>onSelect({...card,id:item.printingId,gameSlug:actualGame,language:item.language??card.language,variant:item.variant??card.variant,printingCode:item.printingCode??card.printingCode,setCode:item.setCode??card.setCode},item.id,item.quantity,item.condition||'NM')}><div className="market-vault-card-thumb"><CardArt card={card} small onImageMissing={()=>setMissing(true)}/></div><div className="market-vault-card-info"><strong>{card.name}</strong><small className="market-vault-card-meta">{showGame&&<span className="market-sell-game-badge">{actualGame==='pokemon'?'Pokémon':'One Piece'}</span>}<span>{card.code}</span><span>{item.language??card.language??'EN'}</span><span>{item.condition||'NM'}</span></small><small className="market-vault-card-available">{item.quantity} {locale==='ID'?(item.quantity===1?'salinan tersedia':'salinan tersedia'):(item.quantity===1?'copy available':'copies available')}</small>{item.quantity<=0&&<small>{locale==='ID'?'Sudah terpakai di listing':'Reserved by a listing'}</small>}</div></button>{missing&&actualGame==='pokemon'&&<FeedbackLaunchButton className="market-vault-missing-image-report" request={{initialCategory:'missing-printing',cardCode:card.code,printingId:item.printingId}} title="Report this missing card image">Report</FeedbackLaunchButton>}</div>;
}
function MarketCardLookup({
  value,
  listings = [],
  gameSlug='one-piece',
  onViewListings,
  onAddToVault,
  onSell,
  locale = 'EN',
}: {
  value: string;
  listings?: Listing[];
  gameSlug?: 'one-piece'|'pokemon';
  onViewListings: (card: Card) => void;
  onAddToVault: (card: Card) => void;
  onSell: (card: Card) => void;
  locale?: 'EN' | 'ID';
}) {
  const [results, setResults] = useState<MarketCard[]>([]);
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
      try{const found=await searchMarketCards(term,10,gameSlug);if(active)setResults(found)}catch{if(active)setResults([])}finally{if(active)setLoading(false)}
    }, 170);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [value,gameSlug]);
  const getCardListingsCount = (card: Card) => {
    const printingIds=new Set((card as MarketCard).availablePrintings?.map(item=>item.id)??[card.id]);
    return listings.filter(l => {
      if (l.card?.id === card.id || l.card?.code === card.code) return true;
      if (printingIds.has(l.printingId)) return true;
      if (l.items?.some(it => printingIds.has(it.printingId) || cardFor(it.printingId)?.code === card.code)) return true;
      return false;
    }).length;
  };
  return (
    <section className="market-card-lookup" aria-live="polite">
      <header>
        <span>{gameSlug==='pokemon'?(locale==='ID'?'Katalog Pokémon':'Pokémon card catalog'):(locale === 'ID' ? 'Katalog Kartu Resmi' : 'Official Card Catalog')}</span>
        <small>
          {loading
            ? (locale === 'ID' ? 'Mencari...' : 'Searching...')
            : value.trim().length >= 2
              ? (results.length ? (locale === 'ID' ? `${results.length} kartu cocok` : `${results.length} matches`) : (locale === 'ID' ? 'Kartu tidak ditemukan' : 'No cards found'))
              : gameSlug==='pokemon'?(locale==='ID'?'Cari nama, nomor kartu, atau set Pokémon':'Search Pokémon name, card number, or set'):(locale === 'ID' ? 'Ketik nama atau kode kartu di kolom pencarian' : 'Type card name or code in search bar')}
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
                <MarketLookupCardThumb card={card as MarketCard} gameSlug={gameSlug}/>
                <div className="market-card-lookup-details">
                  <strong>{card.name}</strong>
                  <div className="market-card-lookup-meta">
                    <span className="market-sell-code">{gameSlug==='pokemon'?(card as MarketCard).printingCode||card.code:card.code}</span>
                    {gameSlug==='pokemon'?<PokemonMarketType card={card as MarketCard}/>:<span>{card.type}</span>}
                    {gameSlug!=='pokemon'&&card.color&&(
                      <>
                        <span>{card.color}</span>
                      </>
                    )}
                    {marketRarity(card) && (
                      <>
                        <span className="market-sell-rarity">{marketRarity(card)}</span>
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
          <p>{gameSlug==='pokemon'?(locale==='ID'?`Tidak ada kartu Pokémon untuk "${value}".`:`No Pokémon cards found for "${value}".`):(locale === 'ID' ? `Tidak ada kartu di database untuk "${value}".` : `No cards found in catalog for "${value}".`)}</p>
        </div>
      ) : (
        <div className="market-feed-empty" style={{ minHeight: 180, padding: '28px 18px' }}>
          <p>{gameSlug==='pokemon'
            ? (locale==='ID'?'Cari nama, nomor kartu, atau set. Saring berdasarkan tipe energi, jenis kartu, rarity, tahap, ilustrator, dan HP.':'Search by name, card number, or set. Filter by energy type, card type, rarity, stage, illustrator, and HP.')
            : (locale==='ID'?'Cari nama, nomor kartu, set, tipe, rarity, atau biaya (contoh: OP17 Leader, SEC Luffy, 3c Robin).':'Search by name, card number, set, type, rarity, or cost (e.g. OP17 Leader, SEC Luffy, 3c Robin).')}</p>
        </div>
      )}
    </section>
  );
}
export function Market({initialCards=[],modalOnly=false,initialSellPrinting,initialSellType,initialGameSlug}:{initialCards?:string[];modalOnly?:boolean;initialSellPrinting?:string;initialSellType?:'WTS'|'WTB';initialGameSlug?:'one-piece'|'pokemon'}) {
  const {data,loading:accountLoading,refresh:refreshAccount}=useAccount();
  const listingLimits=useMarketListingLimits(`${data?.profile?.id??'anonymous'}:${data?.profile?.tier??'free'}:${data?.profile?.pro_billing_period??'monthly'}`);
  const router=useRouter();
  const searchParams=useSearchParams();
  const [gameSlug,setGameSlug]=useState<'one-piece'|'pokemon'>(initialGameSlug??(searchParams.get('game')==='pokemon'?'pokemon':'one-piece'));
  const [listings,setListings]=useState<Listing[]>([]);
  const [listingsLoading,setListingsLoading]=useState(true);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [lang,setLang]=useState<'all'|'EN'|'JP'|'ID'>('all');
  const [sort,setSort]=useState<'newest'|'price_asc'|'price_desc'>('newest');
  const feedListRef=useRef<HTMLElement|null>(null);
  const previousFeedPositions=useRef<Map<string,{left:number;top:number}>|null>(null);
  const [tradeType,setTradeType]=useState<'all'|'WTS'|'WTB'>('all');
  const [filterMotionKey,setFilterMotionKey]=useState<0|1|null>(null);
  const [listingView,setListingView]=useState<'list'|'grid'>('list');
  const [feedScope,setFeedScope]=useState<'listings'|'cards'>('listings');
  const [open,setOpen]=useState(()=>!modalOnly&&Boolean(searchParams.get('sell')&&searchParams.get('sell')!=='open'));
  const [directSellLoading,setDirectSellLoading]=useState(()=>!modalOnly&&Boolean(searchParams.get('sell')&&searchParams.get('sell')!=='open'));
  const queuedSellPrinting=useRef('');
  const initialSellHandled=useRef(false);
  const [bulkListingOpen,setBulkListingOpen]=useState(false);
  const directSellSearchHandled=useRef(false);
  const configLoadVersion=useRef(0);
  const [busy,setBusy]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [locale,setLocale]=useState<'EN'|'ID'>('EN');
  const [accountPanel,setAccountPanel]=useState<'listings'|'offers'|'orders'|'saved'|null>(()=>{if(modalOnly)return null;const activity=searchParams.get('activity');return activity==='offers'||activity==='orders'||activity==='listings'||activity==='saved'?activity:null});
  const [quickPanel,setQuickPanel]=useState<'profile'|'vault'|'wishlist'|null>(()=>!modalOnly&&['delivery','payouts'].includes(searchParams.get('profile')??'')?'profile':null);
  const [activityCounts,setActivityCounts]=useState({listings:0,offers:0,orders:0});
  const [cartCount,setCartCount]=useState(0);
  const profileId=String(data?.profile?.id??'');
  useEffect(()=>{
    const sync=()=>{try{const cart=JSON.parse(window.localStorage.getItem('vivreplay-market-cart-v1')||'null') as {lines?:Array<{items?:Array<{quantity?:number}>}>}|null;setCartCount((cart?.lines??[]).reduce((sum,line)=>sum+(line.items??[]).reduce((total,item)=>total+(Number(item.quantity)||0),0),0))}catch{setCartCount(0)}};
    sync();window.addEventListener('vivreplay:market-cart-updated',sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener('vivreplay:market-cart-updated',sync);window.removeEventListener('storage',sync)};
  },[]);
  useEffect(()=>{if(modalOnly)return;const profileTab=searchParams.get('profile');if(profileTab==='delivery'||profileTab==='payouts'){setProfileQuickTab(profileTab);setAccountPanel(null);setQuickPanel('profile')}},[searchParams,modalOnly]);
  // Bundle & Card Listing Draft State
  const [bundleCards,setBundleCards]=useState<ListingBundleCard[]>([]);
  const [publishedShare,setPublishedShare]=useState<PublishedShare|null>(null);
  const [configuringCard,setConfiguringCard]=useState<MarketCard|null>(null);
  const [cardPrintings,setCardPrintings]=useState<CardPrintingItem[]>([]);
  const [selectedPrintingId,setSelectedPrintingId]=useState<string>('');
  const [searchSource,setSearchSource]=useState<'catalog'|'vault'|'wishlist'>('catalog');
  const [listingGameScope,setListingGameScope]=useState<'one-piece'|'pokemon'|'all'>(gameSlug);
  const [cardSearch,setCardSearch]=useState('');
  const [isAddingAnother,setIsAddingAnother]=useState(false);
  // Active Card Config Inputs
  const [itemPrice,setItemPrice]=useState('');
  const itemPriceEdited=useRef(false);
  const [itemQuantity,setItemQuantity]=useState(1);
  const [itemCondition,setItemCondition]=useState('NM');
  const [itemInstance,setItemInstance]=useState('');
  // Overall Listing Inputs
  const [listingTitle,setListingTitle]=useState('');
  const [listingPrice,setListingPrice]=useState('');
  const [listingType,setListingType]=useState<'WTS'|'WTB'>('WTS');
  const [liveListingFeePercent,setLiveListingFeePercent]=useState<number|null>(null);
  const [listingNegotiable,setListingNegotiable]=useState(true);
  const [listingCity,setListingCity]=useState('');
  const [buyerCity,setBuyerCity]=useState('');
  const [profileQuickTab,setProfileQuickTab]=useState<'account'|'delivery'|'payouts'>(()=>!modalOnly&&searchParams.get('profile')==='payouts'?'payouts':'account');
  useEffect(()=>{
    if(!open||!data?.profile?.id)return;
    let active=true;
    fetch('/api/checkout/market',{cache:'no-store'}).then(async response=>{
      if(!response.ok)return;
      const result=await response.json() as {sellerFeePercent?:number};
      if(active&&Number.isFinite(result.sellerFeePercent))setLiveListingFeePercent(result.sellerFeePercent!);
    }).catch(()=>undefined);
    return()=>{active=false};
  },[open,data?.profile?.id]);
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
    const language=window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN';
    setLocale(language);
    document.documentElement.lang=language==='ID'?'id':'en';
    const onLocale=(event:Event)=>setLocale((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);
  // Prefill shipping origin city directly from signed-in seller's origin
  useEffect(()=>{
    if(!data?.profile)return;
    let active=true;
    const loadSavedCity=()=>{
      void api<{origin?:{city?:string}|null}>('/api/shipping/origin',undefined,'GET')
        .then(res=>{
          if(!active)return;
          const city=res?.origin?.city?.trim()??'';
          setBuyerCity(city);
          if(city){setListingCity(city);window.localStorage.setItem('vivreplay-seller-city',city)}
          else{
            const saved=window.localStorage.getItem('vivreplay-seller-city');
            if(saved)setListingCity(saved);
          }
        })
        .catch(()=>{if(active)setBuyerCity('')});
    };
    loadSavedCity();
    window.addEventListener('vivreplay:shipping-updated',loadSavedCity);
    return()=>{active=false;window.removeEventListener('vivreplay:shipping-updated',loadSavedCity)};
  },[data?.profile?.id]);
  const refreshFeedRef=useRef<()=>Promise<void>>(async()=>{});
  const activityOrdersRef=useRef(activityCounts.orders);
  async function refresh(){
    if(!listings.length)setListingsLoading(true);
    try{
      const response=await fetch(`/api/listings?game=${gameSlug}`,{cache:'no-store'});
      const result=await response.json() as {listings?:Listing[];error?:string};
      if(!response.ok||!result.listings)throw new Error(result.error||'Live listings are temporarily unavailable. Please retry.');
      setListings(result.listings);
      setError('');
    }catch(cause){
      setError(cause instanceof Error?cause.message:(locale==='ID'?'Listing tidak dapat dimuat sementara. Silakan coba lagi.':'Live listings are temporarily unavailable. Please retry.'));
    }finally{setListingsLoading(false)}
  }
  refreshFeedRef.current=refresh;
  useEffect(()=>{if(!modalOnly)void refresh()},[modalOnly,gameSlug]);
  useEffect(()=>{if(modalOnly)return;setGameSlug(searchParams.get('game')==='pokemon'?'pokemon':'one-piece')},[modalOnly,searchParams]);
  const changeGame=(next:'one-piece'|'pokemon')=>{
    setGameSlug(next);setLang('all');setTradeType('all');setQuery('');setCardSearch('');
    const params=new URLSearchParams(window.location.search);if(next==='pokemon')params.set('game','pokemon');else params.delete('game');
    router.replace(`${window.location.pathname}${params.size?`?${params}`:''}`,{scroll:false});
  };
  const listingHref=(listing:Pick<Listing,'title'|'id'>)=>{
    const path=marketListingPath(listing.title,listing.id);
    return gameSlug==='pokemon'?`${path}?game=pokemon`:path;
  };
  useEffect(()=>{
    if(modalOnly)return;
    let timer:number|undefined;
    const queueRefresh=()=>{if(document.visibilityState!=='visible')return;if(timer)window.clearTimeout(timer);timer=window.setTimeout(()=>{timer=undefined;void refreshFeedRef.current()},180)};
    const onStorage=(event:StorageEvent)=>{if(event.key==='vivreplay:market-data-updated')queueRefresh()};
    const onVisibility=()=>{if(document.visibilityState==='visible')queueRefresh()};
    window.addEventListener('vivreplay:market-data-updated',queueRefresh);
    window.addEventListener('storage',onStorage);
    document.addEventListener('visibilitychange',onVisibility);
    return()=>{if(timer)window.clearTimeout(timer);window.removeEventListener('vivreplay:market-data-updated',queueRefresh);window.removeEventListener('storage',onStorage);document.removeEventListener('visibilitychange',onVisibility)};
  },[modalOnly]);
  useEffect(()=>{
    if(!profileId||modalOnly)return;
    let active=true;
    const update=async()=>{if(document.visibilityState!=='visible')return;const counts=await loadMarketActivityCounts(profileId);if(!active||!counts)return;if(counts.orders>activityOrdersRef.current)void refreshFeedRef.current();activityOrdersRef.current=counts.orders;setActivityCounts(counts)};
    const onVisibility=()=>{if(document.visibilityState==='visible')void update()};
    void update();const timer=window.setInterval(()=>void update(),120_000);document.addEventListener('visibilitychange',onVisibility);
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
    const identity=marketCardIdentity(card);
    const sameCardCopies=bundleCards.filter(item=>marketCardIdentity(item.card)===identity).reduce((sum,item)=>sum+item.quantity,0);
    const cardTypes=new Set(bundleCards.map(item=>marketCardIdentity(item.card)));
    if(sameCardCopies>=listingLimits.maxCopiesPerCard){toast.error(listingLimitMessage('too-many-copies-of-card',locale,listingLimits));return;}
    if(!cardTypes.has(identity)&&cardTypes.size>=listingLimits.maxCardTypes){toast.error(listingLimitMessage('too-many-types',locale,listingLimits));return;}
    const loadVersion=++configLoadVersion.current;
    const requestedPrintingId=data?.collection.find(item=>item.id===presetInstanceId)?.printingId??card.id;
    setConfiguringCard(card as MarketCard);
    setCardPrintings([]);
    setSelectedPrintingId('');
    setItemQuantity(Math.max(1,Math.min(presetQty,listingLimits.maxCopiesPerCard-sameCardCopies,listingLimits.maxListingCopies-bundleCards.reduce((sum,item)=>sum+item.quantity,0))));
    setItemCondition(presetCondition);
    setItemInstance(presetInstanceId||'');
    setItemPrice('');
    itemPriceEdited.current=false;
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
      const response=await fetch(`/api/cards/${encodeURIComponent(card.code)}?game=${(card as MarketCard).gameSlug??gameSlug}`,{cache:'force-cache'});
      const payload=await response.json() as {printings?:Array<{id:string;language:string;variant:string|null;rarity:string|null;set_code:string|null;printing_code:string|null;card_image_url:string|null;tcg_card_assets?:Array<{kind:string;object_key:string}>}>};
      if(loadVersion!==configLoadVersion.current)return;
      const list=uniqueCardPrintings((payload.printings??[]) as CardPrintingItem[]);
      if(response.ok&&list.length){
        setCardPrintings(list);
        const chosen=list.find(p=>p.id===requestedPrintingId)||list.find(p=>p.language===card.language)||list[0];
        setConfiguringCard(prev=>prev?{...prev,availablePrintings:list}:prev);
        setSelectedPrintingId(chosen.id);
        return;
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
    if(modalOnly)return;
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
      const response=await fetch(`/api/cards/printing/${encodeURIComponent(sell)}`,{cache:'no-store'});
      if(!active)return;
      const row=await response.json() as {id:string;code:string;name:string;color:string;cardType:Card['type'];cost:number;power:number;effect:string;imageUrl:string|null;rarity:string|null;setCode:string|null;language:string;printingCode?:string|null;variant?:string|null;objectKey?:string|null};
      if(!response.ok){setDirectSellLoading(false);return;}
      const cardObj:Card={id:row.id,code:row.code,name:displayCardName(row.name,row.code),color:row.color,type:row.cardType,cost:row.cost,power:row.power,rarity:row.rarity??'',art:0,effect:row.effect,imageUrl:row.imageUrl??undefined,imageSource:'external',setCode:row.setCode??undefined,language:row.language,printingCode:row.printingCode??undefined,variant:row.variant??undefined,assetPath:row.objectKey??undefined};
      sellCard(cardObj);
    })();
    return()=>{active=false};
  },[searchParams,accountLoading,data,modalOnly]);
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
        }
      })
      .catch(()=>{if(active)setBenchmark(null)})
      .finally(()=>{if(active)setBenchmarkLoading(false)});
    return()=>{active=false};
  },[selectedPrintingId]);
  useEffect(()=>{
    if(!benchmark||itemPriceEdited.current)return;
    const yytIdr=benchmark.normalizedAmount||Math.round(benchmark.amount*110);
    setItemPrice(String(Math.round(yytIdr*benchmarkMultiplier/100)));
  },[benchmark,benchmarkMultiplier]);
  useEffect(()=>{
    if(!benchmark||!itemPriceEdited.current||!Number(itemPrice))return;
    const yytIdr=benchmark.normalizedAmount||Math.round(benchmark.amount*110);
    setBenchmarkMultiplier(Math.round(Number(itemPrice)/yytIdr*1000)/10);
  },[benchmark,itemPrice]);
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
    if(!itemPriceEdited.current)setItemPrice('');
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
  const captureFeedPositions=()=>{
    const list=feedListRef.current;
    if(list&&typeof window!=='undefined'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      previousFeedPositions.current=new Map(Array.from(list.querySelectorAll<HTMLElement>('[data-listing-id]')).map(row=>[row.dataset.listingId??'',{left:row.getBoundingClientRect().left,top:row.getBoundingClientRect().top}]));
    }
  };
  const triggerFeedMotion=()=>setFilterMotionKey(current=>current===0?1:0);
  const changeSort=(next:'newest'|'price_asc'|'price_desc')=>{
    if(next===sort)return;
    captureFeedPositions();
    triggerFeedMotion();
    setSort(next);
  };
  const changeLanguage=(next:'all'|'EN'|'JP'|'ID')=>{if(next===lang)return;captureFeedPositions();triggerFeedMotion();setLang(next)};
  const changeTradeType=(next:'all'|'WTS'|'WTB')=>{if(next===tradeType)return;captureFeedPositions();triggerFeedMotion();setTradeType(next)};
  useEffect(()=>{
    const previous=previousFeedPositions.current;
    if(!previous)return;
    previousFeedPositions.current=null;
    const frame=window.requestAnimationFrame(()=>{
      const list=feedListRef.current;
      if(!list)return;
      for(const row of list.querySelectorAll<HTMLElement>('[data-listing-id]')){
        const before=previous.get(row.dataset.listingId??'');
        if(!before){row.animate([{opacity:.72,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'cubic-bezier(.2,0,0,1)'});continue;}
        const after=row.getBoundingClientRect();
        const x=before.left-after.left;
        const y=before.top-after.top;
        if(Math.abs(x)+Math.abs(y)<2)continue;
        row.animate([{transform:`translate(${x}px, ${y}px)`},{transform:'translate(0, 0)'}],{duration:220,easing:'cubic-bezier(.2,0,0,1)'});
      }
    });
    return()=>window.cancelAnimationFrame(frame);
  },[sort,lang,tradeType]);
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
  function beginListing(type:'WTS'|'WTB'='WTS'){
    configLoadVersion.current++;
    if(!signInToContinue())return;
    setListingType(type);
    setProfileQuickTab('account');
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
    setListingGameScope(gameSlug);
    setBenchmarkMultiplier(100);
    const savedCity=type==='WTB'?buyerCity:(window.localStorage.getItem('vivreplay-seller-city')||'Jakarta');
    setListingCity(savedCity);
    setOpen(true);
  }
  useEffect(()=>{
    const openSellListing=(event:Event)=>{setAccountPanel(null);setQuickPanel(null);const type=(event as CustomEvent<'WTS'|'WTB'>).detail;beginListing(type==='WTB'?'WTB':'WTS')};
    window.addEventListener('vivreplay:open-sell-listing',openSellListing);
    return()=>window.removeEventListener('vivreplay:open-sell-listing',openSellListing);
  },[data,accountLoading,locale,buyerCity]);
  function sellCard(card:Card){
    if(!signInToContinue())return;
    setListingType('WTS');
    setListingGameScope((card as MarketCard).gameSlug??gameSlug);
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
      const response=await fetch(`/api/cards/printing/${encodeURIComponent(readablePrinting?`${readablePrinting[1]}--${readablePrinting[2]}`:printingId)}`,{cache:'no-store'});
      const printing=await response.json() as {id:string;code:string;name:string;color:string;cardType:Card['type'];cost:number;power:number;effect:string;imageUrl:string|null;rarity:string|null;setCode:string|null;language:string;printingCode?:string|null;variant?:string|null;objectKey?:string|null};
      if(!response.ok){setDirectSellLoading(false);toast.error(locale==='ID'?'Cetakan kartu tidak ditemukan.':'Card printing could not be found.');return;}
      const cardObj:Card={id:printing.id,code:printing.code,name:displayCardName(printing.name,printing.code),color:printing.color,type:printing.cardType,cost:printing.cost,power:printing.power,rarity:printing.rarity??'',art:0,effect:printing.effect,imageUrl:printing.imageUrl??undefined,imageSource:'external',setCode:printing.setCode??undefined,language:printing.language,printingCode:printing.printingCode??undefined,variant:printing.variant??undefined,assetPath:printing.objectKey??undefined};
      sellCard(cardObj);
    }catch{
      setDirectSellLoading(false);
      toast.error(locale==='ID'?'Cetakan kartu gagal dimuat.':'Could not load this card printing.');
    }
  };
  useEffect(()=>{
    if(!modalOnly)return;
    const onSell=(event:Event)=>{const printingId=(event as CustomEvent<string>).detail;if(printingId){if(accountLoading)queuedSellPrinting.current=printingId;else void sellPrinting(printingId)}};
    window.addEventListener('vivreplay:open-sell-printing',onSell);
    return()=>window.removeEventListener('vivreplay:open-sell-printing',onSell);
  },[modalOnly,accountLoading,sellPrinting]);
  useEffect(()=>{
    if(!modalOnly||initialSellHandled.current)return;
    if(initialSellPrinting){
      initialSellHandled.current=true;
      if(accountLoading)queuedSellPrinting.current=initialSellPrinting;
      else void sellPrinting(initialSellPrinting);
      return;
    }
    if(initialSellType&&!accountLoading){
      initialSellHandled.current=true;
      beginListing(initialSellType);
    }
  },[modalOnly,initialSellPrinting,initialSellType,accountLoading,beginListing,sellPrinting]);
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
  const addConfiguredCardToBundle=()=>{
    if(!activeCardObj||!selectedPrintingId)return;
    const identity=marketCardIdentity(activeCardObj);
    const alreadySelected=bundleCards.filter(item=>marketCardIdentity(item.card)===identity).reduce((sum,item)=>sum+item.quantity,0);
    const cardTypeCount=new Set(bundleCards.map(item=>marketCardIdentity(item.card))).size;
    if(alreadySelected>=listingLimits.maxCopiesPerCard){toast.error(listingLimitMessage('too-many-copies-of-card',locale,listingLimits));return;}
    if(!bundleCards.some(item=>marketCardIdentity(item.card)===identity)&&cardTypeCount>=listingLimits.maxCardTypes){toast.error(listingLimitMessage('too-many-types',locale,listingLimits));return;}
    const remaining=Math.min(listingLimits.maxCopiesPerCard-alreadySelected,listingLimits.maxListingCopies-bundleCards.reduce((sum,item)=>sum+item.quantity,0));
    if(remaining<1){toast.error(listingLimitMessage('too-many-copies',locale,listingLimits));return;}
    const chosenPrinting=cardPrintings.find(p=>p.id===selectedPrintingId)||{
      id:activeCardObj.id,
      language:activeCardObj.language??'EN',
      variant:activeCardObj.variant??null,
      printing_code:activeCardObj.printingCode??activeCardObj.code,
      card_image_url:activeCardObj.imageUrl??null,
      rarity:activeCardObj.rarity,
      set_code:activeCardObj.setCode,
    };
    const matchedCopy=listingType==='WTS'?selectedPrintingCopy(ownedCopiesForConfig,selectedPrintingId,itemInstance):undefined;
    if(listingType==='WTS'&&!matchedCopy&&(data?.collection??[]).some(copy=>copy.printingId===selectedPrintingId)){
      toast.error(locale==='ID'?'Salinan kartu ini sudah terpakai di listing atau paket ini.':'These copies are already reserved by a listing or this bundle.');return;
    }
    const matchedInstance=matchedCopy?.id;
    const newItem:ListingBundleCard={
      id:crypto.randomUUID(),
      card:activeCardObj,
      printing:chosenPrinting,
      instanceId:listingType==='WTS'?matchedInstance:undefined,
      quantity:matchedCopy?Math.min(itemQuantity,matchedCopy.quantity,remaining):Math.min(itemQuantity,remaining),
      condition:listingType==='WTS'?(matchedCopy?.condition??itemCondition):itemCondition,
      unitAmount:Number(itemPrice)||0,
      availableQuantity:listingType==='WTS'?(matchedCopy?.quantity||listingLimits.maxCopiesPerCard):listingLimits.maxCopiesPerCard,
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
    const limitViolation=marketListingLimit(bundleCards,listingLimits);
    if(limitViolation){setSaveError(listingLimitMessage(limitViolation,locale,listingLimits));return;}
    if(listingType==='WTB'&&!buyerCity){
      setSaveError(locale==='ID'?'Tambahkan alamat pengiriman sebelum membuat permintaan beli.':'Add a delivery address before posting a buying request.');
      return;
    }
    setBusy(true);
    setSaveError('');
    const missingVaultItem=listingType==='WTS'?bundleCards.find(it=>!it.instanceId):undefined;
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
        city:listingType==='WTB'?buyerCity:(listingCity||'Jakarta'),
        type:listingType,
        negotiable:listingNegotiable,
        items:bundleCards.map(item=>({
          instanceId:item.instanceId,
          printingId:item.printing.id,
          quantity:item.quantity,
          condition:item.condition,
          unitAmount:item.unitAmount,
        })),
      })});
      const result=await response.json() as {error?:string;id?:string;expiresAt?:string};
      if(!response.ok)throw new Error(result.error??'Listing could not be published.');
      await refresh();
      await refreshAccount();
      setOpen(false);
      if(result.id){
        setPublishedShare({id:result.id,title:listingTitle||primary.card.name,price:Number(listingPrice),cards:[...bundleCards],seller:String(data?.profile?.display_name??''),city:listingType==='WTB'?buyerCity:listingCity,expiresAt:result.expiresAt,timeZone:typeof data?.profile?.timezone==='string'?data.profile.timezone:undefined});
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
  const listingFeePercent=liveListingFeePercent??(String(data?.profile?.tier??'free').toLowerCase()==='pro'?LISTING_POLICIES.pro.commissionPercent:LISTING_POLICIES.free.commissionPercent);
  const enteredListingTotal=Math.max(0,Number(listingPrice)||0);
  const estimatedSellerFee=calculateSellerServiceFee(enteredListingTotal,listingFeePercent);
  const benchmarkSliderMin=benchmarkMultiplier<50?Math.max(0,Math.floor(benchmarkMultiplier/50)*50):50;
  const benchmarkSliderMax=benchmarkMultiplier>150?Math.ceil(benchmarkMultiplier/50)*50:150;
  const benchmarkSliderStep=1;
  const benchmarkMultiplierLabel=benchmarkMultiplier<1?`${benchmarkMultiplier.toFixed(2)}%`:`${Number(benchmarkMultiplier.toFixed(1))}%`;
  return (
    <main className={`market-feed-page${modalOnly?' market-sell-modal-host':''}`}>
      <h1 className="market-page-title">Market</h1>
      {!modalOnly&&<MarketStoreNav
        showPromo={false}
        queryValue={query}
        onQueryChange={setQuery}
        searchPlaceholder={feedScope==='cards'?(locale==='ID'?'Cari kartu di katalog...':'Search cards in catalog...'):(locale==='ID'?'Cari listing di Market...':'Search market listings...')}
        searchAriaLabel={feedScope==='cards'?(locale==='ID'?'Cari kartu di katalog':'Search cards in catalog'):(locale==='ID'?'Cari listing di Market':'Search market listings')}
        onSearchSubmit={()=>{}}
        onCreateListing={type=>beginListing(type)}
      />}
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
            <div className="market-game-feed-controls">
              {!modalOnly&&<nav className="market-game-switch" aria-label={locale==='ID'?'Pilih permainan kartu':'Choose a card game'}><button type="button" aria-label="One Piece Card Game" title="One Piece Card Game" className={gameSlug==='one-piece'?'is-active':''} aria-current={gameSlug==='one-piece'?'page':undefined} onClick={()=>changeGame('one-piece')}><span className="market-game-logo-pad"><img src="/assets/one-piece-card-game-logo.png" alt=""/></span><span className="sr-only">One Piece</span></button><button type="button" aria-label="Pokémon Trading Card Game" title="Pokémon Trading Card Game" className={gameSlug==='pokemon'?'is-active':''} aria-current={gameSlug==='pokemon'?'page':undefined} onClick={()=>changeGame('pokemon')}><span className="market-game-logo-pad"><img src="https://upload.wikimedia.org/wikipedia/commons/1/1a/Pok%C3%A9mon_Trading_Card_Game_logo.svg" alt=""/></span><span className="sr-only">Pokémon</span></button></nav>}
              <nav className="market-scope-nav" aria-label={locale === 'ID' ? 'Pilihan feed market' : 'Market feed view'}>
              <button
                type="button"
                className={`market-scope-tab ${feedScope === 'listings' ? 'is-active' : ''}`}
                onClick={() => setFeedScope('listings')}
              >
                <Store size={16} />
                <span>{locale === 'ID' ? 'Listing' : 'Listings'}</span>
                <span className="market-tab-badge">{displayListings.length}</span>
              </button>
              <button
                type="button"
                className={`market-scope-tab ${feedScope === 'cards' ? 'is-active' : ''}`}
                onClick={() => setFeedScope('cards')}
              >
                <Cards size={16} />
                <span>{locale === 'ID' ? 'Kartu' : 'Cards'}</span>
              </button>
              </nav>
            </div>
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
                onClick={() => {if(listingView!=='list'){triggerFeedMotion();setListingView('list')}}}
                aria-label={locale === 'ID' ? 'Tampilan daftar' : 'List view'}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                className={listingView === 'grid' ? 'active' : ''}
                onClick={() => {if(listingView!=='grid'){triggerFeedMotion();setListingView('grid')}}}
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
                  onClick={() => changeTradeType('all')}
                >
                  <span>{locale === 'ID' ? 'Semua' : 'All'}</span>
                  <small>({tradeCounts.all})</small>
                </button>
                <button
                  type="button"
                  className={`market-trade-chip ${tradeType === 'WTS' ? 'is-active' : ''}`}
                  onClick={() => changeTradeType('WTS')}
                >
                  <span className="market-trade-dot is-wts" aria-hidden="true" />
                  <span>{locale === 'ID' ? 'Dijual' : 'For sale'}</span>
                  <small>({tradeCounts.wts})</small>
                </button>
                <button
                  type="button"
                  className={`market-trade-chip ${tradeType === 'WTB' ? 'is-active' : ''}`}
                  onClick={() => changeTradeType('WTB')}
                >
                  <span className="market-trade-dot is-wtb" aria-hidden="true" />
                  <span>{locale === 'ID' ? 'Membeli' : 'Buying'}</span>
                  <small>({tradeCounts.wtb})</small>
                </button>
              </div>
              <div className="market-feed-filters">
                <label className="market-feed-filter-control">
                  <Picker
                    label={locale === 'ID' ? 'Bahasa listing' : 'Listing language'}
                    leadingIcon={<Translate size={16} weight="regular" />}
                    value={lang}
                    onChange={v => changeLanguage(v as typeof lang)}
                    options={[
                      { value: 'all', label: locale === 'ID' ? 'Semua bahasa' : 'All languages' },
                      { value: 'EN', label: 'EN' },
                      ...(gameSlug==='pokemon'?[{value:'ID',label:'ID'}]:[]),
                      { value: 'JP', label: 'JP' },
                    ]}
                  />
                </label>
                <label className="market-feed-filter-control">
                  <Picker
                    label={locale === 'ID' ? 'Urutan listing' : 'Sort listings'}
                    leadingIcon={<ArrowsDownUp size={16} weight="regular" />}
                    value={sort}
                    onChange={v => changeSort(v as typeof sort)}
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
              gameSlug={gameSlug}
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
            <section ref={feedListRef} data-feed-motion={filterMotionKey??undefined} className={`market-feed-list is-${listingView}`} aria-label={locale==='ID'?'Daftar listing Market aktif':'Live Market listings'}>
              {displayListings.map(listing=>{
                const items=listing.items?.length?listing.items:[{printingId:listing.printingId,quantity:listing.quantity}];
                const totalCards=items.reduce((total,item)=>total+(listing.isOwner?item.quantity:(item.availableQuantity??item.quantity)),0);
                const heldCards=items.reduce((total,item)=>total+(item.heldQuantity??0),0);
                const fullySold=listing.type==='WTS'&&listing.status==='SOLD';
                const fullyReserved=listing.type==='WTS'&&!fullySold&&totalCards===0;
                const stackEntries=items.map(item=>({...item,quantity:item.sold?Math.min(3,item.quantity):listing.isOwner?item.quantity:Math.min(3,(item.availableQuantity??item.quantity)+(item.soldQuantity??0))})).filter(item=>item.sold||item.quantity>0);
                const firstCopies=stackEntries.map((item,itemIndex)=>({item,itemIndex,copyIndex:0})).slice(0,3);
                const extraCopies=stackEntries.flatMap((item,itemIndex)=>Array.from({length:Math.max(0,Math.min(3,item.quantity)-1)},(_,index)=>({item,itemIndex,copyIndex:index+1}))).slice(0,3-firstCopies.length);
                const visibleStack=[...firstCopies,...extraCopies];
                const content=(
                  <>
                    <div className={`market-feed-stack ${totalCards===1?'is-single':''}`} style={{'--stack-last-index':Math.max(0,visibleStack.length-1)} as CSSProperties}>
                      {visibleStack.map(({item,itemIndex,copyIndex},index)=>{
                        const stackCard=item.card??(itemIndex===0?listing.card:undefined)??cardFor(item.printingId);
                        return stackCard?<div key={`${item.printingId}-${itemIndex}-${copyIndex}`} className={`market-feed-art${item.sold?' is-sold':''}`} style={{'--stack-index':index} as CSSProperties}><CardArt card={stackCard}/>{(item.sold||Number(item.soldQuantity)>0)&&copyIndex===0&&<span className="market-feed-art-sold">{item.sold?locale==='ID'?'Baru terjual':'Just sold':locale==='ID'?`${Number(item.soldQuantity)} terjual`:`${Number(item.soldQuantity)} sold`}</span>}</div>:null;
                      })}
                      {totalCards>1&&<span className="market-feed-quantity" aria-label={`${totalCards} ${locale==='ID'?'kartu':'cards'}`}>{totalCards}</span>}
                    </div>
                    <div className="market-feed-copy">
                      <h2>{listing.title}</h2>
                      <small className="market-feed-meta">
                        <span className="market-feed-meta-primary"><span className="market-feed-meta-primary-line"><span className="market-feed-location"><MapPin size={11}/><span className="market-feed-location-name">{listing.city}</span></span>{listing.createdAt&&<><span className="market-feed-meta-separator" aria-hidden="true">|</span><span className="market-feed-meta-tail"><MarketTimestamp value={listing.createdAt}/><span className="market-feed-seller">{locale==='ID'?'oleh':'by'} {listing.sellerUsername?<Link href={`/players/${encodeURIComponent(listing.sellerUsername)}`} onClick={event=>event.stopPropagation()}>{listing.seller}</Link>:listing.seller}</span></span></>}</span></span>
                        {listing.type==='WTS'&&<span className="market-feed-meta-secondary"><ShippingCouriers couriers={listing.shippingCouriers??[]} language={locale}/></span>}
                      </small>
                    </div>
                    <div className="market-feed-trade">
                      <div className="market-feed-status">
                        <b>{fullySold||fullyReserved||listing.type==='WTS'?<Store size={12} aria-hidden="true"/>:<Search size={12} aria-hidden="true"/>}{fullySold?(locale==='ID'?'Baru terjual':'Just sold'):fullyReserved?(locale==='ID'?'Dipesan':'Reserved'):listing.type==='WTB'?(locale==='ID'?'Dicari':'Buying'):(locale==='ID'?'Dijual':'Selling')}</b>
                        {heldCards>0&&!fullyReserved&&listing.type==='WTS'&&<span className="market-feed-held-count">{locale==='ID'?`${heldCards} kartu dipesan`:`${heldCards} ${heldCards===1?'card':'cards'} reserved`}</span>}
                      </div>
                      <div className="market-feed-price">
                        <strong>{listing.amount>0?formatMoney(listing.amount,listing.currency):(locale==='ID'?'Harga belum diatur':'Price not set')}</strong>
                      </div>
                    </div>
                  </>
                );
                const rowClass=`market-feed-row ${listing.type==='WTB'?'is-wtb':'is-wts'}${listing.isOwner?'':' has-row-action'}${!listing.isOwner&&listing.type==='WTS'&&items.length===1?' has-cart-action':''}`;
                return <article key={listing.id} data-listing-id={listing.id} className={`${rowClass} market-feed-entry`}>
                  <div className="market-feed-row-content">{content}</div>
                  <Link href={listingHref(listing)} className="market-feed-row-link" aria-label={locale==='ID'?`Buka ${listing.title}`:`Open ${listing.title}`}/>
                  {!listing.isOwner&&<div className="market-feed-row-actions">
                    {listing.type==='WTB'&&<Link href={listingHref(listing)} className="button secondary is-icon-only market-icon-action market-feed-offer-cards" title={locale==='ID'?'Tawarkan kartu':'Offer cards'} aria-label={locale==='ID'?'Tawarkan kartu':'Offer cards'}><Cards size={17}/></Link>}
                    {listing.type==='WTS'&&!fullyReserved&&items.length===1&&items[0].quantity>0&&(items[0].availableQuantity??items[0].quantity)>0&&<MarketFeedCartButton listing={listing} printingId={items[0].printingId} locale={locale}/>}
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
      <Dialog open={open} modal={!marketVaultOpen} onOpenChange={next=>{if(!next&&(marketVaultOpen||bulkListingOpen))return;if(!next)configLoadVersion.current++;setOpen(next)}}>
        <DialogContent className={`listing-dialog market-sell-dialog ${listingType==='WTB'?'is-buying-request':'is-selling-listing'}`}>
          <div className="market-sell-heading">
            <div className="market-sell-heading-actions"><span>{listingType==='WTB'?(locale==='ID'?'PERMINTAAN BELI':'BUYING REQUEST'):(locale==='ID'?'BUAT LISTING':'CREATE LISTING')}</span><button type="button" className="market-sell-manage-listings" onClick={()=>{setOpen(false);setQuickPanel(null);setAccountPanel('listings')}}><ClipboardText size={15}/>{locale==='ID'?'Listing saya':'My listings'}</button></div>
            <DialogTitle>
              {configuringCard
                ? activeCardObj?.gameSlug==='pokemon'
                  ? (listingType==='WTB'?(locale==='ID'?'Atur permintaan kartu Pokémon.':'Set your Pokémon card request.'):(locale==='ID'?'Atur listing kartu Pokémon.':'Set up this Pokémon listing.'))
                  : (listingType==='WTB'?(locale==='ID'?'Atur permintaan kartu.':'Set your card request.'):(locale==='ID'?'Atur kartu untuk dijual.':'Set up your card for sale.'))
                : bundleCards.length>0
                  ? (listingType==='WTB'?(locale==='ID'?'Rincian permintaan beli.':'Buying request details.'):(locale==='ID'?'Rincian listing paket.':'Bundle listing details.'))
                  : listingType==='WTB'?(locale==='ID'?'Pilih kartu yang ingin Anda beli.':'Choose cards you’re looking to buy.'):(locale==='ID'?'Pilih kartu untuk dijual.':'Select cards to sell.')
              }
            </DialogTitle>
            <DialogDescription>
              {configuringCard
                ? activeCardObj?.gameSlug==='pokemon'
                  ? (listingType==='WTB'?(locale==='ID'?'Pilih set dan bahasa yang dicari, lalu atur kondisi, jumlah, dan tawaran.':'Confirm the set and language you want, then set condition, copies, and your offer.'):(locale==='ID'?'Pastikan set dan bahasa kartu, lalu atur kondisi, jumlah, dan harga.':'Confirm the set and language, then set condition, copies, and price.'))
                  : (listingType==='WTB'?(locale==='ID'?'Pilih versi cetak, kondisi, jumlah, dan harga yang Anda tawarkan.':'Choose the printing, condition, copies, and offer per card.'):(locale==='ID'?'Pilih versi cetak, kondisi, jumlah, dan harga per kartu.':'Choose the printing, condition, quantity, and price per card.'))
                : bundleCards.length>0
                  ? (listingType==='WTB'?(locale==='ID'?'Atur kartu dan anggaran yang Anda tawarkan.':'Review the cards and budget you are offering.'):(locale==='ID'?'Atur rincian listing dan harga total paket.':'Review bundle cards and set overall price.'))
                  : listingType==='WTB'?(locale==='ID'?'Tambahkan kartu, kondisi, jumlah, dan harga yang Anda cari.':'Add the cards, condition, quantity, and price you want.'):(locale==='ID'?'Cari kartu dari katalog atau pilih dari koleksi Anda.':'Search the catalog or choose cards from your Vault.')
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
                  <CardArt card={activeCardObj} missingImageAction={activeCardObj.gameSlug==='pokemon'&&<FeedbackLaunchButton className="pokemon-missing-image-report" request={{initialCategory:'missing-printing',cardCode:activeCardObj.code,printingId:activeCardObj.id}} title="Report this missing card image">Report missing image</FeedbackLaunchButton>}/>
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
                    <p className="eyebrow">{listingType==='WTB'?(locale==='ID'?'KARTU YANG DICARI':'CARD YOU WANT'):(locale==='ID'?'KARTU UNTUK DIJUAL':'CARD FOR SALE')}</p>
                    <h3>{activeCardObj.name}</h3>
                    <p className={`listing-card-sub${activeCardObj.gameSlug==='pokemon'?' is-pokemon':''}`}>
                      <span className="market-sell-code">{activeCardObj.gameSlug==='pokemon'?(activeCardObj.printingCode||activeCardObj.code):activeCardObj.code}</span>
                      {activeCardObj.gameSlug==='pokemon'?<PokemonMarketType card={activeCardObj}/>:<span>{activeCardObj.type}</span>}
                      {activeCardObj.gameSlug==='pokemon'&&activeCardObj.language&&<span>{activeCardObj.language}</span>}
                      {marketRarity(activeCardObj)&&<span className="market-sell-rarity">{marketRarity(activeCardObj)}</span>}
                      {activeCardObj.setCode&&<><span>{activeCardObj.setCode}</span></>}
                      {activeCardObj.gameSlug!=='pokemon'&&activeCardObj.variant&&<><span className="listing-variant-tag">{locale==='ID'&&printingLabel(activeCardObj.variant)==='Standard'?'Standar':printingLabel(activeCardObj.variant)}</span></>}
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
                                <small>{p.set_code??configuringCard.setCode??''} {marketRarity(configuringCard,p.language)&&<span>{marketRarity(configuringCard,p.language)}</span>}</small>
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
                          <div className="listing-benchmark-rate">
                            <span>{locale==='ID'?'Harga dibanding tolok ukur':'Price vs benchmark'}</span>
                            <output aria-live="polite">{benchmarkMultiplierLabel}</output>
                            <div className="market-slider-wrap">
                              <Slider
                                className="listing-benchmark-slider"
                                min={benchmarkSliderMin}
                                max={benchmarkSliderMax}
                                step={benchmarkSliderStep}
                                value={[benchmarkMultiplier]}
                                onValueChange={([value])=>value!==undefined&&setBenchmarkMultiplier(value)}
                                aria-label={locale==='ID'?'Persentase harga dibanding tolok ukur':'Price percentage against benchmark'}
                              />
                              <div className="market-slider-checkpoints" aria-hidden="true">{Array.from({length:Math.floor((benchmarkSliderMax-benchmarkSliderMin)/5)+1},(_,index)=><i key={index} style={{left:`${((benchmarkSliderMin+index*5-benchmarkSliderMin)/(benchmarkSliderMax-benchmarkSliderMin))*100}%`}}/>)}</div>
                            </div>
                            <div className="listing-benchmark-range" aria-hidden="true"><span>{benchmarkSliderMin}%</span><span>{benchmarkSliderMax}%</span></div>
                          </div>
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
                  {activeCardObj.gameSlug==='pokemon'&&selectedPrintingId&&<details className="market-pokemon-listing-activity"><summary>{locale==='ID'?'Aktivitas pasar':'Market activity'}</summary><CardMarketPanel game="pokemon" printingId={selectedPrintingId} printing={{language:activeCardObj.language,setCode:activeCardObj.setCode,printingCode:activeCardObj.printingCode,variant:activeCardObj.variant}} disableExternalPrice/></details>}
                  {/* Vault Copy Selector or Condition Picker */}
                  {listingType==='WTS'&&ownedCopiesForConfig.length>0?(
                    <fieldset className="market-owned-copy-picker">
                      <legend>{locale==='ID'?'Pilih salinan dari koleksi':'Choose a copy from your Vault'}</legend>
                      <div role="radiogroup" aria-label={locale==='ID'?'Salinan koleksi':'Vault copies'}>
                        {ownedCopiesForConfig.map(item=><button key={item.id} type="button" role="radio" aria-checked={itemInstance===item.id} className={itemInstance===item.id?'is-selected':''} onClick={()=>{setItemInstance(item.id);setItemCondition(item.condition||'NM')}}><span className="market-copy-condition">{item.condition||'NM'}</span><span>{item.quantity} {locale==='ID'?'salinan':'copies'}</span><small>{locale==='ID'?'Di koleksi':'In Vault'}</small></button>)}
                      </div>
                    </fieldset>
                  ):(
                    <div className="form-row">
                      <fieldset className="market-condition-field">
                        <legend>{listingType==='WTB'?(locale==='ID'?'Kondisi yang dicari':'Condition wanted'):(locale==='ID'?'Kondisi kartu':'Card condition')}</legend>
                        <div className="market-condition-options" role="radiogroup" aria-label={listingType==='WTB'?(locale==='ID'?'Kondisi yang dicari':'Condition wanted'):(locale==='ID'?'Kondisi kartu':'Card condition')}>
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
                      {listingType==='WTB'?(locale==='ID'?'Jumlah yang dicari':'Copies wanted'):(locale==='ID'?'Jumlah':'Quantity')}
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
                              const used=bundleCards.filter(card=>marketCardIdentity(card.card)===marketCardIdentity(activeCardObj)).reduce((sum,card)=>sum+card.quantity,0);
                              const max=Math.min(listingLimits.maxCopiesPerCard-used,listingLimits.maxListingCopies-bundleCards.reduce((sum,card)=>sum+card.quantity,0),listingType==='WTS'&&ownedCopiesForConfig.length>0?(ownedCopiesForConfig.find(c=>c.id===itemInstance)?.quantity||1):listingLimits.maxCopiesPerCard);
                              setItemQuantity(q=>Math.min(max,q+1));
                            }}
                            disabled={itemQuantity>=Math.min(listingLimits.maxCopiesPerCard-bundleCards.filter(card=>marketCardIdentity(card.card)===marketCardIdentity(activeCardObj)).reduce((sum,card)=>sum+card.quantity,0),listingLimits.maxListingCopies-bundleCards.reduce((sum,card)=>sum+card.quantity,0),listingType==='WTS'&&ownedCopiesForConfig.length>0?(ownedCopiesForConfig.find(c=>c.id===itemInstance)?.quantity||1):listingLimits.maxCopiesPerCard)}
                            aria-label={locale==='ID'?'Tambah jumlah':'Increase quantity'}
                          >
                            <Plus size={13}/>
                          </button>
                        </div>
                      </div>
                    </label>
                    <label>
                      {listingType==='WTB'?(locale==='ID'?'Tawaran per kartu (IDR)':'Your offer per card (IDR)'):(locale==='ID'?'Harga per kartu (IDR)':'Price per card (IDR)')}
                      <input
                        type="number"
                        min="1"
                        step="1000"
                        inputMode="numeric"
                        autoComplete="off"
                        aria-describedby="market-unit-price-help"
                        value={itemPrice}
                        onChange={e=>{
                          const nextPrice=e.target.value;
                          itemPriceEdited.current=true;
                          setItemPrice(nextPrice);
                          const yytIdr=benchmark&&(benchmark.normalizedAmount||Math.round(benchmark.amount*110));
                          if(yytIdr&&Number(nextPrice)>0)setBenchmarkMultiplier(Math.round(Number(nextPrice)/yytIdr*1000)/10);
                        }}
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
                      ? (listingType==='WTB'?(locale==='ID'?'Lanjutkan permintaan beli':'Continue with buy request'):(locale==='ID'?'Lanjut ke rincian listing':'Continue to listing details'))
                      : (listingType==='WTB'?(locale==='ID'?'+ Tambahkan ke permintaan':'+ Add to request'):(locale==='ID'?'+ Tambahkan ke paket':'+ Add to bundle'))
                    }
                  </button>
                </div>
              </div>
            ):bundleCards.length>0&&!isAddingAnother?(
              /* VIEW 2: Bundle Review & Publish Form */
              <form className="form-stack" onSubmit={handlePublishListing}>
                <div className="market-sell-bundle">
                  <div className="market-sell-bundle-header">
                    <span>{listingType==='WTB'?(locale==='ID'?'KARTU YANG INGIN DIBELI':'CARDS TO BUY'):(locale==='ID'?'KARTU DALAM LISTING':'CARDS IN THIS LISTING')}</span>
                    <small>{totalBundleQuantity} {locale==='ID'?'kartu':(totalBundleQuantity===1?'card':'cards')}</small>
                  </div>
                  <div className="market-sell-bundle-list">
                    {bundleCards.map(item=>{
                      const label=printingLabel(item.printing.variant);
                      const displayLabel=locale==='ID'&&label==='Standard'?'Standar':label;
                      return (
                        <div key={item.id} className="market-sell-bundle-item">
                          <div className="market-sell-bundle-thumb">
                            <CardArt card={item.card} small missingImageAction={(item.card as MarketCard).gameSlug==='pokemon'&&<FeedbackLaunchButton className="pokemon-missing-image-report" request={{initialCategory:'missing-printing',cardCode:item.card.code,printingId:item.printing.id}} title="Report this missing card image">Report</FeedbackLaunchButton>}/>
                          </div>
                          <div className="market-sell-bundle-details">
                            <strong>{item.card.name}</strong>
                            <div className="market-sell-bundle-meta">
                          <span>{item.card.code}</span>
                              <span>{displayLabel}</span>
                              <span>{item.card.language??'EN'}</span>
                              <span className="listing-variant-tag">{item.condition}</span>
                              {listingType==='WTS'&&!item.instanceId&&(
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
                                setBundleCards(prev=>{
                                  const current=prev.find(card=>card.id===item.id);
                                  if(!current)return prev;
                                  const sameIdentity=prev.filter(card=>marketCardIdentity(card.card)===marketCardIdentity(current.card)).reduce((sum,card)=>sum+card.quantity,0);
                                  const total=prev.reduce((sum,card)=>sum+card.quantity,0);
                                  const maximum=Math.min(current.instanceId?current.availableQuantity:listingLimits.maxCopiesPerCard,listingLimits.maxCopiesPerCard-(sameIdentity-current.quantity),listingLimits.maxListingCopies-(total-current.quantity));
                                  return prev.map(card=>card.id===item.id?{...card,quantity:Math.min(maximum,card.quantity+1)}:card);
                                });
                              }}
                              disabled={item.quantity>=Math.min(item.instanceId?item.availableQuantity:listingLimits.maxCopiesPerCard,listingLimits.maxCopiesPerCard-(bundleCards.filter(card=>marketCardIdentity(card.card)===marketCardIdentity(item.card)).reduce((sum,card)=>sum+card.quantity,0)-item.quantity),listingLimits.maxListingCopies-(totalBundleQuantity-item.quantity))}
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
                  <p className="market-bundle-limit-note">{locale==='ID'?`Maksimal ${listingLimits.maxListingCopies} kartu dalam satu listing, maksimal ${listingLimits.maxCopiesPerCard} salinan untuk kartu yang sama.`:`Up to ${listingLimits.maxListingCopies} cards in one listing, with no more than ${listingLimits.maxCopiesPerCard} copies of the same card.`}</p>
                  <button
                    type="button"
                    className="market-sell-add-card-btn"
                    onClick={()=>{
                      setCardSearch('');
                      setConfiguringCard(null);
                      setIsAddingAnother(true);
                      setSearchSource('catalog');
                      setListingGameScope('all');
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
                    {listingType==='WTB'?(locale==='ID'?'Total anggaran (IDR)':'Total budget (IDR)'):(locale==='ID'?'Total harga listing (IDR)':'Total listing price (IDR)')}
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
                    {listingType==='WTS'&&enteredListingTotal>0&&<small className="market-sell-fee-estimate">{locale==='ID'?`Biaya layanan Market ${listingFeePercent}%: Rp ${estimatedSellerFee.toLocaleString('id-ID')} - perkiraan hasil penjualan Rp ${(enteredListingTotal-estimatedSellerFee).toLocaleString('id-ID')}`:`Market service fee ${listingFeePercent}%: IDR ${estimatedSellerFee.toLocaleString('en-US')} - estimated proceeds IDR ${(enteredListingTotal-estimatedSellerFee).toLocaleString('en-US')}`}</small>}
                  </label>
                  {listingType==='WTB'?(
                    <label className="market-request-city-label">
                      {locale==='ID'?'Kota pengiriman':'Delivery city'}
                      <div className="market-request-city-field">
                        <span className={buyerCity?'':'is-empty'}>{buyerCity|| (locale==='ID'?'Belum ada alamat pengiriman':'No delivery address saved')}</span>
                        <button type="button" className="market-request-city-change" onClick={()=>{setProfileQuickTab('delivery');setQuickPanel('profile')}}>
                          {buyerCity?(locale==='ID'?'Ubah alamat':'Change address'):(locale==='ID'?'Tambah alamat':'Add address')}
                        </button>
                      </div>
                      <small>{buyerCity?(locale==='ID'?'Diambil dari alamat pengiriman Anda.':'From your saved delivery address.'):(locale==='ID'?'Tambahkan alamat untuk memilih kota.':'Add a delivery address to set your city.')}</small>
                    </label>
                  ):(
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
                  )}
                </div>
                {saveError&&<p role="alert" className="error-text">{saveError}</p>}
                <button className="market-list-button" disabled={busy||bundleCards.length===0||(listingType==='WTB'&&!buyerCity)}>
                  {busy
                    ?(locale==='ID'?'Mempublikasikan...':'Publishing...')
                    :listingType==='WTS'&&bundleCards.some(it=>!it.instanceId)
                      ?(locale==='ID'?'Simpan ke koleksi & publikasikan':'Save to Vault & Publish')
                      :listingType==='WTB'?(locale==='ID'?'Buat permintaan beli':'Post buying request'):(locale==='ID'?'Publikasikan listing':'Publish listing')
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
                {/* Source choices and the bundle action stay together. */}
                {listingType==='WTS'&&(data?.collection?.length??0)>0&&(
                  <div className="market-sell-source-toggle" role="group" aria-label={locale==='ID'?'Sumber kartu':'Card source'}>
                    <button
                      type="button"
                      className={searchSource==='catalog'?'active':''}
                      onClick={()=>setSearchSource('catalog')}
                      aria-pressed={searchSource==='catalog'}
                    >
                      <Search size={14}/>
                      <span>{locale==='ID'?'Cari di Katalog':'Search Catalog'}</span>
                    </button>
                    <button
                      type="button"
                      className={searchSource==='vault'?'active':''}
                      onClick={()=>setSearchSource('vault')}
                      aria-pressed={searchSource==='vault'}
                    >
                      <WalletCards size={14}/>
                      <span>{locale==='ID'?'Dari Vault':'From My Vault'}</span>
                    </button>
                  </div>
                )}
                {listingType==='WTB'&&<div className="market-sell-source-toggle" role="group" aria-label={locale==='ID'?'Sumber kartu':'Card source'}>
                  <button type="button" className={searchSource==='catalog'?'active':''} onClick={()=>setSearchSource('catalog')} aria-pressed={searchSource==='catalog'}><Search size={14}/><span>{locale==='ID'?'Cari di Katalog':'Search Catalog'}</span></button>
                  <button type="button" className={searchSource==='wishlist'?'active':''} onClick={()=>setSearchSource('wishlist')} aria-pressed={searchSource==='wishlist'}><WalletCards size={14}/><span>{locale==='ID'?'Dari Wishlist':'From Wishlist'}</span></button>
                </div>}
                <div className="market-listing-game-scope" role="group" aria-label={locale==='ID'?'Game kartu':'Card game'}>
                  <span>{locale==='ID'?'Game':'Game'}</span>
                  {(['one-piece','pokemon','all'] as const).map(scope=><button key={scope} type="button" className={listingGameScope===scope?'active':''} aria-pressed={listingGameScope===scope} onClick={()=>setListingGameScope(scope)}>{scope==='one-piece'?'One Piece':scope==='pokemon'?'Pokémon':locale==='ID'?'Semua game':'All games'}</button>)}
                </div>
                {listingType==='WTS'&&bundleCards.length===0&&(data?.collection?.length??0)>0&&<button type="button" className="market-sell-bundle-trigger" onClick={()=>{configLoadVersion.current++;setOpen(false);window.setTimeout(()=>setBulkListingOpen(true),0)}} aria-haspopup="dialog">
                  <Cards size={16}/><span>{locale==='ID'?'Buat listing dari Vault':'Build a listing from Vault'}</span><small>{locale==='ID'?'Pilih beberapa kartu sekaligus':'Select several cards at once'}</small><ArrowRight size={16}/>
                </button>}
                {searchSource==='wishlist'&&listingType==='WTB'?<WishlistCardPicker items={data?.wishlist??[]} gameSlug={listingGameScope} value={cardSearch} onSelect={card=>loadCardForConfig(card)} locale={locale}/>:searchSource==='vault'&&(data?.collection?.length??0)>0?(
                  <VaultCardPicker
                    items={data!.collection.map(copy=>({...copy,quantity:Math.max(0,copy.quantity-(copy.listedQuantity??0)-bundleCards.filter(item=>item.instanceId===copy.id).reduce((sum,item)=>sum+item.quantity,0))})).filter(copy=>copy.type==='RAW')}
                    onSelect={(card,instanceId,qty,cond)=>loadCardForConfig(card,instanceId,qty,cond)}
                    locale={locale}
                    gameSlug={listingGameScope}
                  />
                ):(
                  <CardSearch
                    value={cardSearch}
                    onChange={setCardSearch}
                    onSelect={card=>loadCardForConfig(card)}
                    onAddToVault={card=>{setMarketVaultCard(card);setMarketVaultOpen(true);}}
                    locale={locale}
                    wanted={listingType==='WTB'}
                    gameSlug={listingGameScope}
                  />
                )}
              </div>
            )}
            </>}
          </div>
        </DialogContent>
      </Dialog>
      {bulkListingOpen&&<BulkListingModal open={bulkListingOpen} onClose={wasPublished=>{setBulkListingOpen(false);if(!wasPublished)setOpen(true)}} language={locale} stacks={groupVaultStacks((data?.collection??[]).map(item=>enrichCollectionItem(item,new Set())))} onPublished={async()=>{await refresh();await refreshAccount()}}/>}
      {publishedShare&&<ShareButton title={publishedShare.title} path={listingHref(publishedShare)} cards={publishedShare.cards.map(item=>({card:printingToCard(item.card,item.printing),printingId:item.printing.id,quantity:item.quantity,condition:item.condition,unitAmount:item.unitAmount}))} subtitle={locale==='ID'?`${publishedShare.cards.reduce((sum,item)=>sum+item.quantity,0)} kartu`:`${publishedShare.cards.reduce((sum,item)=>sum+item.quantity,0)} cards`} listingInfo={{seller:publishedShare.seller,city:publishedShare.city,expiresAt:publishedShare.expiresAt,timeZone:publishedShare.timeZone}} price={formatMoney(publishedShare.price,'IDR')} openOnMount hideTrigger onOpenChange={open=>{if(!open)setPublishedShare(null)}}/>}

      {data&&<MarketQuickPanel panel={accountPanel??quickPanel} onOpenChange={open=>{if(!open){setAccountPanel(null);setQuickPanel(null)}}} onPanelChange={next=>{if(next==='listings'||next==='offers'||next==='orders'||next==='saved'){setQuickPanel(null);setAccountPanel(next)}else{setAccountPanel(null);setQuickPanel(next)}}} onCreateListing={()=>{setAccountPanel(null);setQuickPanel(null);beginListing()}} locale={locale} account={data} activityCounts={activityCounts} initialOrderId={modalOnly?null:searchParams.get('order')} initialConversationId={modalOnly?null:searchParams.get('conversation')} initialProfileTab={profileQuickTab} onRefresh={async()=>{await Promise.all([refreshAccount(),refresh()])}} onSaved={async()=>{await refreshAccount();setAccountPanel(null);setQuickPanel(null)}}/>}
      <AddEditItemModal
        key={`${marketVaultCard?.id??'market-card'}-${marketVaultOpen?'open':'closed'}`}
        open={marketVaultOpen}
        onClose={()=>{setMarketVaultOpen(false);setMarketVaultCard(null);}}
        onSaved={async()=>{if(data)await refreshAccount();}}
        initialCard={marketVaultCard??undefined}
        isAnonymous={!data}
        language={locale}
        gameSlug={gameSlug}
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
