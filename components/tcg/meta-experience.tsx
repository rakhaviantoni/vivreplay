'use client';

import Link from 'next/link';
import {ArrowRightIcon, ChartBarIcon, SwordIcon} from '@phosphor-icons/react';
import {useEffect,useState} from 'react';
import {createClient} from '@/utils/supabase/client';
import {CardArt} from './card-art';
import type {Card} from '@/packages/card-data/catalog';

type Identity={id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string};
type Printing={id:string;card_image_url:string|null;rarity:string|null;set_code:string;language:string;printing_code:string|null;tcg_card_assets:{kind:string;object_key:string}[];tcg_card_identities:Identity};
type Matchup={id:string;left:string;right:string;leftRate:string;rightRate:string;leftRecord:string;rightRecord:string;confidence:string};

// These are the observed matchup samples already shown on the home page. They are deliberately
// kept separate from future Arena leaderboards, which need a broader pool of recorded games.
const matchups:Matchup[]=[
  {id:'mihawk-ace-luffy',left:'OP14-020',right:'ST30-001',leftRate:'45%',rightRate:'55%',leftRecord:'62 wins from 137 games',rightRecord:'75 wins from 137 games',confidence:'±8.3'},
  {id:'robin-luffy',left:'OP09-062',right:'OP17-079',leftRate:'54%',rightRate:'46%',leftRecord:'151 wins from 280 games',rightRecord:'129 wins from 280 games',confidence:'±5.8'},
];

function asCard(row:Printing):Card{const i=row.tcg_card_identities;return{id:row.id,code:i.code,name:i.name,color:i.color,type:i.card_type,cost:i.cost,power:i.power,effect:i.effect_text,rarity:row.rarity??'',art:0,imageUrl:row.card_image_url??undefined,imageSource:'external',setCode:row.set_code,language:row.language,printingCode:row.printing_code??i.code,assetPath:row.tcg_card_assets.find(asset=>asset.kind==='small')?.object_key};}

export function MetaExperience(){
  const [cards,setCards]=useState<Record<string,Card>>({});
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');
  useEffect(()=>{
    const syncLocale=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail);
    syncLocale();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);
  const id=language==='ID';
  useEffect(()=>{let active=true;const client=createClient();void Promise.all([...new Set(matchups.flatMap(matchup=>[matchup.left,matchup.right]))].map(async code=>{const {data:identity}=await client.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text').eq('code',code).maybeSingle();if(!identity)return null;const {data:printing}=await client.from('tcg_card_printings').select('id,card_image_url,rarity,set_code,language,printing_code,tcg_card_assets(kind,object_key)').eq('identity_id',identity.id).eq('language','EN').not('card_image_url','is',null).limit(1).maybeSingle();return printing?asCard({...printing,tcg_card_identities:identity} as Printing):null;})).then(rows=>{if(active)setCards(Object.fromEntries(rows.filter((row):row is Card=>Boolean(row)).map(row=>[row.code,row])))});return()=>{active=false};},[]);
  const cardName=(code:string)=>cards[code]?.name??code;
  const formatRecord=(record:string)=>{
    if(!id) return record;
    const match=record.match(/(\d+)\s+wins?\s+from\s+(\d+)\s+games?/i);
    return match ? `${match[1]} menang dari ${match[2]} laga` : record;
  };
  return <main className="page meta-page">
    <header className="meta-hero"><div className="meta-hero-copy"><p className="eyebrow"><ChartBarIcon size={15}/> {id?'Meta Permainan':'Meta'}</p><h1>{id?'Lihat peta persaingan yang mulai terbentuk.':'See the matchups taking shape.'}</h1><p>{id?'Hasil awal dari pertandingan yang tercatat. Lebih banyak matchup dan peringkat leader akan hadir seiring bertambahnya data Arena.':'Early results from recorded games. More matchups and leader rankings arrive as the Arena sample grows.'}</p><div className="meta-summary"><span><b>{matchups.length}</b> {id?'pasangan tercatat':'recorded pairings'}</span><span><b>417</b> {id?'sampel laga':'games sampled'}</span><span>{id?'Data awal Arena':'Early Arena data'}</span></div></div></header>
    <section className="meta-preview" aria-labelledby="matchup-preview-title"><header><div><p className="eyebrow"><SwordIcon size={15}/> {id?'Pratinjau matchup':'Matchup preview'}</p><h2 id="matchup-preview-title">{id?'Pasangan pertandingan saat ini':'Current recorded pairings'}</h2></div><span>{id?'Sampel kecil dapat berubah dengan cepat.':'Small samples can move quickly.'}</span></header><div className="meta-preview-grid">{matchups.map(matchup=>{const left=cards[matchup.left];const right=cards[matchup.right];return <article key={matchup.id} className="meta-matchup"><div className="meta-matchup-leaders"><Link href={`/cards/${matchup.left}`} aria-label={`${id?'Buka':'Open'} ${cardName(matchup.left)}`}>{left?<CardArt card={left}/>:<i/>}<b>{cardName(matchup.left)}</b></Link><span>vs</span><Link href={`/cards/${matchup.right}`} aria-label={`${id?'Buka':'Open'} ${cardName(matchup.right)}`}>{right?<CardArt card={right}/>:<i/>}<b>{cardName(matchup.right)}</b></Link></div><div className="meta-matchup-result"><div><b>{matchup.leftRate}</b><span>{formatRecord(matchup.leftRecord)}</span></div><em>{matchup.confidence}</em><div><b>{matchup.rightRate}</b><span>{formatRecord(matchup.rightRecord)}</span></div></div></article>})}</div></section>
    <section className="meta-next"><div><p className="eyebrow">{id?'Data Arena':'Arena data'}</p><h2>{id?'Peringkat leader membutuhkan lebih banyak catatan laga.':'Leader rankings need more recorded games.'}</h2><p>{id?'Hasil permainan akan melengkapi tier list dan matriks matchup seiring bertambahnya sampel data.':'Play results will fill the broader tier list and matchup matrix as the sample becomes useful.'}</p></div><Link href="/play">{id?'Main di Arena':'Play in Arena'} <ArrowRightIcon size={16}/></Link></section>
  </main>;
}
