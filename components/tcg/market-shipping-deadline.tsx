import {ClockIcon as Clock} from '@phosphor-icons/react';

export function MarketShippingDeadline({deadline,now,language,timezone,role}:{deadline:string|null|undefined;now:number;language:'EN'|'ID';timezone:string;role:'buyer'|'seller'}){
  if(!deadline)return null;
  const target=new Date(deadline).getTime();
  if(!Number.isFinite(target))return null;
  const id=language==='ID';
  const left=Math.max(0,target-now);
  const days=Math.floor(left/86_400_000);
  const hours=Math.floor(left%86_400_000/3_600_000);
  const minutes=Math.ceil(left%3_600_000/60_000);
  const remaining=left<=0?(id?'Lewat batas waktu':'Past deadline'):days>0?`${days}${id?'h':'d'} ${hours}${id?'j':'h'}`:hours>0?`${hours}${id?'j':'h'} ${minutes}${id?'m':'m'}`:`${minutes}${id?'m':'m'}`;
  const date=new Date(target);
  let formatted='';
  try{
    const offset=new Intl.DateTimeFormat('en-US',{timeZone:timezone,timeZoneName:'longOffset'}).formatToParts(date).find(part=>part.type==='timeZoneName')?.value.replace(/^GMT\+0?(\d{1,2}):00$/, 'UTC+$1').replace(/^GMT-0?(\d{1,2}):00$/, 'UTC-$1').replace(/^GMT/,'UTC')??'UTC';
    formatted=`${new Intl.DateTimeFormat(id?'id-ID':'en-ID',{dateStyle:'medium',timeStyle:'short',timeZone:timezone}).format(date)} (${offset})`;
  }catch{formatted=`${new Intl.DateTimeFormat(id?'id-ID':'en-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(date)} (UTC+7)`}
  return <div className={`market-shipping-deadline${left<=0?' is-overdue':''}`}><Clock size={15} aria-hidden="true"/><span>{role==='seller'?(id?'Kirim sebelum':'Ship by'):(id?'Penjual kirim sebelum':'Seller ships by')} <strong>{formatted}</strong></span><small>{remaining}</small></div>;
}
