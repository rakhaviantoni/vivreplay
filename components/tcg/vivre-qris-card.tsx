'use client';

import {useCallback,useState} from 'react';
import LocalizedAnchor from '@/components/ui/localized-link';
import {formatMoney} from '@/packages/domain';
import {DownloadSimpleIcon as Download,ArrowSquareOutIcon as ExternalLink,SpinnerGapIcon as Spinner} from '@phosphor-icons/react';

function QrisLogo({height=22}:{height?:number}){
  const width=Math.round(height*3.4);
  return (
    <svg width={width} height={height} viewBox="0 0 136 40" fill="none" aria-label="QRIS">
      {/* Corner bracket glyph */}
      <path d="M4 14V4h10" stroke="#17191e" strokeWidth="3.6" strokeLinecap="square"/>
      <path d="M132 26v10h-10" stroke="#17191e" strokeWidth="3.6" strokeLinecap="square"/>
      <text x="68" y="29" textAnchor="middle" fill="#17191e" fontFamily="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" fontSize="26" fontWeight="900" letterSpacing="3">QRIS</text>
    </svg>
  );
}

function ShopeePayIcon({size=32}:{size?:number}){
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="ShopeePay">
      <rect width="32" height="32" rx="7" fill="#ee4d2d"/>
      {/* Shopping bag handle */}
      <path d="M12 11c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      {/* S letter mark */}
      <path d="M19.5 14.5c-.5-.8-1.5-1.2-2.7-1.2-1.8 0-3 1-3 2.3 0 1.5 1.4 2 2.7 2.4 1.4.4 2.5.9 2.5 2.1 0 1.4-1.3 2.4-3.1 2.4-1.8 0-2.8-.7-3.4-1.6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function DanaIcon({size=32}:{size?:number}){
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="DANA">
      <circle cx="16" cy="16" r="16" fill="#118eea"/>
      {/* Wallet body */}
      <rect x="7" y="11" width="18" height="12" rx="3" stroke="#ffffff" strokeWidth="2" fill="none"/>
      {/* Wallet flap card */}
      <path d="M10 11V9.5C10 8.7 10.7 8 11.5 8h9c.8 0 1.5.7 1.5 1.5V11" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      {/* Wallet clasp */}
      <circle cx="21" cy="17" r="1.5" fill="#ffffff"/>
    </svg>
  );
}

function OvoIcon({size=32}:{size?:number}){
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="OVO">
      <circle cx="16" cy="16" r="16" fill="#4c2a86"/>
      {/* Outer white ring */}
      <circle cx="16" cy="16" r="8.5" stroke="#ffffff" strokeWidth="2.8" fill="none"/>
      {/* Inner white core ring */}
      <circle cx="16" cy="16" r="3.2" stroke="#ffffff" strokeWidth="1.8" fill="none"/>
    </svg>
  );
}

function GopayIcon({size=32}:{size?:number}){
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="GoPay">
      <circle cx="16" cy="16" r="16" fill="#00aa13"/>
      {/* Open ring */}
      <path d="M16 7.5a8.5 8.5 0 1 1-6 2.5" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
      {/* Center dot */}
      <circle cx="16" cy="16" r="2.8" fill="#ffffff"/>
    </svg>
  );
}

