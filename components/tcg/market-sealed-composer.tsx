'use client';
import {useMemo,useState} from 'react';
import {useRouteLocale} from '@/components/locale-provider';
import {ArrowRightIcon as ArrowRight,MagnifyingGlassIcon as Search} from '@phosphor-icons/react';
import {matchesSealedProductQuery,normalizeSealedProductQuery,sealedProductDisplayName,sealedProductPublicCode,sealedProducts,sealedProductKinds,type SealedProduct,type SealedProductKind} from '@/lib/market/sealed-products';
import {isAccessoryKind,productConditionLabel,productConditionOptions} from '@/lib/market/product-conditions';
import {MarketGeneralComposer} from './market-general-composer';
import {useMarketListingLimits} from '@/lib/market/use-listing-limits';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import './market-sealed.css';

export type BundleProductInput={productType:'SEALED'|'GENERAL';productId?:string;title:string;quantity:number;unitAmount:number;condition:string;notes:string;photoIds:string[];parcel?:{weight:number;length:number;width:number;height:number};generalProduct?:{category:string;brand:string;model:string;attributes:Record<string,string>};catalogProduct?:SealedProduct};
export function MarketSealedComposer({type,onPublished,onAddToBundle,onBackToBundle}:{type:'WTS'|'WTB';onPublished:()=>void;onAddToBundle?:(item:BundleProductInput)=>void;onBackToBundle?:()=>void}){
  const language=useRouteLocale();const isId=language==='ID';
  const productStockLimit=useMarketListingLimits().maxProductStock??10;
  const [query,setQuery]=useState('');const [edition,setEdition]=useState<'asia'|'global'|'all'>('asia');const [kind,setKind]=useState<SealedProductKind|'all'>('all');
  const [visibleCount,setVisibleCount]=useState(30);
  const [source,setSource]=useState<'catalog'|'general'>('catalog');
  const [product,setProduct]=useState<SealedProduct>();const [quantity,setQuantity]=useState(1);const [price,setPrice]=useState('');
  const [condition,setCondition]=useState('SEALED');const [notes,setNotes]=useState('');const [photos,setPhotos]=useState<string[]>([]);
  const [parcel,setParcel]=useState({weight:'',length:'',width:'',height:''});const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const kinds=useMemo(()=>(Object.keys(sealedProductKinds) as SealedProductKind[]).filter(kind=>sealedProducts.some(item=>item.kind===kind)),[]);
  const selectedConditionOptions=product?productConditionOptions(product.kind):[];
  const normalizedQuery=normalizeSealedProductQuery(query);
  const choices=useMemo(()=>sealedProducts.filter(item=>(edition==='all'||item.edition===edition)&&(kind==='all'||item.kind===kind)&&matchesSealedProductQuery(`${item.name} ${item.setCode} ${item.kind} ${item.edition}`,normalizedQuery)),[edition,kind,normalizedQuery]);
  const chooseProduct=(next:SealedProduct)=>{setProduct(next);setQuantity(1);setPrice('');setCondition(isAccessoryKind(next.kind)?'NEW':'SEALED');setNotes('');setPhotos([]);setParcel({weight:'',length:'',width:'',height:''});setError('')};
  async function upload(files:FileList|null){if(!files?.length)return;const remaining=6-photos.length;const selected=Array.from(files).slice(0,remaining);if(!selected.length)return;setBusy(true);setError('');try{const added:string[]=[];for(const file of selected){const form=new FormData();form.set('photo',file);const response=await fetch('/api/market/product-photos',{method:'POST',body:form});const data=await response.json() as {error?:string;id:string};if(!response.ok)throw new Error(data.error||'Photo upload failed.');added.push(data.id)}setPhotos(current=>[...current,...added]);}catch(error){setError(error instanceof Error?error.message:'Photo upload failed.');}finally{setBusy(false)}}
  async function publish(){if(!product)return;setBusy(true);setError('');try{const packedSize=type==='WTS'?{weight:Number(parcel.weight),length:Number(parcel.length),width:Number(parcel.width),height:Number(parcel.height)}:undefined;const item:BundleProductInput={productType:'SEALED',productId:product.id,title:`${product.name} ${product.edition==='asia'?'Asia':'Global'}`.slice(0,100),quantity,unitAmount:Number(price),condition,notes,photoIds:photos,...(packedSize?{parcel:packedSize}:{}),catalogProduct:product};if(onAddToBundle){onAddToBundle(item);return;}const response=await fetch('/api/listings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productType:'SEALED',productId:product.id,type,title:item.title,quantity,unitAmount:Number(price),condition,notes,photoIds:photos,...(packedSize?{parcel:packedSize}:{})})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||'Could not publish the listing.');onPublished();}catch(error){setError(error instanceof Error?error.message:'Could not publish the listing.');}finally{setBusy(false)}}
  const copy=(en:string,id:string)=>isId?id:en;
  const displayProduct=sealedProductDisplayName;
  return <div className="market-sealed-composer">
    {onBackToBundle&&<button type="button" className="listing-change-card-btn" onClick={onBackToBundle}>{copy('Back','Kembali')}</button>}
    {!product&&<div className="market-product-source-switch" role="group" aria-label={copy('Product source','Sumber produk')}><button type="button" aria-pressed={source==='catalog'} onClick={()=>setSource('catalog')}>{copy('TCG products','Produk TCG')}</button><button type="button" aria-pressed={source==='general'} onClick={()=>setSource('general')}>{copy('Other items','Barang lain')}</button></div>}
    {source==='general'?<MarketGeneralComposer type={type} onBack={()=>setSource('catalog')} onPublished={onPublished} onAddToBundle={onAddToBundle}/>:!product?<>
      <div className="market-product-picker-top">
        <label className="market-product-search"><span>{copy('Find a product','Cari produk')}</span><div><Search size={17}/><input value={query} onChange={event=>{setQuery(event.target.value);setVisibleCount(30)}} placeholder={copy('Name or product code','Nama atau kode produk')} aria-label={copy('Search products','Cari produk')}/></div></label>
        <label className="market-product-category"><span>{copy('Product type','Jenis produk')}</span><select value={kind} onChange={event=>{setKind(event.target.value as typeof kind);setVisibleCount(30)}}><option value="all">{copy('All products','Semua produk')}</option>{kinds.map(item=><option key={item} value={item}>{sealedProductKinds[item]}</option>)}</select></label>
        <fieldset className="market-product-edition"><legend>{copy('Edition','Edisi')}</legend><RadioGroup value={edition} onValueChange={value=>{setEdition(value as typeof edition);setVisibleCount(30)}} className="market-product-edition-options" aria-label={copy('Product edition','Edisi produk')}>
          <div className={edition==='asia'?'is-selected':''}><RadioGroupItem value="asia"/><span>Asia</span></div>
          <div className={edition==='global'?'is-selected':''}><RadioGroupItem value="global"/><span>Global</span></div>
          <div className={edition==='all'?'is-selected':''}><RadioGroupItem value="all"/><span>{copy('All','Semua')}</span></div>
        </RadioGroup></fieldset>
      </div>
      <div className="market-product-results-heading"><strong>{query.trim()?copy('Matches','Hasil pencarian'):copy('Available products','Produk tersedia')}</strong><span>{choices.length}</span></div>
      <div className="market-sealed-choices" aria-label={copy('Products','Produk')}>
        {choices.slice(0,visibleCount).map(item=><button key={item.id} type="button" onClick={()=>chooseProduct(item)}>
          <span className="market-product-choice-art">{item.imageUrl?<img src={item.imageUrl} alt="" loading="lazy"/>:<span aria-hidden="true"/>}</span>
          <span className="market-product-choice-copy"><strong>{item.design||displayProduct(item)}</strong>{item.design&&<span className="market-product-choice-series">{item.name.slice(0,-item.design.length).trim()}</span>}<span className="market-product-choice-tags"><small>{sealedProductKinds[item.kind]}</small>{sealedProductPublicCode(item)&&<small>{sealedProductPublicCode(item)}</small>}<small>{item.edition==='asia'?'Asia':'Global'}</small></span></span>
          <ArrowRight size={17} aria-hidden="true"/>
        </button>)}
        {visibleCount<choices.length&&<div className="market-product-load-more"><button type="button" onClick={()=>setVisibleCount(count=>count+30)}>{copy('Show more products','Tampilkan produk lainnya')}</button></div>}
        {!choices.length&&<div className="market-product-empty"><strong>{copy('No products found','Produk tidak ditemukan')}</strong><span>{copy('Try another name or product code.','Coba nama atau kode produk lain.')}</span></div>}
      </div>
    </>:<>
      <div className="market-sealed-selection"><span className="market-product-selection-art">{product.imageUrl?<img src={product.imageUrl} alt=""/>:null}</span><div><span className="market-product-selection-kind">{sealedProductKinds[product.kind]}</span><strong>{displayProduct(product)}</strong><small>{sealedProductPublicCode(product)}<span>{product.edition==='asia'?'Asia':'Global'}</span></small>{product.contents&&<p className="market-product-contents">{product.contents}</p>}<button type="button" disabled={busy} onClick={()=>setProduct(undefined)}>{copy('Choose another product','Pilih produk lain')}</button></div></div>
      <div className="market-sealed-fields"><label>{type==='WTS'?copy('Quantity available','Jumlah tersedia'):copy('Quantity wanted','Jumlah yang dicari')}<input type="number" min={1} max={productStockLimit} value={quantity} onChange={event=>setQuantity(Math.min(productStockLimit,Math.max(1,Number(event.target.value)||1)))}/><small>{copy(`Up to ${productStockLimit} units per listing`,`Maksimal ${productStockLimit} unit per listing`)}</small></label><label>{type==='WTS'?copy('Price per item (IDR)','Harga per produk (IDR)'):copy('Offer per item (IDR)','Tawaran per produk (IDR)')}<input type="number" min={1} value={price} onChange={event=>setPrice(event.target.value)}/></label>
        <fieldset className="market-product-condition-field"><legend>{type==='WTB'?copy('Condition wanted','Kondisi yang dicari'):copy('Condition','Kondisi')}</legend>
          {selectedConditionOptions.length<=2?<RadioGroup value={condition} onValueChange={setCondition} className="market-product-condition-options" aria-label={type==='WTB'?copy('Condition wanted','Kondisi yang dicari'):copy('Condition','Kondisi')}>
            {selectedConditionOptions.map(value=><div key={value} className={condition===value?'is-selected':''}><RadioGroupItem value={value}/><span className="market-product-radio-mark" aria-hidden="true"/><span>{productConditionLabel(value,language)}</span></div>)}
          </RadioGroup>:<select className="market-product-condition-select" value={condition} onChange={event=>setCondition(event.target.value)}>{selectedConditionOptions.map(value=><option key={value} value={value}>{productConditionLabel(value,language)}</option>)}</select>}
        </fieldset>
      </div>
      <label>{copy('Condition notes','Catatan kondisi')}<textarea maxLength={1000} value={notes} onChange={event=>setNotes(event.target.value)} placeholder={type==='WTB'?copy('Describe the condition or design you want','Jelaskan kondisi atau desain yang dicari'):copy('Mention wear, damage, or missing pieces','Sebutkan tanda pemakaian, kerusakan, atau bagian yang tidak lengkap')}/></label>
      {type==='WTS'&&<>
        <fieldset className="market-product-parcel"><legend>{copy('Packed size','Ukuran paket')}</legend><p>{copy('Measure the parcel after adding protective packaging.','Ukur paket setelah diberi pelindung.')}</p><div className="market-sealed-fields">{Object.entries(parcel).map(([key,value])=><label key={key}>{key==='weight'?copy('Weight (g)','Berat (g)'):`${key.charAt(0).toUpperCase()+key.slice(1)} (cm)`}<input type="number" min={key==='weight'?10:1} value={value} onChange={event=>setParcel(current=>({...current,[key]:event.target.value}))}/></label>)}</div></fieldset>
        <label className="market-product-photo-upload">{copy('Product photos','Foto produk')}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||photos.length>=6} onChange={event=>{void upload(event.target.files);event.target.value='';}}/><small>{isAccessoryKind(product.kind)?copy('Show the product and any signs of wear.','Tampilkan produk dan tanda pemakaiannya.'):copy('Show the seal and any wear on the packaging.','Tampilkan segel dan kondisi kemasan.')}</small></label><div className="market-sealed-photos">{photos.map(photo=><div key={photo}><img src={`/api/market/product-photos/${photo}`} alt={copy('Product photo','Foto produk')}/><button type="button" onClick={()=>setPhotos(current=>current.filter(id=>id!==photo))}>{copy('Remove','Hapus')}</button></div>)}</div>
      </>}
      <div className="market-product-publish-row"><span>{copy('Total','Total')}<strong>IDR {(quantity*Number(price||0)).toLocaleString('en-US')}</strong></span><button type="button" className="button" disabled={busy||!Number(price)||quantity<1||(type==='WTS'&&(!photos.length||Object.values(parcel).some(value=>!Number(value))))} onClick={()=>void publish()}>{busy?copy('Saving…','Menyimpan…'):onAddToBundle?copy('Add to bundle','Tambahkan ke paket'):type==='WTS'?copy('Publish listing','Terbitkan listing'):copy('Post buying request','Buat permintaan beli')}</button></div>
    </>}
    {error&&<p role="alert" className="market-product-error">{error}</p>}
  </div>;
}
