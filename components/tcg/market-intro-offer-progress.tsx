'use client';

export function MarketIntroOfferProgress({limit,remaining,endsAt,locale}:{limit:number|null|undefined;remaining:number|null|undefined;endsAt:string|null|undefined;locale:'EN'|'ID'}){
  if(!limit||limit<1)return null;
  const safeRemaining=remaining==null?null:Math.max(0,Math.min(limit,remaining));
  const claimed=safeRemaining===null?null:limit-safeRemaining;
  const dateLabel=endsAt?new Intl.DateTimeFormat(locale==='ID'?'id-ID':'en-US',{dateStyle:'medium',timeZone:'Asia/Jakarta'}).format(new Date(endsAt)):null;
  const label=claimed===null
    ?(locale==='ID'?`Promo tersedia untuk ${limit} anggota`:`Intro price available to ${limit} members`)
    :locale==='ID'?`${claimed} dari ${limit} promo terpakai`:`${claimed} of ${limit} intro prices claimed`;
  return <div className="pro-intro-limit-note">
    <div><span>{label}</span>{safeRemaining!==null&&<strong>{locale==='ID'?`tersisa ${safeRemaining}`:`${safeRemaining} left`}</strong>}</div>
    {claimed!==null&&<progress max={limit} value={claimed} aria-label={label}/>}
    {dateLabel&&<small>{locale==='ID'?`Berakhir ${dateLabel}`:`Ends ${dateLabel}`}</small>}
  </div>;
}
