'use client';

import Link from 'next/link';
import {ArrowRightIcon, ChartBarIcon, SwordIcon} from '@phosphor-icons/react';
import {useEffect,useState} from 'react';
import {createClient} from '@/utils/supabase/client';
import {CardArt} from './card-art';
import type {Card} from '@/packages/card-data/catalog';

type Identity={id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string};
type Printing={id:string;card_image_url:string|null;rarity:string|null;set_code:string;tcg_card_identities:Identity};
type Matchup={id:string;left:string;right:string;leftRate:string;rightRate:string;leftRecord:string;rightRecord:string;confidence:string};

// These are the observed matchup samples already shown on the home page. They are deliberately
// kept separate from future Arena leaderboards, which need a broader pool of recorded games.
const matchups:Matchup[]=[
  {id:'mihawk-ace-luffy',left:'OP14-020',right:'ST30-001',leftRate:'45%',rightRate:'55%',leftRecord:'62 wins from 137 games',rightRecord:'75 wins from 137 games',confidence:'±8.3'},
  {id:'robin-luffy',left:'OP09-062',right:'OP17-079',leftRate:'54%',rightRate:'46%',leftRecord:'151 wins from 280 games',rightRecord:'129 wins from 280 games',confidence:'±5.8'},
];

function asCard(row:Printing):Card{const i=row.tcg_card_identities;return{id:row.id,code:i.code,name:i.name,color:i.color,type:i.card_type,cost:i.cost,power:i.power,effect:i.effect_text,rarity:row.rarity??'',art:0,imageUrl:row.card_image_url??undefined,imageSource:'external'};}

export function MetaExperience(){
  const [cards,setCards]=useState<Record<string,Card>>({});
  useEffect(()=>{let active=true;const client=createClient();void Promise.all([...new Set(matchups.flatMap(matchup=>[matchup.left,matchup.right]))].map(async code=>{const {data:identity}=await client.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text').eq('code',code).maybeSingle();if(!identity)return null;const {data:printing}=await client.from('tcg_card_printings').select('id,card_image_url,rarity,set_code').eq('identity_id',identity.id).eq('language','EN').not('card_image_url','is',null).limit(1).maybeSingle();return printing?asCard({...printing,tcg_card_identities:identity} as Printing):null;})).then(rows=>{if(active)setCards(Object.fromEntries(rows.filter((row):row is Card=>Boolean(row)).map(row=>[row.code,row])))});return()=>{active=false};},[]);
  const cardName=(code:string)=>cards[code]?.name??code;
  return <main className="page meta-page">
    <header className="page-intro-surface meta-hero"><p className="eyebrow"><ChartBarIcon size={15}/> Meta</p><h1>See the matchups taking shape.</h1><p>Early results from recorded games. More matchups and leader rankings arrive as the Arena sample grows.</p></header>
    <section className="meta-preview" aria-labelledby="matchup-preview-title"><header><div><p className="eyebrow"><SwordIcon size={15}/> Matchup preview</p><h2 id="matchup-preview-title">Current recorded pairings</h2></div><span>Small samples can move quickly.</span></header><div className="meta-preview-grid">{matchups.map(matchup=>{const left=cards[matchup.left];const right=cards[matchup.right];return <article key={matchup.id} className="meta-matchup"><div className="meta-matchup-leaders"><Link href={`/cards/${matchup.left}`} aria-label={`Open ${cardName(matchup.left)}`}>{left?<CardArt card={left}/>:<i/>}<b>{cardName(matchup.left)}</b></Link><span>vs</span><Link href={`/cards/${matchup.right}`} aria-label={`Open ${cardName(matchup.right)}`}>{right?<CardArt card={right}/>:<i/>}<b>{cardName(matchup.right)}</b></Link></div><div className="meta-matchup-result"><div><b>{matchup.leftRate}</b><span>{matchup.leftRecord}</span></div><em>{matchup.confidence}</em><div><b>{matchup.rightRate}</b><span>{matchup.rightRecord}</span></div></div></article>})}</div></section>
    <section className="meta-next"><div><p className="eyebrow">Arena data</p><h2>Leader rankings need more recorded games.</h2><p>Play results will fill the broader tier list and matchup matrix as the sample becomes useful.</p></div><Link href="/play">Play in Arena <ArrowRightIcon size={16}/></Link></section>
  </main>;
}
