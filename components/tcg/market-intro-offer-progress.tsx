'use client';

export function MarketIntroOfferProgress({limit,remaining,endsAt,locale,compact=false}:{limit:number|null|undefined;remaining:number|null|undefined;endsAt:string|null|undefined;locale:'EN'|'ID';compact?:boolean}){
  if(!limit||limit<1)return null;
  const safeRemaining=remaining==null?null:Math.max(0,Math.min(limit,remaining));
  const claimed=safeRemaining===null?null:limit-safeRemaining;
  const dateLabel=endsAt?new Intl.DateTimeFormat(locale==='ID'?'id-ID':'en-US',{dateStyle:'medium',timeZone:'Asia/Jakarta'}).format(new Date(endsAt)):null;
  const label=claimed===null
    ?(locale==='ID'?`Harga promo untuk ${limit} anggota pertama`:`Intro price for the first ${limit} members`)
    :locale==='ID'?`${claimed} dari ${limit} promo terpakai`:`${claimed} of ${limit} intro prices claimed`;
  const compactLabel=safeRemaining===null
    ?`${label}${dateLabel?(locale==='ID'?`, sampai ${dateLabel}`:`, until ${dateLabel}`):''}`
    :locale==='ID'
      ?`${limit} anggota pertama: tersisa ${safeRemaining} harga promo${dateLabel?`, sampai ${dateLabel}`:''}`
      :`First ${limit} members: ${safeRemaining} intro prices left${dateLabel?`, until ${dateLabel}`:''}`;
  return <div className={`pro-intro-limit-note${compact?' is-compact':''}`}>
    <div><span>{compact?compactLabel:label}</span>{!compact&&safeRemaining!==null&&<strong>{locale==='ID'?`tersisa ${safeRemaining}`:`${safeRemaining} left`}</strong>}</div>
    {claimed!==null&&<progress max={limit} value={claimed} aria-label={label}/>}
    {dateLabel&&!compact&&<small>{locale==='ID'?`Berlaku sampai ${dateLabel}`:`Available until ${dateLabel}`}</small>}
  </div>;
}
