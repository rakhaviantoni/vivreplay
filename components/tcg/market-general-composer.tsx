'use client';
import {useEffect,useState} from 'react';
import {MagnifyingGlassIcon as Search,UploadSimpleIcon as UploadSimple,XIcon as X} from '@phosphor-icons/react';
import {useRouteLocale} from '@/components/locale-provider';
import {generalMarketCategories,generalMarketConditionLabel,generalMarketConditionOptions,type GeneralMarketCategory} from '@/lib/market/general-products';
import {useMarketListingLimits} from '@/lib/market/use-listing-limits';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import type {BundleProductInput} from './market-sealed-composer';

type Parcel={weight:string;length:string;width:string;height:string};
const emptyParcel=():Parcel=>({weight:'',length:'',width:'',height:''});

export function MarketGeneralComposer({type,onPublished,onBack,onAddToBundle,initialCategory,initialTitle}:{type:'WTS'|'WTB';onPublished:()=>void;onBack:()=>void;onAddToBundle?:(item:BundleProductInput)=>void;initialCategory?:GeneralMarketCategory;initialTitle?:string}){
  const language=useRouteLocale();const isId=language==='ID';const copy=(en:string,id:string)=>isId?id:en;
  const productStockLimit=useMarketListingLimits().maxProductStock??10;
  const [category,setCategory]=useState<GeneralMarketCategory>(initialCategory??'HOBBY');const [title,setTitle]=useState(initialTitle??'');const [brand,setBrand]=useState('');const [model,setModel]=useState('');const [fields,setFields]=useState<Record<string,string>>({});const [condition,setCondition]=useState<(typeof generalMarketConditionOptions)[number]>('NEW');const [quantity,setQuantity]=useState(1);const [price,setPrice]=useState('');const [notes,setNotes]=useState('');const [photos,setPhotos]=useState<string[]>([]);const [parcel,setParcel]=useState<Parcel>(emptyParcel());const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [presetQuery,setPresetQuery]=useState('');
  const [presets,setPresets]=useState<Array<{id:string;brand:string;model:string;attributes:Record<string,string>}>>([]);
  const config=generalMarketCategories[category];
  useEffect(()=>{if(initialCategory)setCategory(initialCategory);},[initialCategory]);
  useEffect(()=>{if(initialTitle)setTitle(initialTitle);},[initialTitle]);
  const changeCategory=(next:GeneralMarketCategory)=>{setCategory(next);setFields({});setPresetQuery('');setPresets([]);};

  useEffect(()=>{
    const q=presetQuery.trim();
    if(!q){setPresets([]);return;}
    const timer=window.setTimeout(()=>{
      void fetch(`/api/market/general-catalog?category=${encodeURIComponent(category)}&q=${encodeURIComponent(q)}`)
        .then(async res=>(await res.json()) as {presets?:typeof presets})
        .then(data=>setPresets(data.presets??[]))
        .catch(()=>setPresets([]));
    },180);
    return ()=>window.clearTimeout(timer);
  },[category,presetQuery]);

  const applyPreset=(preset:{brand:string;model:string;attributes:Record<string,string>})=>{
    setBrand(preset.brand);
    setModel(preset.model);
    if(!title.trim())setTitle(preset.model.startsWith(preset.brand)?preset.model:`${preset.brand} ${preset.model}`.slice(0,100));
    setFields(preset.attributes);
    setPresetQuery('');
    setPresets([]);
  };

  async function upload(files:FileList|null){
    if(!files?.length)return;const selected=Array.from(files).slice(0,6-photos.length);if(!selected.length)return;setBusy(true);setError('');
    try{const added:string[]=[];for(const file of selected){const form=new FormData();form.set('photo',file);const response=await fetch('/api/market/product-photos',{method:'POST',body:form});const data=await response.json() as {error?:string;id:string};if(!response.ok)throw new Error(data.error||copy('Photo upload failed.','Gagal mengunggah foto.'));added.push(data.id);}setPhotos(current=>[...current,...added]);}
    catch(caught){setError(caught instanceof Error?caught.message:copy('Photo upload failed.','Gagal mengunggah foto.'));}finally{setBusy(false);}
  }

  async function publish(){
    setBusy(true);setError('');
    try{
      if(onAddToBundle){
        onAddToBundle({productType:'GENERAL',title:title.trim(),quantity,unitAmount:Number(price),condition,notes,photoIds:photos,generalProduct:{category,brand:brand.trim(),model:model.trim(),attributes:fields},...(type==='WTS'?{parcel:{weight:Number(parcel.weight),length:Number(parcel.length),width:Number(parcel.width),height:Number(parcel.height)}}:{})});
        return;
      }
      const response=await fetch('/api/listings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productType:'GENERAL',type,title:title.trim(),category,brand:brand.trim(),model:model.trim(),attributes:fields,quantity,unitAmount:Number(price),condition,notes,photoIds:photos,...(type==='WTS'?{parcel:Object.fromEntries(Object.entries(parcel).map(([key,value])=>[key,Number(value)]))}:{})})});
      const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||copy('Could not publish the listing.','Listing tidak dapat diterbitkan.'));onPublished();
    }catch(caught){setError(caught instanceof Error?caught.message:copy('Could not publish the listing.','Listing tidak dapat diterbitkan.'));}finally{setBusy(false);}
  }

  const validTitle=title.trim().length>=3;const validPrice=Number(price)>0;const validParcel=Object.values(parcel).every(value=>Number(value)>0);
  return <div className="market-general-composer">
    <div className="market-general-intro"><div><strong>{category==='TCG_PRODUCT'?copy('List custom TCG product','Buat listing produk TCG kustom'):copy('List an item','Buat listing barang')}</strong><p>{category==='TCG_PRODUCT'?copy('For booster packs, boxes, sleeves, or regional editions not listed in the TCG catalog.','Untuk booster pack, box, sleeve, atau edisi regional yang belum ada di katalog TCG.'):copy('For hobby gear, electronics, games, and accessories outside the card catalog.','Untuk hobi, elektronik, game, dan aksesori di luar katalog kartu.')}</p></div><button type="button" onClick={onBack}>{copy('Browse TCG products','Lihat produk TCG')}</button></div>
    <fieldset className="market-general-categories"><legend>{copy('Category','Kategori')}</legend><div>{(Object.keys(generalMarketCategories) as GeneralMarketCategory[]).map(key=><button key={key} type="button" aria-pressed={category===key} onClick={()=>changeCategory(key)}>{isId?({TCG_PRODUCT:'Produk TCG',HOBBY:'Hobi & koleksi',COMPUTER:'Komputer & laptop',COMPUTER_PART:'Komponen PC',CONSOLE:'Konsol & handheld',PHYSICAL_GAME:'Game fisik',ACCESSORY:'Aksesori'} as Record<GeneralMarketCategory,string>)[key]:generalMarketCategories[key].label}</button>)}</div></fieldset>
    {category!=='TCG_PRODUCT'&&<div className="market-general-preset-box">
      <label className="market-product-search">
        <span>{copy('Quick-fill from catalog (optional)','Isi cepat dari katalog (opsional)')}</span>
        <div>
          <Search size={16} aria-hidden="true"/>
          <input
            value={presetQuery}
            onChange={event=>setPresetQuery(event.target.value)}
            placeholder={
              category==='HOBBY'?copy('Search Hot Wheels, Tomica, LEGO, Gundam, Pop Mart…','Cari Hot Wheels, Tomica, LEGO, Gundam, Pop Mart…'):
              category==='COMPUTER_PART'?copy('Search RTX 4070, Ryzen, DDR5, SSD…','Cari RTX 4070, Ryzen, DDR5, SSD…'):
              category==='CONSOLE'?copy('Search Switch OLED, PS5, Steam Deck…','Cari Switch OLED, PS5, Steam Deck…'):
              category==='PHYSICAL_GAME'?copy('Search Pokemon, Zelda, Monster Hunter…','Cari Pokemon, Zelda, Monster Hunter…'):
              category==='ACCESSORY'?copy('Search Dragon Shield, DualSense, Artisan…','Cari Dragon Shield, DualSense, Artisan…'):
              copy('Search MacBook, ROG, Legion…','Cari MacBook, ROG, Legion…')
            }
          />
          {presetQuery&&<button type="button" className="market-product-search-clear" onClick={()=>{setPresetQuery('');setPresets([]);}} aria-label={copy('Clear search','Hapus pencarian')}><X size={14}/></button>}
        </div>
      </label>
      {presets.length>0&&(
        <div className="market-general-preset-results" role="listbox" aria-label={copy('Catalog suggestions','Saran katalog')}>
          {presets.map(item=>(
            <button key={item.id} type="button" onClick={()=>applyPreset(item)}>
              <strong>{item.model.startsWith(item.brand)?item.model:`${item.brand} ${item.model}`}</strong>
              <small>{Object.values(item.attributes).filter(Boolean).slice(0,2).join(', ')}</small>
            </button>
          ))}
        </div>
      )}
    </div>}
    <div className="market-general-fields">
      <label className="is-full">{copy('Item name','Nama barang')}<input value={title} maxLength={100} onChange={event=>setTitle(event.target.value)} placeholder={category==='TCG_PRODUCT'?copy('e.g. Pokémon Scarlet & Violet Booster Box (ID)','mis. Pokémon Booster Box Indonesia'):copy('e.g. Nintendo Switch OLED','mis. Nintendo Switch OLED')}/></label>
      <label>{copy('Brand','Merek')}<input value={brand} maxLength={60} onChange={event=>setBrand(event.target.value)} placeholder={category==='TCG_PRODUCT'?copy('e.g. The Pokémon Company, Bandai','mis. The Pokémon Company, Bandai'):copy('Brand name','Nama merek')}/></label>
      {category!=='COMPUTER_PART'&&<label>{copy('Model','Model')}<input value={model} maxLength={80} onChange={event=>setModel(event.target.value)} placeholder={category==='TCG_PRODUCT'?copy('e.g. Booster Box, Sleeves, Deck Box','mis. Booster Box, Sleeves, Deck Box'):copy('Model or version','Model atau versi')}/></label>}
      {config.fields.map(field=><label key={field.key}>{isId?({game:'Game',edition:'Edisi / Bahasa',setCode:'Kode set atau produk',series:'Seri atau koleksi',processor:'Prosesor',graphics:'Grafis',memory:'Memori',storage:'Penyimpanan',partType:'Komponen',model:'Merek dan model',compatibility:'Kompatibilitas',platform:'Platform',region:'Wilayah',format:'Format',language:'Bahasa',compatibleWith:'Kompatibel dengan'} as Record<string,string>)[field.key]??field.label:field.label}<input value={fields[field.key]??''} maxLength={100} onChange={event=>setFields(current=>({...current,[field.key]:event.target.value}))} placeholder={field.placeholder}/></label>)}
      <label>{type==='WTS'?copy('Quantity available','Jumlah tersedia'):copy('Quantity wanted','Jumlah yang dicari')}<input type="number" min={1} max={productStockLimit} value={quantity} onChange={event=>setQuantity(Math.min(productStockLimit,Math.max(1,Number(event.target.value)||1)))}/><small>{copy(`Up to ${productStockLimit} units per listing`,`Maksimal ${productStockLimit} unit per listing`)}</small></label>
      <label>{type==='WTS'?copy('Price per item (IDR)','Harga per barang (IDR)'):copy('Offer per item (IDR)','Tawaran per barang (IDR)')}<input type="number" min={1} value={price} onChange={event=>setPrice(event.target.value)}/></label>
      <fieldset className="market-general-condition-field"><legend>{type==='WTB'?copy('Condition wanted','Kondisi yang dicari'):copy('Condition','Kondisi')}</legend><RadioGroup value={condition} onValueChange={value=>setCondition(value as typeof condition)} className="market-general-condition-options" aria-label={type==='WTB'?copy('Condition wanted','Kondisi yang dicari'):copy('Condition','Kondisi')}>
        {generalMarketConditionOptions.map(value=><label key={value} htmlFor={`general-condition-${value}`} className={condition===value?'is-selected':''}><RadioGroupItem id={`general-condition-${value}`} value={value}/><span className="market-product-radio-mark" aria-hidden="true"/><span>{generalMarketConditionLabel(value,language)}</span></label>)}
      </RadioGroup></fieldset>
    </div>
    <label className="market-general-notes">{copy('Details','Detail')}<textarea maxLength={1000} value={notes} onChange={event=>setNotes(event.target.value)} placeholder={type==='WTB'?copy('Describe the version, condition, or features you want.','Jelaskan versi, kondisi, atau fitur yang dicari.'):copy('Describe its condition, included parts, and any defects.','Jelaskan kondisi, kelengkapan, dan kerusakan jika ada.')}/></label>
    {type==='WTS'&&<>
      <fieldset className="market-product-parcel"><legend>{copy('Packed size','Ukuran paket')}</legend><p>{copy('Enter the parcel measurements after packaging the item.','Masukkan ukuran paket setelah barang dikemas.')}</p><div className="market-general-fields market-general-parcel">{Object.entries(parcel).map(([key,value])=><label key={key}>{({weight:copy('Weight (g)','Berat (g)'),length:copy('Length (cm)','Panjang (cm)'),width:copy('Width (cm)','Lebar (cm)'),height:copy('Height (cm)','Tinggi (cm)')} as Record<string,string>)[key]??key}<input type="number" min={1} value={value} onChange={event=>setParcel(current=>({...current,[key]:event.target.value}))}/></label>)}</div></fieldset>
      <div className="market-product-photo-section">
        <div className="market-product-photo-header">
          <strong>{copy('Photos','Foto')}</strong>
          <span>{photos.length} / 6</span>
        </div>
        <label className={`market-product-photo-upload${photos.length>=6?' is-full':''}`}>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||photos.length>=6} onChange={event=>{void upload(event.target.files);event.target.value='';}}/>
          <UploadSimple size={18} aria-hidden="true"/>
          <span>{busy?copy('Uploading photos…','Mengunggah foto…'):photos.length>=6?copy('Maximum 6 photos reached','Maksimal 6 foto tercapai'):copy('Select up to 6 photos (multi-select supported)','Pilih hingga 6 foto (mendukung multi-pilih)')}</span>
          <small>{copy('Show the item from several angles, including any wear or damage.','Tampilkan barang dari beberapa sisi, termasuk tanda pemakaian atau kerusakan.')}</small>
        </label>
        {photos.length>0&&<div className="market-sealed-photos">{photos.map(photo=><div key={photo} className="market-product-photo-card"><img src={`/api/market/product-photos/${photo}`} alt={copy('Item photo','Foto barang')}/><button type="button" className="market-product-photo-remove" onClick={()=>setPhotos(current=>current.filter(id=>id!==photo))} aria-label={copy('Remove photo','Hapus foto')} title={copy('Remove photo','Hapus foto')}><X size={13}/></button></div>)}</div>}
      </div>
    </>}
    {error&&<p role="alert" className="market-product-error">{error}</p>}
    <div className="market-product-publish-row"><span>{copy('Total','Total')}<strong>IDR {(quantity*Number(price||0)).toLocaleString(isId?'id-ID':'en-US')}</strong></span><button type="button" className="button" disabled={busy||!validTitle||!validPrice||quantity<1||quantity>productStockLimit||(type==='WTS'&&(!photos.length||!validParcel))} onClick={()=>void publish()}>{busy?copy('Saving…','Menyimpan…'):onAddToBundle?copy('Add to bundle','Tambahkan ke paket'):type==='WTS'?copy('Publish listing','Terbitkan listing'):copy('Post buying request','Buat permintaan beli')}</button></div>
  </div>;
}
