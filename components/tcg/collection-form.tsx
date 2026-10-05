'use client';
import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Picker} from './catalog';
import {api} from '@/lib/client';
import type {Card} from '@/packages/card-data/catalog';

type Locale='EN'|'ID';
export function CollectionForm({printingId,open,onClose,name,onSaved,catalogCard,submitLabel,language}:{printingId:string;open:boolean;onClose:()=>void;name:string;onSaved?:()=>void|Promise<void>;catalogCard?:Card;submitLabel?:string;language?:Locale}){
  const [type,setType]=useState('RAW');
  const [condition,setCondition]=useState('NM');
  const [currency,setCurrency]=useState('IDR');
  const [visibility,setVisibility]=useState('private');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [activeLanguage,setActiveLanguage]=useState<Locale>(language??'EN');
  useEffect(()=>{
    if(language){setActiveLanguage(language);return;}
    const sync=()=>setActiveLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setActiveLanguage((event as CustomEvent<Locale>).detail==='ID'?'ID':'EN');
    sync();window.addEventListener('vivreplay:locale',onLocale);return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[language]);
  const id=activeLanguage==='ID';
  const resolvedSubmitLabel=submitLabel??(id?'Simpan ke koleksi':'Add to Vault');
  const copy=id?{
    eyebrow:'KOLEKSI',title:'Tambahkan ke koleksi',description:`${name} · Setiap cetakan dicatat secara terpisah.`,raw:'Kartu tanpa grading',graded:'Slab grading',quantity:'Jumlah',condition:'Kondisi',company:'Perusahaan grading',companyPlaceholder:'PSA, CGC, BGS, atau lainnya',grade:'Nilai grading',certification:'Nomor sertifikasi',notice:'Sertifikasi diisi pengguna dan belum diverifikasi.',cost:'Harga perolehan (opsional)',currency:'Mata uang',visibility:'Visibilitas koleksi',private:'Pribadi',public:'Publik',privacy:'Harga perolehan tetap pribadi, termasuk untuk kartu publik.',saving:'Menyimpan…',saveError:'Tidak dapat menyimpan.'
  }:{
    eyebrow:'COLLECTION',title:'Add to your Vault',description:`${name} · Each printing is tracked independently.`,raw:'Raw card',graded:'Graded slab',quantity:'Quantity',condition:'Condition',company:'Grading company',companyPlaceholder:'PSA, CGC, BGS, or another',grade:'Grade',certification:'Certification number',notice:'User-entered certification · Unverified. This does not imply provider verification.',cost:'Acquisition cost (optional)',currency:'Currency',visibility:'Collection visibility',private:'Private',public:'Public',privacy:'Acquisition costs stay private, even for public items.',saving:'Saving…',saveError:'Unable to save.'
  };
  return <Dialog open={open} onOpenChange={v=>{if(!v)onClose()}}><DialogContent className="vault-dialog"><div className="vault-dialog-heading"><span>{copy.eyebrow}</span><DialogTitle>{copy.title}</DialogTitle></div><DialogDescription>{copy.description}</DialogDescription><form className="form-stack" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const f=new FormData(e.currentTarget);try{await api('/api/collection',{printingId,catalogCard,type,quantity:type==='GRADED'?1:Number(f.get('quantity')),condition,provider:type==='GRADED'?String(f.get('provider')):null,grade:type==='GRADED'?String(f.get('grade')):null,certification:type==='GRADED'?String(f.get('certification')):null,visibility,acquisitionAmount:Math.round(Number(f.get('amount')||0)*(currency==='USD'?100:1)),currency});toast.success(id?'Ditambahkan ke koleksi':'Added to your Vault');await onSaved?.();onClose()}catch(err){setError(err instanceof Error?err.message:copy.saveError)}finally{setBusy(false)}}}><Tabs value={type} onValueChange={setType}><TabsList className="w-full"><TabsTrigger value="RAW">{copy.raw}</TabsTrigger><TabsTrigger value="GRADED">{copy.graded}</TabsTrigger></TabsList></Tabs>{type==='RAW'?<div className="form-row"><label>{copy.quantity}<input name="quantity" type="number" defaultValue="1" min="1" max="999" required/></label><label>{copy.condition}<Picker label={copy.condition} value={condition} onChange={setCondition} options={['NM','LP','MP','HP','DMG']}/></label></div>:<><div className="form-row"><label>{copy.company}<input name="provider" placeholder={copy.companyPlaceholder} maxLength={40} required/></label><label>{copy.grade}<input name="grade" placeholder="10" maxLength={20} required/></label></div><label>{copy.certification}<input name="certification" required maxLength={100}/></label><p className="notice">{copy.notice}</p></>}<div className="form-row"><label>{copy.cost}<input name="amount" type="number" min="0" step={currency==='USD'?'.01':'1'} placeholder="0"/></label><label>{copy.currency}<Picker label={copy.currency} value={currency} onChange={setCurrency} options={['IDR','USD','JPY']}/></label></div><label>{copy.visibility}<Picker label={copy.visibility} value={visibility} onChange={setVisibility} options={id?[{value:'private',label:copy.private},{value:'public',label:copy.public}]:['private','public']}/></label><p className="muted">{copy.privacy}</p>{error&&<p role="alert" className="error-text">{error}</p>}<button disabled={busy} className="button">{busy?copy.saving:resolvedSubmitLabel}</button></form></DialogContent></Dialog>;
}
