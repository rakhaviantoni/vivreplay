'use client';

import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import Link from '@/components/ui/localized-link';
import {ClockIcon as Clock,GavelIcon as Gavel,CheckCircleIcon as CheckCircle,PencilSimpleIcon as Pencil,SealCheckIcon as SealCheck} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {formatMoney} from '@/packages/domain';
import {
  computeMinimumNextBid,
  formatAuctionDurationLabel,
  type AuctionBidRecord,
  type AuctionSummary,
  type AuctionWatcher,
} from '@/lib/market/auction';
import {IdrInput} from '@/components/ui/idr-input';

function formatRelativeTimeAgo(diffMs:number,locale:'EN'|'ID'){
  const sec=Math.max(0,Math.floor(diffMs/1000));
  if(sec<60)return locale==='ID'?`${sec}d lalu`:`${sec}s ago`;
  const min=Math.floor(sec/60);
  if(min<60)return locale==='ID'?`${min}m lalu`:`${min}m ago`;
  const hr=Math.floor(min/60);
  if(hr<24)return locale==='ID'?`${hr}j lalu`:`${hr}h ago`;
  const days=Math.floor(hr/24);
  return locale==='ID'?`${days}h lalu`:`${days}d ago`;
}

function formatBidTimestamp(raw:string,locale:'EN'|'ID',nowMs:number){
  const normalized=/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)?raw:`${raw.replace(' ','T')}Z`;
  const date=new Date(normalized);
  if(Number.isNaN(date.getTime()))return{label:raw,title:raw,iso:raw};
  const intlLocale=locale==='ID'?'id-ID':'en-US';
  const datePart=new Intl.DateTimeFormat(intlLocale,{day:'numeric',month:'short'}).format(date);
  const timePart=new Intl.DateTimeFormat(intlLocale,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date);
  const ago=formatRelativeTimeAgo(nowMs-date.getTime(),locale);
  const label=`${datePart} ${timePart} (${ago})`;
  const title=new Intl.DateTimeFormat(intlLocale,{dateStyle:'medium',timeStyle:'medium',hour12:false}).format(date);
  return{label,title,iso:date.toISOString()};
}

