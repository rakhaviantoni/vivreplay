'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ArrowLeftIcon as ArrowLeft, ArrowUpRightIcon, PlusIcon as Plus, HeartIcon as Heart, StackIcon as Layers3, ShieldCheckIcon as ShieldCheck, StorefrontIcon as Store} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {Card,printingFor,colors} from '@/packages/card-data/catalog';
import {CardArt} from './card-art';
import {CollectionForm} from './collection-form';
import {ShareButton} from './share';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {useAccount,api} from '@/lib/client';
export function CardDetail({card,initialLanguage}:{card:Card;initialLanguage:string}) {
  const [lang,setLang]=useState(initialLanguage);
  const [open,setOpen]=useState(false);
  const {data,refresh}=useAccount();
  const printing=printingFor(card.id,lang);
  const wished=data?.wishlist.some(item=>item.printingId===printing.id);

  return <main className="page">
    <Link className="back-link" href="/cards"><ArrowLeft size={16}/>Card library</Link>
    <div className="detail-layout">
      <div className="detail-art"><CardArt card={card}/><p>Official One Piece Card Game printing</p></div>
      <div className="detail-info">
        <div className="eyebrow">{card.code} <span className="rarity">{card.rarity}</span></div>
        <h1>{card.name}</h1>
        <div className="tags"><span style={{color:colors[card.color]}}>{card.color}</span><span>{card.type}</span><span>{card.setCode}</span></div>
        <div className="detail-stats"><div><small>COST</small><strong>{card.cost}</strong></div><div><small>POWER</small><strong>{card.power.toLocaleString()}</strong></div><div><small>IMPLEMENTATION</small><strong className="text-small">Data only</strong></div></div>
        <div className="effect-block"><h3>Card effect</h3><p>{card.effect}</p></div>
        <div className="printing-heading"><h3>Choose a printing</h3><Tabs value={lang} onValueChange={setLang}><TabsList><TabsTrigger value="EN">EN</TabsTrigger><TabsTrigger value="JP">JP</TabsTrigger></TabsList></Tabs></div>
        <div className="printing-card"><Layers3 size={21}/><div><strong>{printing.variant}</strong><p>{lang==='EN'?'English':'Japanese'} · {printing.set} · {card.rarity}</p></div><span className="badge">{printing.set}</span></div>
        <div className="actions">
          <button className="button" onClick={()=>setOpen(true)}><Plus size={17}/>Add to Vault</button>
          <button className="button secondary" aria-label={wished?'Remove from wishlist':'Add to wishlist'} onClick={async()=>{try { await api('/api/wishlist',{printingId:printing.id,saved:!wished}); await refresh(); toast.success(wished?'Removed from wishlist':'Saved to wishlist'); } catch(error) { toast.error((error as Error).message); }}}><Heart size={18} fill={wished?'currentColor':'none'}/></button>
          <ShareButton title={card.name} path={`/cards/${card.code}?lang=${lang}`}/>
        </div>
        <div className="detail-links"><Link href={`/decks/builder?card=${card.id}`}><Layers3 size={18}/>Build with this card <ArrowUpRightIcon aria-hidden="true" size={14}/></Link><Link href={`/market?sell=${printing.id}`}><Store size={18}/>Sell this card <ArrowUpRightIcon aria-hidden="true" size={14}/></Link></div>
        <div className="provenance"><ShieldCheck size={17}/><div><strong>Card image source</strong><p>This card uses its official One Piece Card Game printing. Card language and printing remain independent fields.</p></div></div>
      </div>
    </div>
    <CollectionForm key={printing.id} printingId={printing.id} name={`${card.name} · ${lang}`} open={open} onClose={()=>setOpen(false)} onSaved={refresh}/>
  </main>;
}
