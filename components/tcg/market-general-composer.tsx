'use client';
import {useState} from 'react';
import {useRouteLocale} from '@/components/locale-provider';
import {generalMarketCategories,generalMarketConditionLabel,generalMarketConditionOptions,type GeneralMarketCategory} from '@/lib/market/general-products';
import {useMarketListingLimits} from '@/lib/market/use-listing-limits';
import type {BundleProductInput} from './market-sealed-composer';

type Parcel={weight:string;length:string;width:string;height:string};
const emptyParcel=():Parcel=>({weight:'',length:'',width:'',height:''});

export function MarketGeneralComposer({type,onPublished,onBack,onAddToBundle}:{type:'WTS'|'WTB';onPublished:()=>void;onBack:()=>void;onAddToBundle?:(item:BundleProductInput)=>void}){
  const language=useRouteLocale();const isId=language==='ID';const copy=(en:string,id:string)=>isId?id:en;
  const productStockLimit=useMarketListingLimits().maxProductStock??10;
  const [category,setCategory]=useState<GeneralMarketCategory>('HOBBY');const [title,setTitle]=useState('');const [brand,setBrand]=useState('');const [model,setModel]=useState('');const [fields,setFields]=useState<Record<string,string>>({});const [condition,setCondition]=useState<(typeof generalMarketConditionOptions)[number]>('NEW');const [quantity,setQuantity]=useState(1);const [price,setPrice]=useState('');const [notes,setNotes]=useState('');const [photos,setPhotos]=useState<string[]>([]);const [parcel,setParcel]=useState<Parcel>(emptyParcel());const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const config=generalMarketCategories[category];
  const changeCategory=(next:GeneralMarketCategory)=>{setCategory(next);setFields({});};

  async function upload(files:FileList|null){
    if(!files?.length)return;const selected=Array.from(files).slice(0,6-photos.length);if(!selected.length)return;setBusy(true);setError('');
    try{const added:string[]=[];for(const file of selected){const form=new FormData();form.set('photo',file);const response=await fetch('/api/market/product-photos',{method:'POST',body:form});const data=await response.json() as {error?:string;id:string};if(!response.ok)throw new Error(data.error||'Photo upload failed.');added.push(data.id);}setPhotos(current=>[...current,...added]);}
    catch(caught){setError(caught instanceof Error?caught.message:'Photo upload failed.');}finally{setBusy(false);}
  }

  async function publish(){
    setBusy(true);setError('');
    try{
      if(onAddToBundle){
        onAddToBundle({productType:'GENERAL',title:title.trim(),quantity,unitAmount:Number(price),condition,notes,photoIds:photos,generalProduct:{category,brand:brand.trim(),model:model.trim(),attributes:fields},...(type==='WTS'?{parcel:{weight:Number(parcel.weight),length:Number(parcel.length),width:Number(parcel.width),height:Number(parcel.height)}}:{})});
        return;
      }
      const response=await fetch('/api/listings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productType:'GENERAL',type,title:title.trim(),category,brand:brand.trim(),model:model.trim(),attributes:fields,quantity,unitAmount:Number(price),condition,notes,photoIds:photos,...(type==='WTS'?{parcel:Object.fromEntries(Object.entries(parcel).map(([key,value])=>[key,Number(value)]))}:{})})});
      const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||'Could not publish the listing.');onPublished();
    }catch(caught){setError(caught instanceof Error?caught.message:'Could not publish the listing.');}finally{setBusy(false);}
  }

  const validTitle=title.trim().length>=3;const validPrice=Number(price)>0;const validParcel=Object.values(parcel).every(value=>Number(value)>0);
  return <div className="market-general-composer">
    <div className="market-general-intro"><div><strong>{copy('List an item','Buat listing barang')}</strong><p>{copy('For hobby gear, electronics, games, and accessories outside the card catalog.','Untuk hobi, elektronik, game, dan aksesori di luar katalog kartu.')}</p></div><button type="button" onClick={onBack}>{copy('Browse TCG products','Lihat produk TCG')}</button></div>
    <fieldset className="market-general-categories"><legend>{copy('Category','Kategori')}</legend><div>{(Object.keys(generalMarketCategories) as GeneralMarketCategory[]).map(key=><button key={key} type="button" aria-pressed={category===key} onClick={()=>changeCategory(key)}>{isId?({HOBBY:'Hobi & koleksi',COMPUTER:'Komputer & laptop',COMPUTER_PART:'Komponen PC',CONSOLE:'Konsol & handheld',PHYSICAL_GAME:'Game fisik',ACCESSORY:'Aksesori'} as Record<GeneralMarketCategory,string>)[key]:generalMarketCategories[key].label}</button>)}</div></fieldset>
    <div className="market-general-fields">
      <label>{copy('Item name','Nama barang')}<input value={title} maxLength={100} onChange={event=>setTitle(event.target.value)} placeholder={copy('e.g. Nintendo Switch OLED','mis. Nintendo Switch OLED')}/></label>
      <label>{copy('Brand','Merek')}<input value={brand} maxLength={60} onChange={event=>setBrand(event.target.value)} placeholder={copy('Brand name','Nama merek')}/></label>
      {category!=='COMPUTER_PART'&&<label>{copy('Model','Model')}<input value={model} maxLength={80} onChange={event=>setModel(event.target.value)} placeholder={copy('Model or version','Model atau versi')}/></label>}
      {config.fields.map(field=><label key={field.key}>{isId?({series:'Seri atau koleksi',processor:'Prosesor',graphics:'Grafis',memory:'Memori',storage:'Penyimpanan',partType:'Komponen',model:'Merek dan model',compatibility:'Kompatibilitas',platform:'Platform',region:'Wilayah',format:'Format',language:'Bahasa',compatibleWith:'Kompatibel dengan'} as Record<string,string>)[field.key]??field.label:field.label}<input value={fields[field.key]??''} maxLength={100} onChange={event=>setFields(current=>({...current,[field.key]:event.target.value}))} placeholder={field.placeholder}/></label>)}
      <label>{type==='WTS'?copy('Quantity available','Jumlah tersedia'):copy('Quantity wanted','Jumlah yang dicari')}<input type="number" min={1} max={productStockLimit} value={quantity} onChange={event=>setQuantity(Math.min(productStockLimit,Math.max(1,Number(event.target.value)||1)))}/><small>{copy(`Up to ${productStockLimit} units per listing`,`Maksimal ${productStockLimit} unit per listing`)}</small></label>
      <label>{type==='WTS'?copy('Price per item (IDR)','Harga per barang (IDR)'):copy('Offer per item (IDR)','Tawaran per barang (IDR)')}<input type="number" min={1} value={price} onChange={event=>setPrice(event.target.value)}/></label>
      <label>{type==='WTB'?copy('Condition wanted','Kondisi yang dicari'):copy('Condition','Kondisi')}<select value={condition} onChange={event=>setCondition(event.target.value as typeof condition)}>{generalMarketConditionOptions.map(value=><option key={value} value={value}>{generalMarketConditionLabel(value,language)}</option>)}</select></label>
    </div>
    <label className="market-general-notes">{copy('Details','Detail')}<textarea maxLength={1000} value={notes} onChange={event=>setNotes(event.target.value)} placeholder={type==='WTB'?copy('Describe the version, condition, or features you want.','Jelaskan versi, kondisi, atau fitur yang dicari.'):copy('Describe its condition, included parts, and any defects.','Jelaskan kondisi, kelengkapan, dan kerusakan jika ada.')}/></label>
    {type==='WTS'&&<>
      <fieldset className="market-product-parcel"><legend>{copy('Packed size','Ukuran paket')}</legend><p>{copy('Enter the parcel measurements after packaging the item.','Masukkan ukuran paket setelah barang dikemas.')}</p><div className="market-general-fields market-general-parcel">{Object.entries(parcel).map(([key,value])=><label key={key}>{key==='weight'?copy('Weight (g)','Berat (g)'):`${key.charAt(0).toUpperCase()+key.slice(1)} (cm)`}<input type="number" min={1} value={value} onChange={event=>setParcel(current=>({...current,[key]:event.target.value}))}/></label>)}</div></fieldset>
      <label className="market-product-photo-upload">{copy('Photos','Foto')}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||photos.length>=6} onChange={event=>{void upload(event.target.files);event.target.value='';}}/><small>{copy('Show the item from several angles, including any wear or damage.','Tampilkan barang dari beberapa sisi, termasuk tanda pemakaian atau kerusakan.')}</small></label>
      <div className="market-sealed-photos">{photos.map(photo=><div key={photo}><img src={`/api/market/product-photos/${photo}`} alt={copy('Item photo','Foto barang')}/><button type="button" onClick={()=>setPhotos(current=>current.filter(id=>id!==photo))}>{copy('Remove','Hapus')}</button></div>)}</div>
    </>}
    {error&&<p role="alert" className="market-product-error">{error}</p>}
    <div className="market-product-publish-row"><span>{copy('Total','Total')}<strong>IDR {(quantity*Number(price||0)).toLocaleString('en-US')}</strong></span><button type="button" className="button" disabled={busy||!validTitle||!validPrice||quantity<1||quantity>productStockLimit||(type==='WTS'&&(!photos.length||!validParcel))} onClick={()=>void publish()}>{busy?copy('Saving…','Menyimpan…'):onAddToBundle?copy('Add to bundle','Tambahkan ke paket'):type==='WTS'?copy('Publish listing','Terbitkan listing'):copy('Post buying request','Buat permintaan beli')}</button></div>
  </div>;
}
