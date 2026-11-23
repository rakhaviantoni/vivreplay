'use client';
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {useRouteLocale} from '@/components/locale-provider';
import {ArrowLeftIcon as ArrowLeft,ArrowRightIcon as ArrowRight,MagnifyingGlassIcon as Search,PlusIcon as Plus,UploadSimpleIcon as UploadSimple,XIcon as X} from '@phosphor-icons/react';
import {matchesSealedProductQuery,normalizeSealedProductQuery,sealedProductDisplayName,sealedProductPublicCode,sealedProductLanguage,sealedProducts,sealedProductKinds,type SealedProduct,type SealedProductKind} from '@/lib/market/sealed-products';
import {isAccessoryKind,productConditionLabel,productConditionOptions} from '@/lib/market/product-conditions';
import {MarketGeneralComposer} from './market-general-composer';
import {MarketGameMark} from './market';
import {useMarketListingLimits} from '@/lib/market/use-listing-limits';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import {IdrInput} from '@/components/ui/idr-input';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import type {GeneralMarketCategory} from '@/lib/market/general-products';
import './market-sealed.css';

export type BundleProductInput={productType:'SEALED'|'GENERAL';productId?:string;title:string;quantity:number;unitAmount:number;condition:string;notes:string;photoIds:string[];parcel?:{weight:number;length:number;width:number;height:number};generalProduct?:{category:string;brand:string;model:string;attributes:Record<string,string>};catalogProduct?:SealedProduct};
export function MarketSealedComposer({type,onPublished,onAddToBundle,modeControl,initialProduct}:{type:'WTS'|'WTB';onPublished:()=>void;onAddToBundle?:(item:BundleProductInput)=>void;modeControl?:ReactNode;initialProduct?:SealedProduct}){
  const language=useRouteLocale();const isId=language==='ID';
  const productStockLimit=useMarketListingLimits().maxProductStock??10;
  const [query,setQuery]=useState('');const [gameScope,setGameScope]=useState<'all'|'one-piece'|'pokemon'>('all');const [edition,setEdition]=useState<'asia'|'global'|'all'>('all');const [kind,setKind]=useState<SealedProductKind|'all'>('all');
  const [visibleCount,setVisibleCount]=useState(30);
  const [source,setSource]=useState<'catalog'|'general'>('catalog');
  const [generalInitialCategory,setGeneralInitialCategory]=useState<GeneralMarketCategory>('HOBBY');
  const [generalInitialTitle,setGeneralInitialTitle]=useState('');
  const [product,setProduct]=useState<SealedProduct|undefined>(initialProduct);const [quantity,setQuantity]=useState(1);const [price,setPrice]=useState('');
  const [condition,setCondition]=useState('SEALED');const [notes,setNotes]=useState('');const [photos,setPhotos]=useState<string[]>([]);
  const [parcel,setParcel]=useState({weight:'',length:'',width:'',height:''});const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{if(!initialProduct)return;setProduct(initialProduct);setQuantity(1);setPrice('');setCondition(isAccessoryKind(initialProduct.kind)?'NEW':'SEALED');setNotes('');setPhotos([]);setParcel({weight:'',length:'',width:'',height:''});setError('')},[initialProduct?.id]);
  const kinds=useMemo(()=>(Object.keys(sealedProductKinds) as SealedProductKind[]).filter(k=>sealedProducts.some(item=>(gameScope==='all'||(item.game??'one-piece')===gameScope)&&item.kind===k)),[gameScope]);
  useEffect(()=>{if(kind!=='all'&&!kinds.includes(kind))setKind('all');},[kind,kinds]);
  const selectedConditionOptions=product?productConditionOptions(product.kind):[];
  const normalizedQuery=normalizeSealedProductQuery(query);
  const choices=useMemo(()=>sealedProducts.filter(item=>(gameScope==='all'||(item.game??'one-piece')===gameScope)&&(edition==='all'||item.edition===edition)&&(kind==='all'||item.kind===kind)&&matchesSealedProductQuery(`${item.name} ${item.setCode} ${item.kind} ${item.edition}`,normalizedQuery)),[edition,gameScope,kind,normalizedQuery]);
  const chooseProduct=(next:SealedProduct)=>{setProduct(next);setQuantity(1);setPrice('');setCondition(isAccessoryKind(next.kind)?'NEW':'SEALED');setNotes('');setPhotos([]);setParcel({weight:'',length:'',width:'',height:''});setError('')};
  const openCustomTcgProduct=()=>{setGeneralInitialCategory('TCG_PRODUCT');setGeneralInitialTitle(query.trim());setSource('general');};
  async function upload(files:FileList|null){if(!files?.length)return;const remaining=6-photos.length;const selected=Array.from(files).slice(0,remaining);if(!selected.length)return;setBusy(true);setError('');try{const added:string[]=[];for(const file of selected){const form=new FormData();form.set('photo',file);const response=await fetch('/api/market/product-photos',{method:'POST',body:form});const data=await response.json() as {error?:string;id:string};if(!response.ok)throw new Error(data.error||(isId?'Gagal mengunggah foto.':'Photo upload failed.'));added.push(data.id)}setPhotos(current=>[...current,...added]);}catch(error){setError(error instanceof Error?error.message:(isId?'Gagal mengunggah foto.':'Photo upload failed.'));}finally{setBusy(false)}}
  async function publish(){if(!product)return;setBusy(true);setError('');try{const packedSize=type==='WTS'?{weight:Number(parcel.weight),length:Number(parcel.length),width:Number(parcel.width),height:Number(parcel.height)}:undefined;const item:BundleProductInput={productType:'SEALED',productId:product.id,title:`${product.name} ${sealedProductLanguage(product)}`.slice(0,100),quantity,unitAmount:Number(price),condition,notes,photoIds:photos,...(packedSize?{parcel:packedSize}:{}),catalogProduct:product};if(onAddToBundle){onAddToBundle(item);return;}const response=await fetch('/api/listings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productType:'SEALED',productId:product.id,type,title:item.title,quantity,unitAmount:Number(price),condition,notes,photoIds:photos,...(packedSize?{parcel:packedSize}:{})})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||(isId?'Listing tidak dapat diterbitkan.':'Could not publish the listing.'));onPublished();}catch(error){setError(error instanceof Error?error.message:(isId?'Listing tidak dapat diterbitkan.':'Could not publish the listing.'));}finally{setBusy(false)}}
  const copy=(en:string,id:string)=>isId?id:en;
  const displayProduct=sealedProductDisplayName;
  return <div className="market-sealed-composer">
    <div className="market-sealed-switch-row">
      {modeControl}
      {!product&&<div className="market-product-source-switch" role="group" aria-label={copy('Product source','Sumber produk')}><button type="button" aria-pressed={source==='catalog'} onClick={()=>{setSource('catalog');setGeneralInitialCategory('HOBBY');setGeneralInitialTitle('');}}>{copy('TCG products','Produk TCG')}</button><button type="button" aria-pressed={source==='general'} onClick={()=>{setGeneralInitialCategory('HOBBY');setGeneralInitialTitle('');setSource('general');}}>{copy('Other items','Barang lain')}</button></div>}
      {!product&&source==='catalog'&&(
        <div className="market-category-switch market-listing-game-scope" role="group" aria-label={copy('Card game','Game kartu')}>
          <button
            type="button"
            data-game-scope="one-piece"
            className={gameScope==='one-piece'||gameScope==='all'?'is-active':''}
            aria-label="One Piece Card Game"
            title="One Piece Card Game"
            aria-pressed={gameScope==='one-piece'||gameScope==='all'}
            onClick={()=>{
              setVisibleCount(30);
              if(gameScope==='all')setGameScope('pokemon');
              else if(gameScope==='pokemon')setGameScope('all');
            }}
          >
            <MarketGameMark gameSlug="one-piece"/>
          </button>
          <button
            type="button"
            data-game-scope="pokemon"
            className={gameScope==='pokemon'||gameScope==='all'?'is-active':''}
            aria-label="Pokémon Trading Card Game"
            title="Pokémon Trading Card Game"
            aria-pressed={gameScope==='pokemon'||gameScope==='all'}
            onClick={()=>{
              setVisibleCount(30);
              if(gameScope==='all')setGameScope('one-piece');
              else if(gameScope==='one-piece')setGameScope('all');
            }}
          >
            <MarketGameMark gameSlug="pokemon"/>
          </button>
        </div>
      )}
    </div>
    {source==='general'?<MarketGeneralComposer type={type} initialCategory={generalInitialCategory} initialTitle={generalInitialTitle} onBack={()=>{setSource('catalog');setGeneralInitialCategory('HOBBY');setGeneralInitialTitle('');}} onPublished={onPublished} onAddToBundle={onAddToBundle}/>:!product?<>
      <div className="market-product-picker-top">
        <label className="market-product-search">
          <span>{copy('Find a product','Cari produk')}</span>
          <div>
            <Search size={17}/>
            <input value={query} onChange={event=>{setQuery(event.target.value);setVisibleCount(30)}} placeholder={copy('Name or product code','Nama atau kode produk')} aria-label={copy('Search products','Cari produk')}/>
            {query&&<button type="button" className="market-product-search-clear" onClick={()=>{setQuery('');setVisibleCount(30)}} aria-label={copy('Clear search','Hapus pencarian')}><X size={14}/></button>}
          </div>
        </label>
        <div className="market-product-category">
          <span>{copy('Product type','Jenis produk')}</span>
          <Select value={kind} onValueChange={value=>{setKind(value as typeof kind);setVisibleCount(30)}}>
            <SelectTrigger aria-label={copy('Product type','Jenis produk')} className="market-product-select-trigger">
              <SelectValue/>
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectItem value="all">{copy('All products','Semua produk')}</SelectItem>
              {kinds.map(item=><SelectItem key={item} value={item}>{sealedProductKinds[item]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <fieldset className="market-product-edition"><legend>{copy('Edition','Edisi')}</legend><RadioGroup value={edition} onValueChange={value=>{setEdition(value as typeof edition);setVisibleCount(30)}} className="market-product-edition-options" aria-label={copy('Product edition','Edisi produk')}>
          <label htmlFor="sealed-edition-asia" className={edition==='asia'?'is-selected':''}><RadioGroupItem id="sealed-edition-asia" value="asia"/><span>JP</span></label>
          <label htmlFor="sealed-edition-global" className={edition==='global'?'is-selected':''}><RadioGroupItem id="sealed-edition-global" value="global"/><span>EN</span></label>
          <label htmlFor="sealed-edition-all" className={edition==='all'?'is-selected':''}><RadioGroupItem id="sealed-edition-all" value="all"/><span>{copy('All','Semua')}</span></label>
        </RadioGroup></fieldset>
      </div>
      <div className="market-product-results-heading">
        <div>
          <strong>{query.trim()?copy('Matches','Hasil pencarian'):copy('Available products','Produk tersedia')}</strong>
          <span>{choices.length}</span>
        </div>
        <button type="button" className="market-product-custom-btn" onClick={openCustomTcgProduct}>
          <Plus size={14}/>
          <span>{copy('List unlisted TCG product','Buat produk TCG lainnya')}</span>
        </button>
      </div>
      <div className="market-sealed-choices" aria-label={copy('Products','Produk')}>
        {choices.slice(0,visibleCount).map(item=><button key={item.id} type="button" onClick={()=>chooseProduct(item)}>
          <span className="market-product-choice-art">{item.imageUrl?<img src={item.imageUrl} alt="" loading="lazy"/>:<span aria-hidden="true"/>}</span>
          <span className="market-product-choice-copy"><strong>{item.design||displayProduct(item)}</strong>{item.design&&<span className="market-product-choice-series">{item.name.endsWith(item.design)?item.name.slice(0,-item.design.length).trim():item.name}</span>}<span className="market-product-choice-tags"><small>{sealedProductKinds[item.kind]}</small>{sealedProductPublicCode(item)&&<small>{sealedProductPublicCode(item)}</small>}<small>{sealedProductLanguage(item)}</small></span></span>
          <ArrowRight size={17} aria-hidden="true"/>
        </button>)}
        {visibleCount<choices.length&&<div className="market-product-load-more"><button type="button" onClick={()=>setVisibleCount(count=>count+30)}>{copy('Show more products','Tampilkan produk lainnya')}</button></div>}
        {!choices.length&&<div className="market-product-empty">
          <strong>{copy('No products found in catalog','Produk tidak ditemukan di katalog')}</strong>
          <span>{copy('You can still list any TCG product (Indonesian editions, sleeves, boxes, etc.) with your own photos.','Anda tetap bisa membuat listing produk TCG apa pun (edisi Indonesia, sleeve, box, dll.) dengan foto Anda sendiri.')}</span>
          <button type="button" className="market-product-custom-btn is-primary" onClick={openCustomTcgProduct}>
            <Plus size={14}/>
            <span>{copy('List custom TCG product','Buat listing produk TCG kustom')}</span>
          </button>
        </div>}
      </div>
    </>:<>
      <button type="button" className="market-product-back-btn" disabled={busy} onClick={()=>setProduct(undefined)}>
        <ArrowLeft size={14} aria-hidden="true"/>
        <span>{copy('Back to products','Kembali ke daftar produk')}</span>
      </button>
      <div className="market-sealed-selection"><span className="market-product-selection-art">{product.imageUrl?<img src={product.imageUrl} alt={displayProduct(product)}/>:null}</span><div><span className="market-product-selection-kind">{sealedProductKinds[product.kind]}</span><strong>{displayProduct(product)}</strong><small>{sealedProductPublicCode(product)}<span>{sealedProductLanguage(product)}</span></small>{product.contents&&<p className="market-product-contents">{product.contents}</p>}</div></div>
      <div className="market-sealed-fields"><label>{type==='WTS'?copy('Quantity available','Jumlah tersedia'):copy('Quantity wanted','Jumlah yang dicari')}<input type="number" min={1} max={productStockLimit} value={quantity} onChange={event=>setQuantity(Math.min(productStockLimit,Math.max(1,Number(event.target.value)||1)))}/><small>{copy(`Up to ${productStockLimit} units per listing`,`Maksimal ${productStockLimit} unit per listing`)}</small></label><label>{type==='WTS'?copy('Price per item (IDR)','Harga per produk (IDR)'):copy('Offer per item (IDR)','Tawaran per produk (IDR)')}<IdrInput value={price} onValueChange={setPrice}/></label>
        <fieldset className="market-product-condition-field"><legend>{type==='WTB'?copy('Condition wanted','Kondisi yang dicari'):copy('Condition','Kondisi')}</legend>
          {selectedConditionOptions.length<=2?<RadioGroup value={condition} onValueChange={setCondition} className="market-product-condition-options" aria-label={type==='WTB'?copy('Condition wanted','Kondisi yang dicari'):copy('Condition','Kondisi')}>
            {selectedConditionOptions.map(value=><label key={value} htmlFor={`sealed-condition-${value}`} className={condition===value?'is-selected':''}><RadioGroupItem id={`sealed-condition-${value}`} value={value}/><span className="market-product-radio-mark" aria-hidden="true"/><span>{productConditionLabel(value,language)}</span></label>)}
          </RadioGroup>:<Select value={condition} onValueChange={setCondition}><SelectTrigger className="market-product-condition-select" aria-label={type==='WTB'?copy('Condition wanted','Kondisi yang dicari'):copy('Condition','Kondisi')}><SelectValue/></SelectTrigger><SelectContent position="popper" align="start">{selectedConditionOptions.map(value=><SelectItem key={value} value={value}>{productConditionLabel(value,language)}</SelectItem>)}</SelectContent></Select>}
        </fieldset>
      </div>
      <label>{copy('Condition notes','Catatan kondisi')}<textarea maxLength={1000} value={notes} onChange={event=>setNotes(event.target.value)} placeholder={type==='WTB'?copy('Describe the condition or design you want','Jelaskan kondisi atau desain yang dicari'):copy('Mention wear, damage, or missing pieces','Sebutkan tanda pemakaian, kerusakan, atau bagian yang tidak lengkap')}/></label>
      {type==='WTS'&&<>
        <fieldset className="market-product-parcel"><legend>{copy('Packed size','Ukuran paket')}</legend><p>{copy('Measure the parcel after adding protective packaging.','Ukur paket setelah diberi pelindung.')}</p><div className="market-sealed-fields">{Object.entries(parcel).map(([key,value])=><label key={key}>{({weight:copy('Weight (g)','Berat (g)'),length:copy('Length (cm)','Panjang (cm)'),width:copy('Width (cm)','Lebar (cm)'),height:copy('Height (cm)','Tinggi (cm)')} as Record<string,string>)[key]??key}<input type="number" min={key==='weight'?10:1} value={value} onChange={event=>setParcel(current=>({...current,[key]:event.target.value}))}/></label>)}</div></fieldset>
        <div className="market-product-photo-section">
          <div className="market-product-photo-header">
            <strong>{copy('Product photos','Foto produk')}</strong>
            <span>{photos.length} / 6</span>
          </div>
          <label className={`market-product-photo-upload${photos.length>=6?' is-full':''}`}>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||photos.length>=6} onChange={event=>{void upload(event.target.files);event.target.value='';}}/>
            <UploadSimple size={18} aria-hidden="true"/>
            <span>{busy?copy('Uploading photos…','Mengunggah foto…'):photos.length>=6?copy('Maximum 6 photos reached','Maksimal 6 foto tercapai'):copy('Select up to 6 photos (multi-select supported)','Pilih hingga 6 foto (mendukung multi-pilih)')}</span>
            <small>{isAccessoryKind(product.kind)?copy('Show the product and any signs of wear.','Tampilkan produk dan tanda pemakaiannya.'):copy('Show the seal and any wear on the packaging.','Tampilkan segel dan kondisi kemasan.')}</small>
          </label>
          {photos.length>0&&<div className="market-sealed-photos">{photos.map(photo=><div key={photo} className="market-product-photo-card"><img src={`/api/market/product-photos/${photo}`} alt={copy('Product photo','Foto produk')}/><button type="button" className="market-product-photo-remove" onClick={()=>setPhotos(current=>current.filter(id=>id!==photo))} aria-label={copy('Remove photo','Hapus foto')} title={copy('Remove photo','Hapus foto')}><X size={13}/></button></div>)}</div>}
        </div>
      </>}
      <div className="market-product-publish-row"><span>{copy('Total','Total')}<strong>IDR {(quantity*Number(price||0)).toLocaleString(isId?'id-ID':'en-US')}</strong></span><button type="button" className="button" disabled={busy||!Number(price)||quantity<1||(type==='WTS'&&(!photos.length||Object.values(parcel).some(value=>!Number(value))))} onClick={()=>void publish()}>{busy?copy('Saving…','Menyimpan…'):onAddToBundle?copy('Add to bundle','Tambahkan ke paket'):type==='WTS'?copy('Publish listing','Terbitkan listing'):copy('Post buying request','Buat permintaan beli')}</button></div>
    </>}
    {error&&<p role="alert" className="market-product-error">{error}</p>}
  </div>;
}
