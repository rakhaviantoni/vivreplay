'use client';

import {useState,type FormEvent} from 'react';
import {CheckCircleIcon as CheckCircle,HandshakeIcon as Handshake,MegaphoneIcon as Megaphone,ShieldCheckIcon as ShieldCheck,SparkleIcon as Sparkle,TruckIcon as Truck} from '@phosphor-icons/react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
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
  const [requestType,setRequestType]=useState<'BOTH'|'PARTNER_CONSIGN'|'SOCIAL_TESTER'>('BOTH');
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
          requestType,
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

        {!submitted&&requestType!=='SOCIAL_TESTER'&&(
          <div className="market-partner-benefits" aria-label={id?'Keuntungan partner':'Partner benefits'}>
            <div>
              <Sparkle size={16} weight="fill"/>
              <div>
                <strong>{id?'Etalase Partner Unggulan':'Featured Partner Storefront'}</strong>
                <span>{id?'Lencana partner terverifikasi dan eksposur prioritas di katalog Market.':'Verified partner badge and priority visibility across Market.'}</span>
              </div>
            </div>
            <div>
              <ShieldCheck size={16} weight="fill"/>
              <div>
                <strong>{id?'Rekber & Kurir Otomatis':'Escrow & Instant Shipping'}</strong>
                <span>{id?'Pembayaran QRIS/VA resmi dengan tarif dan resi kurir otomatis.':'Official QRIS/VA escrow with automated courier rates and waybills.'}</span>
              </div>
            </div>
            <div>
              <Megaphone size={16} weight="fill"/>
              <div>
                <strong>{id?'Auto-Post Sosial Media (Akses Awal / Tester)':'Social Auto-Post Access (Early-Access / Tester)'}</strong>
                <span>{id?'Publikasikan listing langsung ke Instagram, Facebook, dan Threads.':'Cross-post listings directly to Instagram, Facebook, and Threads.'}</span>
              </div>
            </div>
            <div>
              <Truck size={16} weight="fill"/>
              <div>
                <strong>{id?'Skema Komisi Fleksibel':'Flexible Consignment Tiers'}</strong>
                <span>{id?'Tarif khusus volume tinggi dan kuota listing tanpa batas untuk partner.':'Tailored commission rates and higher listing limits for active partners.'}</span>
              </div>
            </div>
          </div>
        )}
        {!submitted&&requestType==='SOCIAL_TESTER'&&(
          <div className="market-partner-benefits" aria-label={id?'Info akses awal sosial':'Social early-access notes'}>
            <div>
              <Megaphone size={16} weight="fill"/>
              <div>
                <strong>{id?'Akun Profesional IG / FB Page':'Professional IG / FB Page'}</strong>
                <span>{id?'Auto-post Instagram & Threads membutuhkan akun IG Profesional (Kreator/Bisnis) yang terhubung ke Facebook Page.':'Instagram & Threads auto-post requires an IG Professional (Creator/Business) account linked to a Facebook Page.'}</span>
              </div>
            </div>
            <div>
              <Sparkle size={16} weight="fill"/>
              <div>
                <strong>{id?'Belum Akun Bisnis? Tetap Bisa Daftar':'Personal Account? Still Welcome'}</strong>
                <span>{id?'Jika akun Anda masih Pribadi, kami akan kirim panduan singkat sebelum mengaktifkan akses awal Anda.':'If your account is still Personal, we will send a quick setup guide before enabling early access.'}</span>
              </div>
            </div>
          </div>
        )}

        {submitted?(
          <div className="market-partner-success">
            <CheckCircle size={32} weight="fill"/>
            <strong>{id?'Pengajuan diterima!':'Application received!'}</strong>
            <p>{id?'Tim VivrePlay akan menghubungi Anda melalui WhatsApp dalam 1–2 hari kerja untuk membahas skema partner atau konsinyasi.':'The VivrePlay team will reach out via WhatsApp within 1–2 business days to discuss your partner or consignment setup.'}</p>
            <button type="button" className="button" onClick={()=>onOpenChange(false)}>{id?'Tutup':'Close'}</button>
          </div>
        ):(
          <form className="market-partner-form" onSubmit={handleSubmit}>
            <div className="market-partner-field">
              <span>{id?'Program yang diminati':'Program interest'}</span>
              <Select value={requestType} onValueChange={v=>setRequestType(v as typeof requestType)}>
                <SelectTrigger className="market-product-select-trigger"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOTH">{id?'Partner & Konsinyasi + Akses Awal Auto-Post Sosial':'Partner & Consignment + Social Auto-Post Early Access'}</SelectItem>
                  <SelectItem value="PARTNER_CONSIGN">{id?'Partner & Konsinyasi saja':'Partner & Consignment only'}</SelectItem>
                  <SelectItem value="SOCIAL_TESTER">{id?'Akses Awal Auto-Post Sosial saja':'Social Auto-Post Early Access only'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="form-row">
              <label>
                <span>{requestType==='SOCIAL_TESTER'?(id?'Nama Anda atau toko (opsional)':'Your name or shop (optional)'):(id?'Nama toko atau akun':'Store or account name')}</span>
                <input value={shopName} onChange={e=>setShopName(e.target.value)} placeholder={id?'Contoh: Toko Hobi Nusantara':'e.g. Nusantara Hobby Shop'} minLength={requestType==='SOCIAL_TESTER'?0:2} maxLength={100} required={requestType!=='SOCIAL_TESTER'}/>
              </label>
              <label>
                <span>{id?'Akun Instagram / Sosial':'Instagram / Social handle'}</span>
                <input value={socialHandle} onChange={e=>setSocialHandle(e.target.value)} placeholder="@yourshop" minLength={2} maxLength={100} required/>
              </label>
            </div>
            {requestType!=='SOCIAL_TESTER'&&(
              <div className="form-row">
                <div className="market-partner-field">
                  <span>{id?'Kategori utama':'Primary category'}</span>
                  <Select value={category} onValueChange={v=>setCategory(v as typeof category)}>
                    <SelectTrigger className="market-product-select-trigger"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIGURES_COLLECTIBLES">{id?'Figur & Koleksi':'Figures & Collectibles'}</SelectItem>
                      <SelectItem value="TCG_SINGLES_SLABS">{id?'Kartu TCG & Slab':'TCG Singles & Slabs'}</SelectItem>
                      <SelectItem value="SEALED_PRODUCTS">{id?'Produk Sealed':'Sealed Products'}</SelectItem>
                      <SelectItem value="GAMING_TECH">{id?'Konsol & PC':'Gaming & Tech'}</SelectItem>
                      <SelectItem value="MULTI_CATEGORY">{id?'Multi-kategori':'Multi-category'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="market-partner-field">
                  <span>{id?'Perkiraan item per bulan':'Estimated monthly items'}</span>
                  <Select value={monthlyVolume} onValueChange={setMonthlyVolume}>
                    <SelectTrigger className="market-product-select-trigger"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10-30">{id?'10–30 item / bulan':'10–30 items / month'}</SelectItem>
                      <SelectItem value="30-100">{id?'30–100 item / bulan':'30–100 items / month'}</SelectItem>
                      <SelectItem value="100+">{id?'100+ item / bulan':'100+ items / month'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="form-row">
              {requestType!=='SOCIAL_TESTER'&&(
                <label>
                  <span>{id?'Kota':'City'}</span>
                  <input value={city} onChange={e=>setCity(e.target.value)} placeholder="Jakarta" minLength={2} maxLength={80} required/>
                </label>
              )}
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
