'use client';
import {useEffect,useMemo,useState} from 'react';
import {StarIcon as Star} from '@phosphor-icons/react';
import {api} from '@/lib/client';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
type Reputation={rating:Array<{role:string;count:number;average:number}>;completed:number;response:{samples:number;percent:number|null;medianHours:number|null};shipping:{samples:number;medianHours:number|null;deliverySamples:number;deliveryHours:number|null};reviews:Array<{rating:number;comment:string;role:string;reviewer:string;createdAt:string}>};
export function MarketReputation({listingId,username,language,role='seller',profile=false}:{listingId?:string;username?:string;language:'EN'|'ID';role?:'seller'|'buyer';profile?:boolean}){
 const [loaded,setLoaded]=useState<{query:string;data:Reputation}|null>(null);const [open,setOpen]=useState(false);const id=language==='ID';
 const query= username?`username=${encodeURIComponent(username)}`:`listing=${encodeURIComponent(listingId??'')}`;
 useEffect(()=>{let active=true;void api<Reputation>(`/api/market/reputation?${query}`).then(data=>{if(active)setLoaded({query,data})}).catch(()=>{});return()=>{active=false}},[query]);
 const data=loaded?.query===query?loaded.data:null;
 const overall=useMemo(()=>{if(!data)return null;const count=data.rating.reduce((n,item)=>n+item.count,0);return count?{count,average:data.rating.reduce((n,item)=>n+item.average*item.count,0)/count}:null},[data]);
 if(!data)return null;
 const rating=data.rating.find(item=>item.role===role);const label=overall?`${overall.average.toFixed(1)} (${overall.count})`:id?'Belum ada ulasan':'No reviews yet';
 const reviewCount=(count:number)=>`${count} ${id?(count===1?'ulasan':'ulasan'):(count===1?'review':'reviews')}`;
 return <>
   <button type="button" className={`market-reputation-inline ${rating?'has-rating':'is-new'}${profile?' is-profile':''}`} aria-label={id?`Buka ulasan: ${label}`:`Open reviews: ${label}`} onClick={()=>setOpen(true)}>
     {overall?<><Star size={13} weight="fill" aria-hidden="true"/><b>{profile?overall.average.toFixed(1):rating?.average.toFixed(1)??overall.average.toFixed(1)}</b><small>({profile?overall.count:rating?.count??overall.count})</small></>:<small>{id?'Belum ada ulasan':'No reviews yet'}</small>}
     {data.completed>0&&<i>{data.completed} {id?'pesanan selesai':'completed'}</i>}
   </button>
   <Dialog open={open} onOpenChange={setOpen}><DialogContent className="market-reputation-dialog">
     <DialogHeader><DialogTitle>{username?(id?`Ulasan Market @${username}`:`@${username}'s Market reviews`):(role==='seller'?(id?'Ulasan penjual':'Seller reviews'):(id?'Ulasan pembeli':'Buyer reviews'))}</DialogTitle><DialogDescription>{id?'Penilaian dari pesanan selesai':'Ratings from completed orders'}</DialogDescription></DialogHeader>
     <div className="market-reputation-summary">
       <div className="market-reputation-overall"><Star size={20} weight="fill"/><strong>{overall?overall.average.toFixed(1):id?'Belum dinilai':'Not rated'}</strong><span>{overall?reviewCount(overall.count):id?'Belum ada ulasan':'No reviews yet'}</span></div>
       {(['seller','buyer'] as const).map(kind=>{const row=data.rating.find(item=>item.role===kind);return <div className="market-reputation-role" key={kind}><span>{kind==='seller'?(id?'Penilaian sebagai penjual':'Seller rating'):(id?'Penilaian sebagai pembeli':'Buyer rating')}</span><strong>{row?`${row.average.toFixed(1)} ★`:id?'Belum dinilai':'Not rated'}</strong><small>{row?reviewCount(row.count):id?'Belum ada ulasan':'No reviews yet'}</small></div>})}
     </div>
     <div className="market-reputation-review-list">{data.reviews.length?data.reviews.map((review,index)=><article key={`${review.createdAt}-${index}`}><header><strong>{review.reviewer}</strong><b><Star size={13} weight="fill"/>{review.rating}</b></header>{review.comment&&<p>{review.comment}</p>}<div className="market-reputation-review-context"><span>{review.role==='seller'?(id?'Membeli dari penjual ini':'Bought from this seller'):(id?'Menjual kepada pembeli ini':'Sold to this buyer')}</span><time dateTime={review.createdAt}>{new Intl.DateTimeFormat(id?'id-ID':'en-US',{dateStyle:'medium'}).format(new Date(review.createdAt))}</time></div></article>):<p className="market-reputation-empty">{id?'Belum ada ulasan untuk ditampilkan.':'No reviews yet.'}</p>}</div>
   </DialogContent></Dialog>
 </>;
}
export function OrderReview({orderId,role,language}:{orderId:string;role:'buyer'|'seller';language:'EN'|'ID'}){
 const id=language==='ID';const [review,setReview]=useState<{rating:number;comment:string}|null|undefined>();const [rating,setRating]=useState(0);const [comment,setComment]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState(false);
 useEffect(()=>{let active=true;api<{review:{rating:number;comment:string}|null}>(`/api/market/reviews?order=${orderId}`).then(r=>{if(active)setReview(r.review)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[orderId]);
 if(error)return <p>{id?'Ulasan gagal dimuat':'Could not load review'}</p>;if(review===undefined)return <p role="status">{id?'Memuat ulasan…':'Loading review…'}</p>;if(review)return <div className="market-order-review-submitted"><strong>{id?'Terima kasih atas ulasan Anda':'Thanks for your review'}</strong><span className="market-order-review-stars" aria-label={id?`Nilai ${review.rating} dari 5`:`Rated ${review.rating} out of 5`}>{Array.from({length:5},(_,index)=><Star key={index} size={16} weight={index<review.rating?'fill':'regular'}/>)}</span>{review.comment&&<blockquote>{review.comment}</blockquote>}</div>;
 const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);try{await api('/api/market/reviews',{orderId,rating,comment});setReview({rating,comment});toast.success(id?'Ulasan disimpan':'Review saved')}catch(reason){toast.error(reason instanceof Error?reason.message:id?'Ulasan gagal disimpan':'Could not save review')}finally{setBusy(false)}};
 return <form className="market-order-review" onSubmit={save}><h4>{role==='buyer'?(id?'Beri ulasan penjual':'Review seller'):(id?'Beri ulasan pembeli':'Review buyer')}</h4><div role="group" aria-label={id?'Nilai dari 1 sampai 5':'Rating from 1 to 5'}>{[1,2,3,4,5].map(n=><button type="button" key={n} aria-pressed={n===rating} aria-label={`${n}/5`} disabled={busy} onClick={()=>setRating(n)}><Star size={23} weight={n<=rating?'fill':'regular'}/></button>)}</div><label>{id?'Komentar (opsional)':'Comment (optional)'}<textarea maxLength={1000} value={comment} disabled={busy} onChange={e=>setComment(e.target.value)}/></label><button className="button secondary" disabled={!rating||busy}>{id?'Kirim ulasan':'Submit review'}</button></form>;
}