function formatCountdown(remainingMs:number,locale:'EN'|'ID'){
  if(remainingMs<=0)return locale==='ID'?'Berakhir':'Ended';
  const totalSec=Math.floor(remainingMs/1000);
  const days=Math.floor(totalSec/86400);
  const hours=Math.floor((totalSec%86400)/3600);
  const mins=Math.floor((totalSec%3600)/60);
  const secs=totalSec%60;
  const pad=(n:number)=>String(n).padStart(2,'0');
  if(days>0)return `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

export function MarketAuctionPanel({
  listingId,
  itemKey = '__LOT__',
  itemTitle,
  initialAuction,
  initialBids,
  initialWatchers = [],
  currency,
  isOwner,
  currentUserId,
  locale,
  enableStickyFooter = true,
  onCheckoutWinner,
}:{
  listingId:string;
  itemKey?:string;
  itemTitle?:string;
  initialAuction:AuctionSummary;
  initialBids:AuctionBidRecord[];
  initialWatchers?:AuctionWatcher[];
  currency:string;
  isOwner:boolean;
  currentUserId?:string|null;
  locale:'EN'|'ID';
  enableStickyFooter?:boolean;
  onCheckoutWinner?:(winningAmount:number)=>void;
}){
  const [auction,setAuction]=useState<AuctionSummary>(initialAuction);
  const [bids,setBids]=useState<AuctionBidRecord[]>(initialBids);
  const [watchers,setWatchers]=useState<AuctionWatcher[]>(initialWatchers);

  useEffect(()=>{
    const onSavedChanged=(event:Event)=>{
      const detail=(event as CustomEvent<{listingId?:string;saved?:boolean}>).detail;
      if(!currentUserId||detail?.listingId!==listingId||typeof detail.saved!=='boolean')return;
      if(detail.saved){
        setWatchers(prev=>prev.some(w=>w.userId===currentUserId)?prev:[{userId:currentUserId,name:locale==='ID'?'Anda':'You',username:null,verified:false,createdAt:new Date().toISOString()},...prev]);
      }else{
        setWatchers(prev=>prev.filter(w=>w.userId!==currentUserId));
      }
    };
    window.addEventListener('vivreplay:saved-changed',onSavedChanged);
    return()=>window.removeEventListener('vivreplay:saved-changed',onSavedChanged);
  },[currentUserId,listingId,locale]);
  const prevAuctionRef=useRef<AuctionSummary>(initialAuction);
  const [nowMs,setNowMs]=useState(()=>Date.now());
  const [submitting,setSubmitting]=useState(false);
  const [buyingOut,setBuyingOut]=useState(false);
  const [error,setError]=useState('');
  const [panelVisible,setPanelVisible]=useState(true);
  const [editingSettings,setEditingSettings]=useState(false);
  const [savingSettings,setSavingSettings]=useState(false);
  const [editStartingBid,setEditStartingBid]=useState(()=>String(initialAuction.startingBid));
  const [editBuyNow,setEditBuyNow]=useState(()=>initialAuction.buyNowPrice?String(initialAuction.buyNowPrice):'');
  const [editIncrement,setEditIncrement]=useState(()=>String(initialAuction.minIncrement));
  const [editDurationMode,setEditDurationMode]=useState(initialAuction.durationMode);
  const [editStartMode,setEditStartMode]=useState<'immediate'|'scheduled'>(()=>initialAuction.startsAt&&Date.parse(initialAuction.startsAt)>Date.now()?'scheduled':'immediate');
  const [editStartsAt,setEditStartsAt]=useState(()=>{
    const target=initialAuction.startsAt?new Date(initialAuction.startsAt):new Date(Date.now()+60*60*1000);
    const pad=(n:number)=>String(n).padStart(2,'0');
    return `${target.getFullYear()}-${pad(target.getMonth()+1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
  });
  const [editError,setEditError]=useState('');
  const panelRef=useRef<HTMLElement>(null);

  const minNextBid=useMemo(()=>computeMinimumNextBid({
    startingBid:auction.startingBid,
    currentBid:auction.currentBid,
    minIncrement:auction.minIncrement,
    bidCount:auction.bidCount,
  }),[auction.startingBid,auction.currentBid,auction.minIncrement,auction.bidCount]);

  const [bidInput,setBidInput]=useState(()=>String(minNextBid));

  useEffect(()=>{
    setBidInput(current=>{
      const parsed=Number(current);
      if(!Number.isFinite(parsed)||parsed<minNextBid)return String(minNextBid);
      return current;
    });
  },[minNextBid]);

  useEffect(()=>{
    const interval=window.setInterval(()=>setNowMs(Date.now()),1000);
    return()=>window.clearInterval(interval);
  },[]);

  useEffect(()=>{
    const prev=prevAuctionRef.current;
    if(auction.currentBid>prev.currentBid&&auction.highestBidderId&&auction.highestBidderId!==currentUserId){
      if(currentUserId&&prev.highestBidderId===currentUserId){
        toast.warning(locale==='ID'?`Bid Anda terlampaui! Bid saat ini ${formatMoney(auction.currentBid,currency)}`:`You were outbid! Current bid is ${formatMoney(auction.currentBid,currency)}`);
      }else{
        toast.info(locale==='ID'?`Bid baru ${formatMoney(auction.currentBid,currency)} oleh ${auction.highestBidderName||'Kolektor'}`:`New bid ${formatMoney(auction.currentBid,currency)} by ${auction.highestBidderName||'Collector'}`);
      }
    }
    if(prev.status==='ACTIVE'&&auction.status==='ENDED'){
      if(currentUserId&&auction.highestBidderId===currentUserId){
        toast.success(locale==='ID'?'Selamat! Anda memenangkan lelang ini!':'Congratulations! You won this auction!');
      }else if(isOwner){
        toast.info(locale==='ID'?'Lelang Anda telah berakhir.':'Your auction has ended.');
      }
    }
    prevAuctionRef.current=auction;
  },[auction,currentUserId,currency,isOwner,locale]);

  useEffect(()=>{
    const node=panelRef.current;
    if(!node||typeof IntersectionObserver==='undefined')return;
    const observer=new IntersectionObserver(([entry])=>{
      setPanelVisible(entry.isIntersecting);
    },{threshold:0.15});
    observer.observe(node);
    return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    let closed=false;
    let ws:WebSocket|null=null;
    let wsOpen=false;
    let reconnectTimer:number|undefined;

    const refreshState=async()=>{
      if(closed)return;
      try{
        const res=await fetch(`/api/auctions/${encodeURIComponent(listingId)}?itemKey=${encodeURIComponent(itemKey)}`,{cache:'no-store'});
        if(!res.ok)return;
        const payload=await res.json() as {auction?:AuctionSummary;bids?:AuctionBidRecord[]};
        if(closed)return;
        if(payload.auction)setAuction(payload.auction);
        if(Array.isArray(payload.bids))setBids(payload.bids);
      }catch{}
    };

    const connect=()=>{
      if(closed||typeof window==='undefined')return;
      const proto=window.location.protocol==='https:'?'wss:':'ws:';
      const wsUrl=`${proto}//${window.location.host}/api/auctions/${encodeURIComponent(listingId)}?itemKey=${encodeURIComponent(itemKey)}`;
      try{
        ws=new WebSocket(wsUrl);
        ws.onopen=()=>{wsOpen=true;};
        ws.onmessage=event=>{
          try{
            const msg=JSON.parse(event.data) as {type?:string;state?:AuctionSummary;bid?:AuctionBidRecord};
            if(msg.state){
              setAuction(msg.state);
            }
            if(msg.type==='bid'&&msg.bid){
              const newBid=msg.bid;
              setBids(prev=>prev.some(item=>item.id===newBid.id)?prev:[newBid,...prev].slice(0,30));
            }
          }catch{}
        };
        ws.onclose=()=>{
          wsOpen=false;
          if(!closed&&auction.status==='ACTIVE'){
            reconnectTimer=window.setTimeout(connect,4000);
          }
        };
      }catch{}
    };

    connect();
    const pollInterval=window.setInterval(()=>{
      if(closed||document.visibilityState!=='visible')return;
      if(!wsOpen)void refreshState();
    },4000);
    const onVisibility=()=>{
      if(document.visibilityState==='visible')void refreshState();
    };
    document.addEventListener('visibilitychange',onVisibility);
    return()=>{
      closed=true;
      if(reconnectTimer)window.clearTimeout(reconnectTimer);
      window.clearInterval(pollInterval);
      document.removeEventListener('visibilitychange',onVisibility);
      try{ws?.close();}catch{}
    };
  },[listingId,itemKey,auction.status]);

  const startsAtMs=auction.startsAt?Date.parse(auction.startsAt):NaN;
  const isScheduled=auction.status==='ACTIVE'&&Number.isFinite(startsAtMs)&&nowMs<startsAtMs;
  const startsInMs=isScheduled?Math.max(0,startsAtMs-nowMs):0;
  const endsAtMs=Date.parse(auction.endsAt);
  const remainingMs=Number.isFinite(endsAtMs)?Math.max(0,endsAtMs-nowMs):0;
  const isEnded=auction.status!=='ACTIVE'||remainingMs<=0;
  const isHighestBidder=Boolean(currentUserId&&auction.highestBidderId===currentUserId);
  const isWinner=isEnded&&isHighestBidder&&auction.bidCount>0;

  async function handlePlaceBid(event:FormEvent){
    event.preventDefault();
    if(!currentUserId){
      window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));
      return;
    }
    const amount=Math.round(Number(bidInput));
    if(!Number.isSafeInteger(amount)||amount<minNextBid){
      setError(locale==='ID'?`Minimal bid adalah ${formatMoney(minNextBid,currency)}.`:`Minimum bid is ${formatMoney(minNextBid,currency)}.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try{
      const response=await fetch(`/api/auctions/${encodeURIComponent(listingId)}/bid`,{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({amount,itemKey}),
      });
      const payload=await response.json() as {error?:string;auction?:AuctionSummary;bid?:AuctionBidRecord};
      if(!response.ok||!payload.auction){
        throw new Error(payload.error||(locale==='ID'?'Gagal memasang bid.':'Could not place bid.'));
      }
      setAuction(payload.auction);
      if(payload.bid){
        const placedBid=payload.bid;
        setBids(prev=>prev.some(item=>item.id===placedBid.id)?prev:[placedBid,...prev].slice(0,30));
      }
      toast.success(locale==='ID'?'Bid berhasil dipasang!':'Bid placed!');
    }catch(cause){
      setError((cause as Error).message);
    }finally{
      setSubmitting(false);
    }
  }

  return (
    <>
    <section ref={panelRef} className="market-auction-panel" aria-label={locale==='ID'?'Detail lelang':'Auction details'}>
      <div className="market-auction-header">
        <span className={`market-auction-pill${isEnded?' is-ended':isScheduled?' is-scheduled':''}`}>
          <Gavel size={14} weight="bold"/>
          <span>{itemTitle?`${itemTitle} - ${isEnded?(locale==='ID'?'Berakhir':'Ended'):isScheduled?(locale==='ID'?'Akan datang':'Upcoming'):(locale==='ID'?'Aktif':'Live')}`:(isEnded?(locale==='ID'?'Lelang berakhir':'Auction ended'):isScheduled?(locale==='ID'?'Lelang terjadwal':'Upcoming auction'):(locale==='ID'?'Lelang aktif':'Live auction'))}</span>
        </span>
        <div className="market-auction-header-meta">
          <span className="market-auction-rule">{formatAuctionDurationLabel(auction.durationMode,locale)}</span>
          {auction.snipeProtection&&(
            <span
              className="market-auction-rule"
              title={locale==='ID'?'Bid di 60 detik terakhir memperpanjang waktu +2 menit':'Bids in the final 60s extend the clock by +2m'}
            >
              {locale==='ID'?'Anti-Snipe +2m':'Anti-Snipe +2m'}
            </span>
          )}
          {isOwner&&!isEnded&&(
            <button
              type="button"
              className="market-auction-edit-btn"
              onClick={()=>{
                setEditStartingBid(String(auction.startingBid));
                setEditBuyNow(auction.buyNowPrice?String(auction.buyNowPrice):'');
                setEditIncrement(String(auction.minIncrement));
                setEditDurationMode(auction.durationMode);
                setEditStartMode(auction.startsAt&&Date.parse(auction.startsAt)>Date.now()?'scheduled':'immediate');
                setEditError('');
                setEditingSettings(v=>!v);
              }}
            >
              <Pencil size={13}/>
              <span>{editingSettings?(locale==='ID'?'Tutup':'Close'):auction.bidCount>0?(locale==='ID'?'Ubah Buy Out / BIN':'Edit Buy Out / BIN'):(locale==='ID'?'Ubah lelang':'Edit auction')}</span>
            </button>
          )}
        </div>
      </div>

      {editingSettings&&isOwner&&!isEnded&&(
        <form
          className="market-auction-settings-form"
          onSubmit={async event=>{
            event.preventDefault();
            const hasBids=auction.bidCount>0;
            const startingBid=hasBids?auction.startingBid:Math.round(Number(editStartingBid));
            const buyNowPrice=editBuyNow.trim()?Math.round(Number(editBuyNow)):null;
            const minIncrement=hasBids?auction.minIncrement:Math.round(Number(editIncrement));
            const floor=hasBids?Math.max(auction.startingBid,auction.currentBid):startingBid;
            if(!Number.isSafeInteger(startingBid)||startingBid<100){
              setEditError(locale==='ID'?'Masukkan Open Bid yang valid.':'Enter a valid starting bid.');
              return;
            }
            if(buyNowPrice!==null&&buyNowPrice<=floor){
              setEditError(hasBids?(locale==='ID'?'Harga Buy Out harus lebih tinggi dari bid tertinggi saat ini.':'Buy Out price must be higher than current bid.'):(locale==='ID'?'Harga Buy Out harus lebih tinggi dari Open Bid.':'Buy Out price must be higher than starting bid.'));
              return;
            }
            setSavingSettings(true);
            setEditError('');
            try{
              const response=await fetch(`/api/listings/${encodeURIComponent(listingId)}`,{
                method:'PATCH',
                headers:{'content-type':'application/json'},
                body:JSON.stringify({
                  action:'auction-settings',
                  itemKey,
                  startingBid,
                  buyNowPrice,
                  minIncrement,
                  durationMode:hasBids?auction.durationMode:editDurationMode,
                  startsAt:hasBids?(auction.startsAt??null):(editStartMode==='scheduled'&&editStartsAt?new Date(editStartsAt).toISOString():null),
                }),
              });
              const payload=await response.json() as {auction?:AuctionSummary;error?:string};
              if(!response.ok||!payload.auction)throw new Error(payload.error||(locale==='ID'?'Gagal memperbarui lelang.':'Could not update auction settings.'));
              setAuction(payload.auction);
              setEditingSettings(false);
              toast.success(locale==='ID'?'Pengaturan lelang diperbarui':'Auction settings updated');
            }catch(cause){
              setEditError((cause as Error).message);
            }finally{
              setSavingSettings(false);
            }
          }}
        >
          {auction.bidCount>0&&(
            <p className="market-auction-settings-lock-note">
              {locale==='ID'?'Bid sudah masuk: Open Bid, kelipatan, dan jadwal terkunci. Anda masih dapat mengatur harga Buy Out / BIN di atas bid saat ini.':'Bids are live: starting bid, step, and schedule are locked. You can still set or update Buy Out / BIN above the current bid.'}
            </p>
          )}
          <div className="market-auction-settings-grid">
            <label>
              <span>{locale==='ID'?`Open Bid (${currency})`:`Starting Bid (${currency})`}</span>
              <IdrInput value={editStartingBid} onValueChange={setEditStartingBid} disabled={auction.bidCount>0} required/>
            </label>
            <label>
              <span>{locale==='ID'?`Buy Out / BIN (${currency}, opsional)`:`Buy Out / BIN (${currency}, optional)`}</span>
              <IdrInput value={editBuyNow} onValueChange={setEditBuyNow} placeholder={locale==='ID'?'Kosongkan untuk nonaktif':'Leave blank to disable'}/>
            </label>
            <label>
              <span>{locale==='ID'?`Kelipatan min. (${currency})`:`Min. increment (${currency})`}</span>
              <IdrInput value={editIncrement} onValueChange={setEditIncrement} disabled={auction.bidCount>0} required/>
            </label>
            <label>
              <span>{locale==='ID'?'Aturan berakhir':'End rule'}</span>
              <select value={editDurationMode} disabled={auction.bidCount>0} onChange={e=>setEditDurationMode(e.target.value as typeof editDurationMode)}>
                <option value="ROLLING_24H">{locale==='ID'?'24 jam setelah bid terakhir':'24h after last bid'}</option>
                <option value="ROLLING_48H">{locale==='ID'?'48 jam setelah bid terakhir':'48h after last bid'}</option>
                <option value="FIXED">{locale==='ID'?'Waktu akhir tetap':'Fixed end time'}</option>
              </select>
            </label>
            {auction.bidCount===0&&(
              <>
                <label>
                  <span>{locale==='ID'?'Waktu mulai':'Start timing'}</span>
                  <select value={editStartMode} onChange={e=>setEditStartMode(e.target.value==='scheduled'?'scheduled':'immediate')}>
                    <option value="immediate">{locale==='ID'?'Mulai sekarang':'Start immediately'}</option>
                    <option value="scheduled">{locale==='ID'?'Jadwalkan mulai':'Schedule start'}</option>
                  </select>
                </label>
                {editStartMode==='scheduled'&&(
                  <label>
                    <span>{locale==='ID'?'Tanggal & jam mulai':'Scheduled start'}</span>
                    <input type="datetime-local" value={editStartsAt} onChange={e=>setEditStartsAt(e.target.value)} required/>
                  </label>
                )}
              </>
            )}
          </div>
          {editError&&<p className="error-text" role="alert">{editError}</p>}
          <div className="market-auction-settings-actions">
            <button type="button" className="button secondary" onClick={()=>setEditingSettings(false)} disabled={savingSettings}>{locale==='ID'?'Batal':'Cancel'}</button>
            <button type="submit" className="button" disabled={savingSettings}>{savingSettings?(locale==='ID'?'Menyimpan…':'Saving…'):(locale==='ID'?'Simpan pengaturan':'Save settings')}</button>
          </div>
        </form>
      )}

      <div className="market-auction-stats">
        <div>
          <small>{auction.bidCount>0?(locale==='ID'?'Bid tertinggi':'Current bid'):(locale==='ID'?'Bid awal':'Starting bid')}</small>
          <strong>{formatMoney(auction.bidCount>0?auction.currentBid:auction.startingBid,currency)}</strong>
          <span>{isScheduled?(locale==='ID'?'Bidding belum dibuka':'Bidding opens soon'):auction.bidCount>0?(locale==='ID'?`${auction.bidCount} bid oleh ${auction.highestBidderName||'Kolektor'}`:`${auction.bidCount} ${auction.bidCount===1?'bid':'bids'} by ${auction.highestBidderName||'Collector'}`):(locale==='ID'?'Jadilah penawar pertama':'Be the first to bid')}</span>
        </div>
        <div className="market-auction-timer">
          <small><Clock size={12}/><span>{isScheduled?(locale==='ID'?'Mulai dalam':'Starts in'):(locale==='ID'?'Sisa waktu':'Time left')}</span></small>
          <strong>{isScheduled?formatCountdown(startsInMs,locale):formatCountdown(remainingMs,locale)}</strong>
          <span>{locale==='ID'?`Kelipatan min. ${formatMoney(auction.minIncrement,currency)}`:`Min. step ${formatMoney(auction.minIncrement,currency)}`}</span>
        </div>
      </div>

      {isScheduled&&(
        <div className="market-auction-scheduled-banner" role="status">
          <strong>{locale==='ID'?'Lelang belum dimulai':'Auction is scheduled'}</strong>
          <span>{locale==='ID'?'Klik tombol Simpan listing di atas untuk menandai (Jejak) dan mendapatkan notifikasi saat bidding dibuka.':'Click Save listing above to bookmark (Jejak) and get notified when bidding opens.'}</span>
          {watchers.length>0&&(
            <div className="market-auction-watchers">
              <small>{locale==='ID'?`Kolektor yang menandai (${watchers.length})`:`Collectors tracking (${watchers.length})`}</small>
              <ul>
                {watchers.map(watcher=>{
                  const ts=formatBidTimestamp(watcher.createdAt,locale,nowMs);
                  return (
                    <li key={watcher.userId}>
                      <span className="market-auction-history-bidder">
                        {watcher.username?(
                          <Link href={`/players/${encodeURIComponent(watcher.username)}`}>{watcher.name}</Link>
                        ):(
                          <span>{watcher.name}</span>
                        )}
                        {watcher.verified&&<SealCheck size={13} weight="fill" className="market-bidder-verified" aria-label={locale==='ID'?'Akun terhubung ke media sosial':'Social-connected account'}/>}
                      </span>
                      <small><time dateTime={ts.iso} title={ts.title}>{ts.label}</time></small>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {isWinner&&!auction.winnerOrderId&&(
        <div className="market-auction-winner-banner">
          <div>
            <CheckCircle size={18} weight="fill"/>
            <div>
              <strong>{locale==='ID'?'Anda memenangkan lelang ini!':'You won this auction!'}</strong>
              <span>{locale==='ID'?`Total bid menang: ${formatMoney(auction.currentBid,currency)}`:`Winning bid: ${formatMoney(auction.currentBid,currency)}`}</span>
            </div>
          </div>
          {onCheckoutWinner&&(
            <button type="button" className="button" onClick={()=>onCheckoutWinner(auction.currentBid)}>
              {locale==='ID'?'Lanjut ke pembayaran':'Proceed to checkout'}
            </button>
          )}
        </div>
      )}

      {auction.buyNowPrice&&auction.buyNowPrice>0&&(
        <div className={`market-auction-buyout-row${isEnded||isScheduled||isOwner||auction.currentBid>=auction.buyNowPrice?' is-readonly':''}`}>
          <div>
            <small>{locale==='ID'?'Harga Buy Out (langsung menang)':'Buy Out price (instant win)'}</small>
            <strong>{formatMoney(auction.buyNowPrice,currency)}</strong>
          </div>
          {!isEnded&&!isScheduled&&!isOwner&&auction.buyNowPrice>auction.currentBid?(
            <button
              type="button"
              className="button secondary"
              disabled={submitting||buyingOut}
              onClick={async()=>{
                if(!currentUserId){
                  window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));
                  return;
                }
                setBuyingOut(true);
                setError('');
                try{
                  const response=await fetch(`/api/auctions/${encodeURIComponent(listingId)}/buy-now`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({itemKey})});
                  const payload=await response.json() as {auction?:AuctionSummary;error?:string};
                  if(!response.ok||!payload.auction)throw new Error(payload.error||(locale==='ID'?'Buy Out gagal.':'Could not complete Buy Out.'));
                  setAuction(payload.auction);
                  toast.success(locale==='ID'?'Buy Out berhasil! Melanjutkan ke checkout…':'Buy Out succeeded! Proceeding to checkout…');
                  onCheckoutWinner?.(payload.auction.currentBid);
                }catch(cause){
                  setError((cause as Error).message);
                }finally{
                  setBuyingOut(false);
                }
              }}
            >
              {buyingOut?(locale==='ID'?'Memproses…':'Processing…'):(locale==='ID'?'Buy Out sekarang':'Buy Out now')}
            </button>
          ):(
            <span className="market-auction-buyout-status">
              {auction.currentBid>=auction.buyNowPrice
                ?(locale==='ID'?'Terlampaui oleh bid':'Passed by bids')
                :isScheduled
                  ?(locale==='ID'?'Menunggu mulai':'Opens soon')
                  :isOwner
                  ?(locale==='ID'?'Aktif untuk pembeli':'Available to buyers')
                  :(locale==='ID'?'Lelang berakhir':'Auction ended')}
            </span>
          )}
        </div>
      )}

      {!isEnded&&!isScheduled&&!isOwner&&(
        <form className="market-auction-bid-form" onSubmit={handlePlaceBid}>
          {isHighestBidder&&(
            <p className="market-auction-leading">{locale==='ID'?'Anda saat ini pemegang bid tertinggi.':'You currently hold the highest bid.'}</p>
          )}
          <div className="market-auction-quick-bids">
            {[0,1,2,5].map(step=>{
              const targetAmount=minNextBid+step*auction.minIncrement;
              return (
                <button
                  key={step}
                  type="button"
                  className={Number(bidInput)===targetAmount?'is-selected':''}
                  disabled={submitting||isHighestBidder}
                  onClick={()=>{setBidInput(String(targetAmount));setError('');}}
                >
                  {step===0?(locale==='ID'?'Bid min.':`Min`):`+${step}×`} ({formatMoney(targetAmount,currency)})
                </button>
              );
            })}
          </div>
          <div className="market-auction-bid-row">
            <div className="market-currency-input-wrap">
              <span className="market-currency-badge">IDR</span>
              <IdrInput
                value={bidInput}
                disabled={submitting||buyingOut||isHighestBidder}
                onValueChange={val=>{setBidInput(val);setError('');}}
                aria-label={locale==='ID'?'Nominal bid (IDR)':'Bid amount (IDR)'}
              />
            </div>
            <button type="submit" className="button" disabled={submitting||buyingOut||isHighestBidder}>
              {submitting?(locale==='ID'?'Mengirim...':'Placing...'):(locale==='ID'?'Pasang bid':'Place bid')}
            </button>
          </div>
          {error&&<p className="error-text" role="alert">{error}</p>}
        </form>
      )}

      {bids.length>0&&(
        <div className="market-auction-history">
          <h4>{locale==='ID'?'Riwayat bid terbaru':'Recent bids'}</h4>
          <ul>
            {bids.map((bid,idx)=>{
              const ts=formatBidTimestamp(bid.createdAt,locale,nowMs);
              return (
                <li key={bid.id} className={idx===0?'is-top':''}>
                  <span className="market-auction-history-bidder">
                    {bid.bidderUsername?(
                      <Link href={`/players/${encodeURIComponent(bid.bidderUsername)}`}>{bid.bidderName}</Link>
                    ):(
                      <span>{bid.bidderName}</span>
                    )}
                    {bid.bidderVerified&&<SealCheck size={13} weight="fill" className="market-bidder-verified" aria-label={locale==='ID'?'Akun terhubung ke media sosial':'Social-connected account'}/>}
                  </span>
                  <small><time dateTime={ts.iso} title={ts.title}>{ts.label}</time></small>
                  <strong>{formatMoney(bid.amount,currency)}</strong>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
    {enableStickyFooter&&!panelVisible&&(
      <footer className="market-listing-selection market-auction-sticky-footer" aria-live="polite">
        <div className="market-listing-selection-info">
          <span>
            {itemTitle?`${itemTitle} - `:''}
            {isEnded
              ?(locale==='ID'?'Lelang berakhir':'Auction ended')
              :auction.bidCount>0
                ?(locale==='ID'?`${auction.bidCount} bid - ${formatCountdown(remainingMs,locale)}`:`${auction.bidCount} ${auction.bidCount===1?'bid':'bids'} - ${formatCountdown(remainingMs,locale)}`)
                :(locale==='ID'?`Open bid - ${formatCountdown(remainingMs,locale)}`:`Open bid - ${formatCountdown(remainingMs,locale)}`)}
          </span>
          <div className="market-listing-pricing-block">
            <div className="market-listing-final-total">
              <small>{auction.bidCount>0?(locale==='ID'?'Bid tertinggi:':'Current bid:'):(locale==='ID'?'Bid awal:':'Starting bid:')}</small>
              <strong>{formatMoney(auction.bidCount>0?auction.currentBid:auction.startingBid,currency)}</strong>
              {auction.buyNowPrice&&auction.buyNowPrice>auction.currentBid&&(
                <span className="market-feed-bin-inline"> / BIN {formatMoney(auction.buyNowPrice,currency)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="market-listing-selection-actions">
          {isWinner&&!auction.winnerOrderId&&onCheckoutWinner?(
            <button type="button" className="button" onClick={()=>onCheckoutWinner(auction.currentBid)}>
              {locale==='ID'?'Lanjut ke pembayaran':'Proceed to checkout'}
            </button>
          ):!isEnded&&!isOwner?(
            <>
              <button
                type="button"
                className="button"
                disabled={submitting||buyingOut||isHighestBidder}
                onClick={()=>{
                  if(!currentUserId){
                    window.dispatchEvent(new CustomEvent('vivreplay:open-auth',{detail:'sign-in'}));
                    return;
                  }
                  setBidInput(String(minNextBid));
                  panelRef.current?.scrollIntoView({behavior:'smooth',block:'center'});
                }}
              >
                {isHighestBidder
                  ?(locale==='ID'?'Anda memimpin':'You lead')
                  :(locale==='ID'?`Bid ${formatMoney(minNextBid,currency)}`:`Bid ${formatMoney(minNextBid,currency)}`)}
              </button>
              {auction.buyNowPrice&&auction.buyNowPrice>auction.currentBid&&(
                <button
                  type="button"
                  className="button secondary"
                  disabled={submitting||buyingOut}
                  onClick={()=>panelRef.current?.scrollIntoView({behavior:'smooth',block:'center'})}
                >
                  {locale==='ID'?'Buy Out':'Buy Out'}
                </button>
              )}
            </>
          ):(
            <button type="button" className="button secondary" onClick={()=>panelRef.current?.scrollIntoView({behavior:'smooth',block:'center'})}>
              {locale==='ID'?'Lihat lelang':'View auction'}
            </button>
          )}
        </div>
      </footer>
    )}
    </>
  );
}
