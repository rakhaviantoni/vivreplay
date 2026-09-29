'use client';
import {useEffect, useState} from 'react';
import {toast} from 'sonner';
import {Picker} from './catalog';

const roleLabels: Record<string, {en: string; id: string}> = {
  front: {en: 'Front', id: 'Depan'},
  back: {en: 'Back', id: 'Belakang'},
  label: {en: 'Label', id: 'Label'},
  additional: {en: 'Additional', id: 'Tambahan'},
};

export function SlabPhotos({id,photos,owner}:{id:string;photos:{id:string;role:string}[];owner:boolean}){
  const [items,setItems]=useState(photos);
  const [role,setRole]=useState('front');
  const [busy,setBusy]=useState(false);
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');

  useEffect(()=>{
    const sync=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    sync();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);

  const t=(en:string,idStr:string)=>language==='ID'?idStr:en;

  return <section className="mt-8">
    <div className="section-title">
      <h2>{t('Slab photos','Foto slab')}</h2>
      <span>{items.length}/8 {t('photos','foto')}</span>
    </div>
    <div className="photo-grid">
      {items.map(p=><div key={p.id}>
        <img src={`/api/photos/${p.id}`} alt={`${roleLabels[p.role]?.[language==='ID'?'id':'en']??p.role} slab photo`} width="300" height="400"/>
        <p className="muted mt-2">{roleLabels[p.role]?.[language==='ID'?'id':'en']??p.role}</p>
      </div>)}
    </div>
    {owner&&<form className="form-stack mt-5" onSubmit={async e=>{
      e.preventDefault();
      setBusy(true);
      const f=new FormData(e.currentTarget);
      f.set('instanceId',id);
      f.set('role',role);
      try{
        const r=await fetch('/api/photos',{method:'POST',body:f});
        const result=await r.json() as {id:string;error?:string};
        if(!r.ok)throw new Error(result.error);
        setItems(prev=>[...prev,{id:result.id,role}]);
        toast.success(t('Photo added','Foto berhasil ditambahkan'));
      }catch(err){
        toast.error((err as Error).message);
      }finally{
        setBusy(false);
      }
    }}>
      <div className="form-row">
        <label>
          {t('Photo type','Tipe foto')}
          <Picker
            label={t('Photo type','Tipe foto')}
            value={role}
            onChange={setRole}
            options={[
              {value:'front',label:t('Front','Depan')},
              {value:'back',label:t('Back','Belakang')},
              {value:'label',label:t('Label','Label')},
              {value:'additional',label:t('Additional','Tambahan')},
            ]}
          />
        </label>
        <label>
          JPEG, PNG, WebP · Max 5 MB
          <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required/>
        </label>
      </div>
      <button className="button secondary" disabled={busy||items.length>=8}>
        {busy?t('Uploading...','Mengunggah...'):t('Upload slab photo','Unggah foto slab')}
      </button>
    </form>}
  </section>;
}
