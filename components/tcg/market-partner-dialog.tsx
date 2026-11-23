'use client';

import {useState,type FormEvent} from 'react';
import {CheckCircleIcon as CheckCircle,HandshakeIcon as Handshake} from '@phosphor-icons/react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {toast} from 'sonner';

export function MarketPartnerDialog({
  open,
  onOpenChange,
  locale,
}:{
  open:boolean;
  onOpenChange:(open:boolean)=>void;
  locale:'EN'|'ID';
}){
  const id=locale==='ID';
  const [shopName,setShopName]=useState('');
  const [socialHandle,setSocialHandle]=useState('');
  const [category,setCategory]=useState<'TCG_SINGLES_SLABS'|'SEALED_PRODUCTS'|'FIGURES_COLLECTIBLES'|'GAMING_TECH'|'MULTI_CATEGORY'>('FIGURES_COLLECTIBLES');
  const [city,setCity]=useState('');
  const [monthlyVolume,setMonthlyVolume]=useState('10-30');
  const [contactWhatsapp,setContactWhatsapp]=useState('');
  const [notes,setNotes]=useState('');
  const [busy,setBusy]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [error,setError]=useState('');

  async function handleSubmit(event:FormEvent){
    event.preventDefault();
    setBusy(true);
    setError('');
    try{
      const response=await fetch('/api/market/partner-request',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          shopName,
          socialHandle,
          category,
          city,
          monthlyVolume,
          contactWhatsapp,
          notes,
        }),
      });
      const payload=await response.json() as {error?:string};
      if(!response.ok)throw new Error(payload.error||(id?'Permintaan tidak dapat dikirim.':'Could not submit request.'));
      setSubmitted(true);
      toast.success(id?'Pengajuan partner & konsinyasi terkirim':'Partner & consignment request sent');
    }catch(cause){
      setError(cause instanceof Error?cause.message:(id?'Terjadi kesalahan.':'Something went wrong.'));
    }finally{
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={next=>{if(!next){setSubmitted(false);setError('');}onOpenChange(next);}}>
      <DialogContent className="market-partner-dialog">
        <DialogHeader>
          <DialogTitle>{id?'Partner & Konsinyasi bersama VivrePlay':'Partner & Consign with VivrePlay'}</DialogTitle>
          <DialogDescription>
            {id
              ?'Untuk akun konsinyasi, toko hobi, dan kurator figur/TCG yang ingin membuka kanal unggulan dan pembayaran rekber resmi.'
              :'For consignment accounts, hobby shops, and figure/TCG curators looking for a featured storefront and escrow checkout.'}
          </DialogDescription>
        </DialogHeader>

        {submitted?(
          <div className="market-partner-success">
            <CheckCircle size={32} weight="fill"/>
            <strong>{id?'Pengajuan diterima!':'Application received!'}</strong>
            <p>{id?'Tim VivrePlay akan menghubungi Anda melalui WhatsApp dalam 1–2 hari kerja untuk membahas skema partner atau konsinyasi.':'The VivrePlay team will reach out via WhatsApp within 1–2 business days to discuss your partner or consignment setup.'}</p>
            <button type="button" className="button" onClick={()=>onOpenChange(false)}>{id?'Tutup':'Close'}</button>
          </div>
        ):(
          <form className="market-partner-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                <span>{id?'Nama toko atau akun':'Store or account name'}</span>
                <input value={shopName} onChange={e=>setShopName(e.target.value)} placeholder={id?'Contoh: Toko Hobi Nusantara':'e.g. Nusantara Hobby Shop'} minLength={2} maxLength={100} required/>
              </label>
              <label>
                <span>{id?'Akun Instagram / Sosial':'Instagram / Social handle'}</span>
                <input value={socialHandle} onChange={e=>setSocialHandle(e.target.value)} placeholder="@yourshop" minLength={2} maxLength={100} required/>
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>{id?'Kategori utama':'Primary category'}</span>
                <select value={category} onChange={e=>setCategory(e.target.value as typeof category)}>
                  <option value="FIGURES_COLLECTIBLES">{id?'Figur & Koleksi':'Figures & Collectibles'}</option>
                  <option value="TCG_SINGLES_SLABS">{id?'Kartu TCG & Slab':'TCG Singles & Slabs'}</option>
                  <option value="SEALED_PRODUCTS">{id?'Produk Sealed':'Sealed Products'}</option>
                  <option value="GAMING_TECH">{id?'Konsol & PC':'Gaming & Tech'}</option>
                  <option value="MULTI_CATEGORY">{id?'Multi-kategori':'Multi-category'}</option>
                </select>
              </label>
              <label>
                <span>{id?'Perkiraan item per bulan':'Estimated monthly items'}</span>
                <select value={monthlyVolume} onChange={e=>setMonthlyVolume(e.target.value)}>
                  <option value="10-30">{id?'10–30 item / bulan':'10–30 items / month'}</option>
                  <option value="30-100">{id?'30–100 item / bulan':'30–100 items / month'}</option>
                  <option value="100+">{id?'100+ item / bulan':'100+ items / month'}</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>{id?'Kota':'City'}</span>
                <input value={city} onChange={e=>setCity(e.target.value)} placeholder="Jakarta" minLength={2} maxLength={80} required/>
              </label>
              <label>
                <span>{id?'Nomor WhatsApp aktif':'Active WhatsApp number'}</span>
                <input value={contactWhatsapp} onChange={e=>setContactWhatsapp(e.target.value)} placeholder="0812xxxxxxxx" minLength={8} maxLength={30} required/>
              </label>
            </div>
            <label>
              <span>{id?'Catatan tambahan (opsional)':'Additional notes (optional)'}</span>
              <textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={id?'Ceritakan jenis stok atau kebutuhan integrasi Anda':'Tell us about your inventory or consignment needs'} maxLength={1000}/>
            </label>
            {error&&<p className="error-text" role="alert">{error}</p>}
            <div className="market-partner-actions">
              <button type="button" className="button secondary" disabled={busy} onClick={()=>onOpenChange(false)}>{id?'Batal':'Cancel'}</button>
              <button type="submit" className="button" disabled={busy}>
                <Handshake size={16}/>
                <span>{busy?(id?'Mengirim...':'Sending...'):(id?'Kirim pengajuan':'Submit application')}</span>
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
