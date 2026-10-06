'use client';
import {useEffect,useState} from 'react';
import {StarIcon as Star} from '@phosphor-icons/react';
import {api} from '@/lib/client';
import {toast} from 'sonner';
type Reputation={rating:Array<{role:string;count:number;average:number}>;completed:number;response:{samples:number;percent:number|null;medianHours:number|null};shipping:{samples:number;medianHours:number|null;deliverySamples:number;deliveryHours:number|null};reviews:Array<{rating:number;comment:string;role:string;reviewer:string;createdAt:string}>};
export function MarketReputation({listingId,language,role='seller'}:{listingId:string;language:'EN'|'ID';role?:'seller'|'buyer'}){
 const [data,setData]=useState<Reputation|null>(null);const [failed,setFailed]=useState(false);const id=language==='ID';
 useEffect(()=>{let active=true;setData(null);setFailed(false);void api<Reputation>(`/api/market/reputation?listing=${encodeURIComponent(listingId)}`).then(r=>{if(active)setData(r)}).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[listingId]);
 if(failed)return null;
 if(!data)return <span className="market-reputation-inline is-loading" role="status">{id?'Memuat ulasan':'Loading rating'}</span>;
 const rating=data.rating.find(item=>item.role===role);
 return <span className={`market-reputation-inline ${rating?'has-rating':'is-new'}`} aria-label={rating?`${rating.average.toFixed(1)} out of 5, ${rating.count} ${id?'ulasan':'reviews'}`:id?'Belum ada ulasan':'No reviews yet'}>
   {rating?<><Star size={13} weight="fill" aria-hidden="true"/><b>{rating.average.toFixed(1)}</b><small>({rating.count})</small></>:<small>{id?'Baru':'New'}</small>}
   {data.completed>0&&<i>{data.completed} {id?'pesanan selesai':'completed'}</i>}
 </span>;
}
export function OrderReview({orderId,role,language}:{orderId:string;role:'buyer'|'seller';language:'EN'|'ID'}){
 const id=language==='ID';const [review,setReview]=useState<{rating:number;comment:string}|null|undefined>();const [rating,setRating]=useState(0);const [comment,setComment]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState(false);
 useEffect(()=>{let active=true;api<{review:{rating:number;comment:string}|null}>(`/api/market/reviews?order=${orderId}`).then(r=>{if(active)setReview(r.review)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[orderId]);
 if(error)return <p>{id?'Ulasan gagal dimuat':'Could not load review'}</p>;if(review===undefined)return <p role="status">{id?'Memuat ulasan…':'Loading review…'}</p>;if(review)return <p>{id?'Ulasan Anda':'Your review'}: {review.rating}/5{review.comment&&` - ${review.comment}`}</p>;
 const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);try{await api('/api/market/reviews',{orderId,rating,comment});setReview({rating,comment});toast.success(id?'Ulasan disimpan':'Review saved')}catch(reason){toast.error(reason instanceof Error?reason.message:id?'Ulasan gagal disimpan':'Could not save review')}finally{setBusy(false)}};
 return <form className="market-order-review" onSubmit={save}><h4>{role==='buyer'?(id?'Beri ulasan penjual':'Review seller'):(id?'Beri ulasan pembeli':'Review buyer')}</h4><div role="group" aria-label={id?'Nilai dari 1 sampai 5':'Rating from 1 to 5'}>{[1,2,3,4,5].map(n=><button type="button" key={n} aria-pressed={n===rating} aria-label={`${n}/5`} disabled={busy} onClick={()=>setRating(n)}><Star size={23} weight={n<=rating?'fill':'regular'}/></button>)}</div><label>{id?'Komentar (opsional)':'Comment (optional)'}<textarea maxLength={1000} value={comment} disabled={busy} onChange={e=>setComment(e.target.value)}/></label><button className="button secondary" disabled={!rating||busy}>{id?'Kirim ulasan':'Submit review'}</button></form>;
}