export function VivreQrisCard({
  orderId,
  qrImageUrl,
  amount,
  currency='IDR',
  locale='EN',
  compact=false,
  nmid='ID1024324216828',
}:{
  orderId:string;
  qrImageUrl:string;
  amount:number;
  currency?:string;
  locale?:'EN'|'ID';
  compact?:boolean;
  nmid?:string;
}){
  const isId=locale==='ID';
  const t=(en:string,idText:string)=>isId?idText:en;
  const [imageFailed,setImageFailed]=useState(false);
  const [imageVersion,setImageVersion]=useState(0);
  const [downloading,setDownloading]=useState(false);

  const downloadCard=useCallback(async()=>{
    if(downloading)return;
    const rawUrl=`/api/checkout/order/${encodeURIComponent(orderId)}/qris`;
    setDownloading(true);
    try{
      const response=await fetch(rawUrl,{cache:'no-store'});
      if(!response.ok)throw new Error('qr fetch failed');
      const blob=await response.blob();
      const bitmapUrl=URL.createObjectURL(blob);
      try{
        const loadImage=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{
          const img=new Image();
          img.onload=()=>resolve(img);
          img.onerror=()=>reject(new Error('image decode failed'));
          img.src=src;
        });
        const [qrImg,compassImg]=await Promise.all([
          loadImage(bitmapUrl),
          loadImage('/brand/vivreplay-compass-96.webp').catch(()=>null),
        ]);
        const w=720;
        const h=1360;
        const canvas=document.createElement('canvas');
        canvas.width=w;
        canvas.height=h;
        const ctx=canvas.getContext('2d');
        if(!ctx)throw new Error('no canvas');

        const roundRectPath=(x:number,y:number,rw:number,rh:number,r:number)=>{
          ctx.beginPath();
          ctx.moveTo(x+r,y);
          ctx.lineTo(x+rw-r,y);
          ctx.quadraticCurveTo(x+rw,y,x+rw,y+r);
          ctx.lineTo(x+rw-r,y+rh);
          ctx.quadraticCurveTo(x+rw,y+rh,x+rw-r,y+rh);
          ctx.lineTo(x+r,y+rh);
          ctx.quadraticCurveTo(x,y+rh,x,y+rh-r);
          ctx.lineTo(x,y+r);
          ctx.quadraticCurveTo(x,y,x+r,y);
          ctx.closePath();
        };

        // Outer Placard Frame: Vibrant Vermilion-to-Gold VivrePlay Gradient
        const grad=ctx.createLinearGradient(0,0,0,h);
        grad.addColorStop(0,'#bb3d2f');
        grad.addColorStop(0.55,'#df7a28');
        grad.addColorStop(1,'#e5a334');
        roundRectPath(0,0,w,h,48);
        ctx.fillStyle=grad;
        ctx.fill();

        // Inner Placard Card: Crisp Solid White
        const pad=26;
        roundRectPath(pad,pad,w-pad*2,h-pad*2,34);
        ctx.fillStyle='#ffffff';
        ctx.fill();

        // Header: QRIS Logo on Left
        const qx=72;
        const qy=76;
        ctx.strokeStyle='#17191e';
        ctx.lineWidth=4.5;
        ctx.beginPath();
        ctx.moveTo(qx,qy+16);ctx.lineTo(qx,qy);ctx.lineTo(qx+16,qy);
        ctx.moveTo(qx+120,qy+32);ctx.lineTo(qx+120,qy+48);ctx.lineTo(qx+104,qy+48);
        ctx.stroke();
        ctx.textAlign='center';
        ctx.fillStyle='#17191e';
        ctx.font='900 32px system-ui,-apple-system,BlinkMacSystemFont,Roboto,sans-serif';
        ctx.fillText('QRIS',qx+60,qy+36);

        // Header: VivrePlay Compass Logo + Wordmark on Right
        const vx=w-72;
        ctx.textAlign='right';
        ctx.fillStyle='#17191e';
        ctx.font='800 34px system-ui,-apple-system,BlinkMacSystemFont,Roboto,sans-serif';
        ctx.fillText('VivrePlay',vx,qy+36);
        if(compassImg){
          ctx.drawImage(compassImg,vx-195,qy+2,42,42);
        }

        // Title: Scan to Pay / Pindai untuk Membayar (Bold Vermilion)
        ctx.textAlign='center';
        ctx.fillStyle='#bb3d2f';
        ctx.font='800 44px system-ui,-apple-system,BlinkMacSystemFont,Roboto,sans-serif';
        ctx.fillText(isId?'Pindai untuk Membayar':'Scan to Pay',w/2,185);

        // Center QR Code
        const qrSize=480;
        const qrX=(w-qrSize)/2;
        const qrY=230;
        ctx.fillStyle='#ffffff';
        ctx.fillRect(qrX,qrY,qrSize,qrSize);
        ctx.drawImage(qrImg,qrX,qrY,qrSize,qrSize);

        // NMID line
        ctx.fillStyle='#2d3139';
        ctx.font='600 24px system-ui,-apple-system,BlinkMacSystemFont,Roboto,sans-serif';
        ctx.fillText(`NMID: ${nmid}`,w/2,760);

        // "QR Code accepted in"
        ctx.fillStyle='#17191e';
        ctx.font='700 27px system-ui,-apple-system,BlinkMacSystemFont,Roboto,sans-serif';
        ctx.fillText(isId?'QR Code diterima di':'QR Code accepted in',w/2,828);

        // 4 Official Wallet Badges
        const iconY=875;
        const iconSize=58;
        const iconGap=32;
        const startX=w/2-(iconSize*2+iconGap*1.5);

        // 1. ShopeePay (Orange rounded square)
        const sx=startX;
        roundRectPath(sx,iconY,iconSize,iconSize,14);
        ctx.fillStyle='#ee4d2d';
        ctx.fill();
        ctx.strokeStyle='#ffffff';
        ctx.lineWidth=3.2;
        ctx.beginPath();
        ctx.arc(sx+iconSize/2,iconY+20,7,Math.PI,0);
        ctx.stroke();
        ctx.textAlign='center';
        ctx.fillStyle='#ffffff';
        ctx.font='800 28px system-ui,-apple-system,sans-serif';
        ctx.fillText('S',sx+iconSize/2,iconY+45);

        // 2. DANA (Blue circle with wallet)
        const dx=startX+(iconSize+iconGap);
        ctx.beginPath();
        ctx.arc(dx+iconSize/2,iconY+iconSize/2,iconSize/2,0,Math.PI*2);
        ctx.fillStyle='#118eea';
        ctx.fill();
        roundRectPath(dx+13,iconY+19,iconSize-26,iconSize-34,5);
        ctx.strokeStyle='#ffffff';
        ctx.lineWidth=3.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(dx+iconSize-19,iconY+iconSize/2+2,2.8,0,Math.PI*2);
        ctx.fillStyle='#ffffff';
        ctx.fill();

        // 3. OVO (Purple circle with concentric rings)
        const ox=startX+(iconSize+iconGap)*2;
        ctx.beginPath();
        ctx.arc(ox+iconSize/2,iconY+iconSize/2,iconSize/2,0,Math.PI*2);
        ctx.fillStyle='#4c2a86';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ox+iconSize/2,iconY+iconSize/2,15,0,Math.PI*2);
        ctx.strokeStyle='#ffffff';
        ctx.lineWidth=4.8;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ox+iconSize/2,iconY+iconSize/2,5.5,0,Math.PI*2);
        ctx.strokeStyle='#ffffff';
        ctx.lineWidth=3;
        ctx.stroke();

        // 4. GoPay (Green circle with open ring and dot)
        const gx=startX+(iconSize+iconGap)*3;
        ctx.beginPath();
        ctx.arc(gx+iconSize/2,iconY+iconSize/2,iconSize/2,0,Math.PI*2);
        ctx.fillStyle='#00aa13';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gx+iconSize/2,iconY+iconSize/2,15,0.7*Math.PI,2.3*Math.PI);
        ctx.strokeStyle='#ffffff';
        ctx.lineWidth=4.8;
        ctx.lineCap='round';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(gx+iconSize/2,iconY+iconSize/2,4.8,0,Math.PI*2);
        ctx.fillStyle='#ffffff';
        ctx.fill();

        // "and other platforms that support QRIS"
        ctx.fillStyle='#4b5563';
        ctx.font='500 22px system-ui,-apple-system,BlinkMacSystemFont,Roboto,sans-serif';
        ctx.fillText(isId?'dan aplikasi pembayaran lain yang mendukung QRIS':'and other platforms that support QRIS',w/2,985);

        // Prominent Amount Due Pill
        if(amount>0){
          const amountBoxW=540;
          const amountBoxH=92;
          const amountBoxX=(w-amountBoxW)/2;
          const amountBoxY=1045;
          roundRectPath(amountBoxX,amountBoxY,amountBoxW,amountBoxH,18);
          ctx.fillStyle='#fff9f0';
          ctx.fill();
          ctx.strokeStyle='#eed8b3';
          ctx.lineWidth=2;
          ctx.stroke();

          ctx.fillStyle='#716550';
          ctx.font='600 21px system-ui,-apple-system,BlinkMacSystemFont,Roboto,sans-serif';
          ctx.fillText(isId?'Total pembayaran:':'Amount due:',w/2,amountBoxY+36);

          ctx.fillStyle='#bb3d2f';
          ctx.font='800 34px system-ui,-apple-system,BlinkMacSystemFont,Roboto,sans-serif';
          ctx.fillText(formatMoney(amount,currency),w/2,amountBoxY+74);
        }

        // VivrePlay footer note
        ctx.fillStyle='#8a8175';
        ctx.font='500 17px system-ui,-apple-system,BlinkMacSystemFont,Roboto,sans-serif';
        ctx.fillText('VivrePlay Verified Payment Code',w/2,h-58);

        const pngBlob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('toBlob failed')),'image/png'));
        const downloadUrl=URL.createObjectURL(pngBlob);
        const link=document.createElement('a');
        link.href=downloadUrl;
        link.download=`VivrePlay-QRIS-${orderId.slice(0,8)}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(()=>URL.revokeObjectURL(downloadUrl),4000);
      }finally{
        URL.revokeObjectURL(bitmapUrl);
      }
    }catch{
      window.location.assign(`${rawUrl}?download=1`);
    }finally{
      setDownloading(false);
    }
  },[orderId,amount,currency,isId,downloading,nmid]);

  const imgSrc=imageVersion>0?`${qrImageUrl}${qrImageUrl.includes('?')?'&':'?'}refresh=${imageVersion}`:qrImageUrl;

  return (
    <div className={`checkout-qris-code${compact?' is-compact':''}`}>
      {imageFailed ? (
        <div className="checkout-qris-fallback" role="status">
          <span>{t('QR code did not load.','Kode QR tidak dapat dimuat.')}</span>
          <button type="button" className="checkout-qris-retry" onClick={()=>{setImageFailed(false);setImageVersion(Date.now())}}>{t('Try again','Coba lagi')}</button>
          <div className="checkout-qris-actions">
            <LocalizedAnchor className="button secondary checkout-qris-open-btn" href={`/api/checkout/order/${encodeURIComponent(orderId)}/qris?open=1`} target="_blank" rel="noreferrer">
              <span>{t('Open full-size QR','Buka QR ukuran penuh')}</span>
              <ExternalLink size={14}/>
            </LocalizedAnchor>
            <button type="button" className="button checkout-qris-download-btn" disabled={downloading} onClick={()=>void downloadCard()}>
              {downloading?<Spinner size={15} className="spinner-icon"/>:<Download size={15}/>}
              <span>{downloading?t('Preparing…','Menyiapkan…'):t('Download QRIS','Unduh QRIS')}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="checkout-qris-frame">
            <div className="checkout-qris-card">
              <div className="checkout-qris-brand-row">
                <QrisLogo height={compact?18:22}/>
                <span className="checkout-qris-brand">
                  <img src="/brand/vivreplay-compass-96.webp" alt="VivrePlay" width={compact?18:22} height={compact?18:22}/>
                  <span>VivrePlay</span>
                </span>
              </div>
              <strong className="checkout-qris-headline">{t('Scan to Pay','Pindai untuk Membayar')}</strong>
              <div className="checkout-qris-qr-box">
                <img src={imgSrc} alt={t('QRIS payment code','Kode pembayaran QRIS')} referrerPolicy="no-referrer" onError={()=>setImageFailed(true)}/>
              </div>
              <div className="checkout-qris-nmid">
                <span>NMID: {nmid}</span>
              </div>
              <div className="checkout-qris-accepted">
                <span>{t('QR Code accepted in','QR Code diterima di')}</span>
                <div className="checkout-qris-wallets" role="group" aria-label={t('Supported e-wallets','Dompet digital yang didukung')}>
                  <ShopeePayIcon size={compact?26:30}/>
                  <DanaIcon size={compact?26:30}/>
                  <OvoIcon size={compact?26:30}/>
                  <GopayIcon size={compact?26:30}/>
                </div>
                <small className="checkout-qris-wallets-note">{t('and other platforms that support QRIS','dan aplikasi pembayaran lain yang mendukung QRIS')}</small>
              </div>
              {amount>0&&(
                <div className="checkout-qris-amount">
                  <span>{t('Amount due','Total pembayaran')}</span>
                  <strong>{formatMoney(amount,currency)}</strong>
                </div>
              )}
            </div>
          </div>
          <div className="checkout-qris-actions">
            <button type="button" className="button primary checkout-qris-download-btn" disabled={downloading} onClick={()=>void downloadCard()}>
              {downloading?<Spinner size={16} className="spinner-icon"/>:<Download size={16}/>}
              <span>{downloading?t('Preparing QRIS…','Menyiapkan QRIS…'):t('Download QRIS','Unduh QRIS')}</span>
            </button>
            <LocalizedAnchor className="button secondary checkout-qris-open-btn" href={`/api/checkout/order/${encodeURIComponent(orderId)}/qris?open=1`} target="_blank" rel="noreferrer">
              <span>{t('Open full-size QR','Buka QR ukuran penuh')}</span>
              <ExternalLink size={14}/>
            </LocalizedAnchor>
          </div>
        </>
      )}
    </div>
  );
}

export function VivrePaymentDetailsSkeleton({label}:{label:string}){
  return (
    <div className="vivre-payment-details-skeleton" role="status" aria-live="polite" aria-busy="true">
      <div className="vivre-payment-details-skeleton-head">
        <span className="checkout-payment-skeleton-icon" aria-hidden="true"/>
        <span className="checkout-payment-skeleton-lines" aria-hidden="true">
          <i className="is-title"/>
          <i className="is-sub"/>
        </span>
      </div>
      <div className="vivre-payment-details-skeleton-qr" aria-hidden="true"/>
      <span className="checkout-payment-skeleton-caption">{label}</span>
    </div>
  );
}
