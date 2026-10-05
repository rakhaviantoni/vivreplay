'use client';

import Link from 'next/link';
import Image from 'next/image';
import {useSearchParams} from 'next/navigation';
import {Fragment,useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowSquareOutIcon,ChartBarIcon,CardsIcon,CaretDownIcon,MagnifyingGlassIcon,SwordIcon,TrophyIcon} from '@phosphor-icons/react';
import {CardArt} from './card-art';
import {CardPreviewModal} from './card-preview-modal';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Command,CommandEmpty,CommandGroup,CommandInput,CommandItem,CommandList} from '@/components/ui/command';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {sharedDeckSearch} from '@/lib/deck-share';
import {filterMeta,leaderStats,matchup,rateText,type MetaFeed,type MetaFilters,type MetaFinish,type MetaMatch} from '@/lib/meta-stats';
import type {Card} from '@/packages/card-data/catalog';
import '@/app/meta/meta.css';

type View='tier'|'leader'|'matchups'|'events';
type MatchSelection={one:string;two:string;matches:MetaMatch[]};
const initialFilters:MetaFilters={period:'all',source:'all',event:'all',color:'all',query:''};
const colorNames=['Red','Green','Blue','Purple','Black','Yellow'];
const colors:Record<string,string>={Red:'#b9453d',Green:'#337f58',Blue:'#3c77a7',Purple:'#84659b',Black:'#4b5056',Yellow:'#b69229'};

function Portrait({card,code,className=''}:{card?:Card;code:string;className?:string}){
  const [missing,setMissing]=useState(false);
  return <span className={`meta-portrait ${className}`}>{card?<CardArt card={card}/>:<span className="meta-art-missing">{code}{!missing&&<Image src={`/${code.split('-')[0]}/en/${code}.webp`} alt={`${code} card`} width={420} height={580} unoptimized onError={()=>setMissing(true)}/>}</span>}</span>;
}
function ColorDots({color}:{color:string}){
  return <span className="meta-color-dots" aria-label={color}>{color.split(/[\/ ,]+/).filter(value=>colors[value]).map(value=><i key={value} style={{background:colors[value]}}/>)}</span>;
}
function colorKey(color:string){return color.split(/[\/ ,]+/).filter(Boolean).join('/');}
function colorsSelected(value:string){return value==='all'?[]:value.split(',').filter(Boolean);}
function matchesColor(color:string,filter:string){const selected=colorsSelected(filter);return !selected.length||selected.some(value=>color.split(/[\/ ,]+/).includes(value));}
function resultClass(rate:number|null){return rate===null?'':rate>.53?'is-positive':rate<.47?'is-negative':'is-even';}

function MatchBreakdown({text}:{text:string}){
  const clean=text.replace(/^Partial match record:[\s\S]*?(?=Game\s+1\b)/i,'').replace(/The supplied summary frames[\s\S]*$/i,'').replace(/\bthe supplied recap says\b/gi,'the recap notes').trim();
  const sections=clean.split(/(?=^\s*\*{0,2}(?:Game\s+[1-5]\b|Featured game\s*:))/gim).filter(part=>part.trim());
  return <div className="meta-breakdown">{sections.map((section,index)=>{
    const lines=section.trim().split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    const heading=lines[0]?.replace(/^\*+|\*+$/g,'').replace(/\s*\*+$/,'');
    const hasHeading=/^\*{0,2}(?:Game\s+[1-5]\b|Featured game\s*:)/i.test(lines[0]??'');
    const body=lines.slice(hasHeading?1:0);
    const renderText=(line:string)=>line.replace(/\*\*(.*?)\*\*/g,'$1').replace(/^[-*]\s+/,'');
    const bullets=body.some(line=>/^[-*]\s+/.test(line));
    return <section key={index}>{hasHeading&&<h3>{heading?.replace(/:$/,'')}</h3>}{bullets?<ul>{body.map((line,lineIndex)=><li key={lineIndex}>{renderText(line)}</li>)}</ul>:body.map((line,lineIndex)=><p key={lineIndex}>{renderText(line)}</p>)}</section>;
  })}</div>;
}

function CardTrigger({card,code,name,quantity=1,onOpen}:{card?:Card;code:string;name:string;quantity?:number;onOpen:(code:string,element:HTMLButtonElement)=>void}){
  const count=Math.max(1,Math.min(4,quantity));
  return <button type="button" className={`meta-card-trigger ${count>1?'has-printing-stack':''}`} aria-label={`View ${name} card details`} onClick={event=>onOpen(code,event.currentTarget)}>
    <span className={`card-stage printing-stack deck-printing-stack ${count>1?'has-printing-stack':''}`}>{Array.from({length:count},(_,index)=><span className="stacked-printing" style={{'--stack-index':index} as React.CSSProperties} key={index}><span className="deck-stack-art"><Portrait card={card} code={code}/></span></span>)}{quantity>1&&<b className="printing-count">×{quantity}</b>}</span>
  </button>;
}

export function MetaExperience(){
  const search=useSearchParams();
  const [language,setLanguage]=useState<'EN'|'ID'>('EN');
  const [feed,setFeed]=useState<MetaFeed|null>(null);
  const [loadState,setLoadState]=useState<'loading'|'ready'|'error'>('loading');
  const [refresh,setRefresh]=useState(0);
  const [view,setView]=useState<View>(()=>['tier','leader','matchups','events'].includes(search.get('view')??'')?search.get('view') as View:'tier');
  const [filters,setFilters]=useState<MetaFilters>(initialFilters);
  const [sort,setSort]=useState('games');
  const [leaderCode,setLeaderCode]=useState(search.get('leader')??'');
  const [matrixMode,setMatrixMode]=useState<'leader'|'color'>('leader');
  const [selectedMatch,setSelectedMatch]=useState<MatchSelection|null>(null);
  const [selectedDeck,setSelectedDeck]=useState<(MetaFinish&{eventName:string;eventDate:string})|null>(null);
  const [cardPreview,setCardPreview]=useState<{card:Card;origin:DOMRect}|null>(null);
  const [leaderPickerOpen,setLeaderPickerOpen]=useState(false);
  const id=language==='ID';
  const t=(en:string,indo:string)=>id?indo:en;
  useEffect(()=>{
    const sync=()=>setLanguage(localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    sync();window.addEventListener('vivreplay:locale',sync);
    return()=>window.removeEventListener('vivreplay:locale',sync);
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/meta/tournaments',{signal:controller.signal,cache:'no-cache'}).then(async response=>{
      if(!response.ok)throw new Error('Match stats unavailable');
      const data=await response.json() as MetaFeed;
      if(!Array.isArray(data.records)||!Array.isArray(data.cards))throw new Error('Match stats unavailable');
      setFeed(data);setLoadState('ready');
    }).catch(error=>{if(error.name!=='AbortError')setLoadState('error');});
    return()=>controller.abort();
  },[refresh]);
  const filtered=useMemo(()=>feed?filterMeta(feed,filters):{events:[],records:[],deckCards:[]},[feed,filters]);
  const leaders=useMemo(()=>feed?leaderStats(feed,filtered.records,filtered.events):[],[feed,filtered]);
  const sorted=useMemo(()=>[...leaders].sort((a,b)=>sort==='winRate'?(b.winRate??-1)-(a.winRate??-1)||b.games-a.games:sort==='finishes'?b.topFinishes-a.topFinishes||b.games-a.games:b.games-a.games||b.topFinishes-a.topFinishes||a.name.localeCompare(b.name)),[leaders,sort]);
  const visibleLeaders=sorted.filter(leader=>matchesColor(leader.color,filters.color)&&`${leader.name} ${leader.code}`.toLowerCase().includes(filters.query.toLowerCase().trim()));
  const tierOrder=['Above 50%','Around 50%','Below 50%','Small sample'] as const;
  const tierLeaders=tierOrder.flatMap(tier=>visibleLeaders.filter(leader=>leader.tier===tier));
  const tierLabel=(tier:typeof tierOrder[number])=>tier==='Above 50%'?t('Winning more','Lebih banyak menang'):tier==='Below 50%'?t('Winning less','Lebih sedikit menang'):tier==='Around 50%'?t('Around even','Seimbang'):t('More games needed','Perlu lebih banyak game');
  const cardByCode=useMemo(()=>new Map(feed?.cards.map(card=>[card.code,card])??[]),[feed]);
  const activeLeader=visibleLeaders.find(leader=>leader.code===leaderCode)??visibleLeaders[0];
  const games=filtered.records.reduce((sum,match)=>sum+match.scoreOne+match.scoreTwo,0);
  const series=filtered.records.filter(match=>match.seriesComplete&&match.winnerSide>0).length;
  const deckTotal=filtered.events.reduce((sum,event)=>sum+event.finishes.filter(finish=>finish.cards===50).length,0);
  const lastDate=filtered.events[0]?.eventDate;
  const patchFilter=(patch:Partial<MetaFilters>)=>setFilters(current=>({...current,...patch}));
  const openLeader=(code:string)=>{setLeaderCode(code);setView('leader');};
  const nameFor=(code:string)=>leaders.find(leader=>leader.code===code)?.name??cardByCode.get(code)?.name??code;
  const openCard=(code:string,element:HTMLButtonElement)=>{const card=cardByCode.get(code);if(card)setCardPreview({card,origin:element.getBoundingClientRect()});};
  const openMatch=(one:string,two:string,key?:(code:string)=>string)=>{
    const pair=matchup(filtered.records,one,two,key);
    if(pair.matches.length)setSelectedMatch({one:matrixMode==='color'&&key?one:nameFor(one),two:matrixMode==='color'&&key?two:nameFor(two),matches:pair.matches});
  };
  const dateText=(date:string)=>new Date(`${date.slice(0,10)}T00:00:00Z`).toLocaleDateString(id?'id-ID':'en-US',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const empty=<div className="meta-empty"><ChartBarIcon size={28}/><h2>{t('No games in this selection','Belum ada game untuk pilihan ini')}</h2><p>{t('Try another period or include tournament games.','Pilih periode lain atau sertakan game turnamen.')}</p><button type="button" onClick={()=>setFilters(initialFilters)}>{t('Show all results','Tampilkan semua hasil')}</button></div>;
  const deckList=(selectedDeck?feed?.deckCards.filter(card=>card.finishId===selectedDeck.id):[])??[];

  return <main className="page meta-stats-page">
    <header className="library-intro meta-stats-intro"><div className="library-intro-copy"><p className="kicker">ONE PIECE CARD GAME</p><h1>{t('Meta stats','Statistik meta')}</h1><p>{t('What gets played. What wins. How the matchups unfold.','Leader yang dimainkan, hasilnya, dan matchup di meja.')}</p></div><div className="meta-intro-context" aria-live="polite"><span><b>{loadState==='ready'?games.toLocaleString():'–'}</b> {t('games','game')}</span><span><b>{loadState==='ready'?series:'–'}</b> {t('matches','pertandingan')}</span><span><b>{loadState==='ready'?filtered.events.length:'–'}</b> {t('tournaments','turnamen')}</span>{lastDate&&<small>{t('Latest event','Event terbaru')} {dateText(lastDate)}</small>}</div></header>
    <div className="meta-workspace">
      <div className="meta-view-bar"><nav aria-label={t('Meta views','Tampilan statistik')} className="meta-view-tabs">{([
        ['tier',TrophyIcon,t('Tier list','Tier list')],['leader',MagnifyingGlassIcon,t('By leader','Per leader')],['matchups',SwordIcon,t('Matchups','Matchup')],['events',CardsIcon,t('Tournaments','Turnamen')],
      ] as const).map(([value,Icon,label])=><button key={value} type="button" aria-current={view===value?'page':undefined} className={view===value?'is-active':''} onClick={()=>setView(value)}><Icon size={15}/>{label}</button>)}</nav><div className="meta-period" role="group" aria-label={t('Time period','Periode')}>{([['7',t('7 days','7 hari')],['30',t('30 days','30 hari')],['all',t('All time','Semua')]] as const).map(([value,label])=><button type="button" key={value} aria-pressed={filters.period===value} onClick={()=>patchFilter({period:value})}>{label}</button>)}</div></div>
      <div className="meta-filter-bar">
        <label className="meta-search"><MagnifyingGlassIcon size={16}/><input aria-label={t('Search leaders','Cari leader')} placeholder={t('Search leader or card number','Cari leader atau nomor kartu')} value={filters.query} onChange={event=>patchFilter({query:event.target.value})}/></label>
        <div className="meta-filter-select"><Select value={filters.source} onValueChange={value=>patchFilter({source:value as MetaFilters['source']})}><SelectTrigger aria-label={t('Game source','Sumber game')} className="meta-select-trigger"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">{t('All games','Semua game')}</SelectItem><SelectItem value="tournament">{t('Tournament','Turnamen')}</SelectItem><SelectItem value="ranked">Ranked</SelectItem><SelectItem value="casual">{t('Casual','Kasual')}</SelectItem></SelectContent></Select></div>
        <div className="meta-color-filter" role="group" aria-label={t('Filter by leader color','Filter berdasarkan warna leader')}><button type="button" className={!colorsSelected(filters.color).length?'is-active':''} aria-pressed={!colorsSelected(filters.color).length} onClick={()=>patchFilter({color:'all'})}>{t('All','Semua')}</button>{colorNames.map(color=><button type="button" key={color} className={colorsSelected(filters.color).includes(color)?'is-active':''} aria-label={color} title={color} aria-pressed={colorsSelected(filters.color).includes(color)} onClick={()=>{const selected=colorsSelected(filters.color);const next=selected.includes(color)?selected.filter(value=>value!==color):[...selected,color];patchFilter({color:next.length?next.join(','):'all'});}}><i style={{'--meta-color':colors[color]} as React.CSSProperties}/><span>{color}</span></button>)}</div>
        <div className="meta-filter-select meta-event-filter"><Select value={filters.event} onValueChange={value=>patchFilter({event:value})}><SelectTrigger aria-label={t('Tournament','Turnamen')} className="meta-select-trigger"><SelectValue placeholder={t('All tournaments','Semua turnamen')}/></SelectTrigger><SelectContent><SelectItem value="all">{t('All tournaments','Semua turnamen')}</SelectItem>{feed?.events.map(event=><SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {loadState==='loading'?<div className="meta-loading" role="status"><span/>{t('Loading match results…','Memuat hasil pertandingan…')}</div>:loadState==='error'?<div className="meta-empty" role="alert"><h2>{t('Stats could not be loaded','Statistik belum dapat dimuat')}</h2><p>{t('Please try again in a moment.','Coba lagi sebentar.')}</p><button type="button" onClick={()=>{setLoadState('loading');setRefresh(value=>value+1);}}>{t('Try again','Coba lagi')}</button></div>:<>
      <div className="meta-sample-line"><span>{games.toLocaleString()} {t('games','game')} · {series} {t('matches','pertandingan')} · {deckTotal} {t('decklists','decklist')}</span><span>{t('Win rates use game results. Counts include mirror games.','Win rate berdasarkan hasil game, termasuk mirror.')}</span></div>
      {view==='tier'&&(visibleLeaders.length?<>
        <div className="meta-section-heading"><h2>{t('Leader performance','Performa leader')}</h2><label className="meta-sort-picker"><span>{t('Sort','Urutkan')}</span><Select value={sort} onValueChange={setSort}><SelectTrigger aria-label={t('Sort leader stats','Urutkan statistik leader')} className="meta-select-trigger"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="games">{t('Most played','Paling dimainkan')}</SelectItem><SelectItem value="winRate">{t('Win rate','Win rate')}</SelectItem><SelectItem value="finishes">{t('Top 8 finishes','Hasil Top 8')}</SelectItem></SelectContent></Select></label></div>
        <div className="meta-table-scroll" tabIndex={0} role="region" aria-label={t('Leader performance table','Tabel performa leader')}>
          <table className="meta-leader-table">
            <thead><tr><th>#</th><th>Leader</th><th>{t('Games','Game')}</th><th>W–L</th><th>{t('Win rate','Win rate')}</th><th>{t('Play rate','Play rate')}</th><th>{t('Match W–L','W–L pertandingan')}</th><th>Top 8</th><th>{t('Decklists','Decklist')}</th></tr></thead>
            <tbody>{tierLeaders.map((leader,index)=><Fragment key={leader.code}>
              {(index===0||tierLeaders[index-1].tier!==leader.tier)&&<tr className="meta-tier-group"><th colSpan={9}><i className={resultClass(leader.tier==='Above 50%'?1:leader.tier==='Below 50%'?0:null)}/>{tierLabel(leader.tier)} <small>{tierLeaders.filter(row=>row.tier===leader.tier).length} {t(tierLeaders.filter(row=>row.tier===leader.tier).length===1?'leader':'leaders','leader')}</small></th></tr>}
              <tr><td>{index+1}</td><th scope="row"><div className="meta-leader-link"><CardTrigger card={cardByCode.get(leader.code)} code={leader.code} name={leader.name} onOpen={openCard}/><button type="button" className="meta-leader-open" onClick={()=>openLeader(leader.code)}><b>{leader.name}</b><small><ColorDots color={leader.color}/>{leader.code}</small></button></div></th><td>{leader.games}</td><td>{leader.games?`${leader.wins}–${leader.losses}`:'–'}</td><td><span className={`meta-rate ${resultClass(leader.winRate)}`}>{rateText(leader.winRate)}</span>{leader.winRate!==null&&<i className={`meta-rate-track ${resultClass(leader.winRate)}`}><b style={{width:`${leader.winRate*100}%`}}/></i>}</td><td>{leader.games?`${(leader.playRate*100).toFixed(1)}%`:'–'}</td><td>{leader.series?`${leader.seriesWins}–${leader.series-leader.seriesWins}`:'–'}</td><td>{leader.topFinishes||'–'}</td><td>{leader.decks||'–'}</td></tr>
            </Fragment>)}</tbody>
          </table>
        </div>
        <p className="meta-table-note">{t('Tier groups use a 95% win-rate interval and at least 20 games. Play rate is share of leader appearances in these games; Top 8 counts published finishes.','Kelompok tier memakai rentang win rate 95% dan minimal 20 game. Play rate adalah porsi penampilan leader dalam game ini; Top 8 dihitung dari hasil turnamen.')}</p>
      </>:empty)}
      {view==='leader'&&(activeLeader?<>
        <div className="meta-section-heading">
          <div className="meta-leader-picker"><span>{t('Choose a leader','Pilih leader')}</span>
            <Popover open={leaderPickerOpen} onOpenChange={setLeaderPickerOpen}><PopoverTrigger asChild><button type="button" className="meta-leader-select" aria-label={`${t('Choose a leader','Pilih leader')}: ${activeLeader.name}`} aria-expanded={leaderPickerOpen}><span><b>{activeLeader.name}</b><small>{activeLeader.code} · {activeLeader.games} {t('games','game')}</small></span><CaretDownIcon size={16}/></button></PopoverTrigger><PopoverContent align="start" className="meta-leader-options"><Command><CommandInput placeholder={t('Search leader or card number','Cari leader atau nomor kartu')}/><CommandList><CommandEmpty>{t('No leaders found','Leader tidak ditemukan')}</CommandEmpty><CommandGroup>{visibleLeaders.map(leader=><div className="meta-leader-option" key={leader.code}><CardTrigger card={cardByCode.get(leader.code)} code={leader.code} name={leader.name} onOpen={openCard}/><CommandItem value={`${leader.name} ${leader.code}`} onSelect={()=>{setLeaderCode(leader.code);setLeaderPickerOpen(false);}}><span><b>{leader.name}</b><small>{leader.code} · {leader.games} {t('games','game')} · {rateText(leader.winRate)}</small></span></CommandItem></div>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>
          </div>
        </div>
        <div className="meta-leader-layout"><aside className="meta-leader-profile"><CardTrigger card={cardByCode.get(activeLeader.code)} code={activeLeader.code} name={activeLeader.name} onOpen={openCard}/><h2>{activeLeader.name}</h2><p><ColorDots color={activeLeader.color}/>{activeLeader.code}</p><dl><div><dt>{t('Win rate','Win rate')}</dt><dd className={resultClass(activeLeader.winRate)}>{rateText(activeLeader.winRate)}<small>{activeLeader.wins}–{activeLeader.losses}</small></dd></div><div><dt>{t('Games','Game')}</dt><dd>{activeLeader.games}</dd></div><div><dt>{t('Play rate','Play rate')}</dt><dd>{(activeLeader.playRate*100).toFixed(1)}%</dd></div><div><dt>Top 8</dt><dd>{activeLeader.topFinishes}</dd></div></dl></aside><div className="meta-leader-detail"><div className="meta-section-heading"><h2>{t('Matchups','Matchup')}</h2><span>{t('Select a rival to see the matches','Pilih lawan untuk melihat pertandingan')}</span></div>
        {(()=>{const rivals=leaders.filter(leader=>leader.code!==activeLeader.code).map(leader=>({leader,pair:matchup(filtered.records,activeLeader.code,leader.code)})).filter(row=>row.pair.games).sort((a,b)=>b.pair.games-a.pair.games);const mirror=matchup(filtered.records,activeLeader.code,activeLeader.code);return <>{mirror.games>0&&<div className="meta-mirror-row"><CardTrigger card={cardByCode.get(activeLeader.code)} code={activeLeader.code} name={activeLeader.name} onOpen={openCard}/><button type="button" onClick={()=>openMatch(activeLeader.code,activeLeader.code)}><b>{t('Mirror match','Mirror match')}</b><span>{mirror.games} {mirror.games===1?t('game','game'):t('games','game')} · {mirror.series} {mirror.series===1?t('match','match'):t('matches','pertandingan')}</span></button></div>}{rivals.length?<div className="meta-rival-grid">{rivals.map(({leader,pair})=><article key={leader.code} className="meta-rival"><div className="meta-rival-art"><CardTrigger card={cardByCode.get(leader.code)} code={leader.code} name={leader.name} onOpen={openCard}/><span className={`meta-rival-rate ${resultClass(pair.rate)}`}>{rateText(pair.rate)}<small>{pair.wins}–{pair.losses}</small></span></div><button type="button" className="meta-rival-select" onClick={()=>openMatch(activeLeader.code,leader.code)}><b>{leader.name}</b><small>{leader.code}</small><span>{pair.games} {pair.games===1?t('game','game'):t('games','game')} · {pair.series} {pair.series===1?t('match','match'):t('matches','pertandingan')}</span></button></article>)}</div>:<p className="meta-inline-empty">{t('No head-to-head games for this leader in the current selection.','Belum ada matchup untuk leader ini pada pilihan saat ini.')}</p>}</>;})()}
        <section className="meta-deck-usage"><div className="meta-section-heading"><h2>{t('Cards in deck','Kartu dalam deck')}</h2><span>{t('Share of published decklists','Porsi decklist yang memakai kartu')}</span></div>{(()=>{const finishes=filtered.events.flatMap(event=>event.finishes).filter(finish=>finish.leaderCode===activeLeader.code&&finish.cards===50);const finishIds=new Set(finishes.map(finish=>finish.id));const usage=new Map<string,{lists:number;copies:number}>();for(const card of filtered.deckCards.filter(card=>finishIds.has(card.finishId))){const row=usage.get(card.code)??{lists:0,copies:0};row.lists++;row.copies+=card.quantity;usage.set(card.code,row);}return usage.size?<><p className="meta-subtle">{finishes.length} {t('decklists','decklist')}</p><div className="meta-card-usage-grid">{[...usage].sort((a,b)=>b[1].lists-a[1].lists||b[1].copies-a[1].copies).map(([code,row])=><article key={code} className="meta-card-usage"><CardTrigger card={cardByCode.get(code)} code={code} name={cardByCode.get(code)?.name??code} onOpen={openCard}/><b>{Math.round(row.lists/finishes.length*100)}%</b><span>{cardByCode.get(code)?.name??code}</span><small>{(row.copies/row.lists).toFixed(1)}× {t('average','rata-rata')}</small></article>)}</div></>:<p className="meta-inline-empty">{t('No published decklists for this leader yet.','Belum ada decklist untuk leader ini.')}</p>;})()}</section>
        <section><div className="meta-section-heading"><h2>{t('Tournament decks','Deck turnamen')}</h2></div><div className="meta-deck-results">{filtered.events.flatMap(event=>event.finishes.filter(finish=>finish.leaderCode===activeLeader.code).map(finish=><button type="button" key={finish.id} onClick={()=>setSelectedDeck({...finish,eventName:event.name,eventDate:event.eventDate})}><strong>#{finish.place}</strong><span><b>{finish.playerName}</b><small>{event.name} · {dateText(event.eventDate)}</small></span><span>{finish.cards===50?'50 '+t('cards','kartu'):t('View finish','Lihat hasil')}</span></button>))}</div>{!filtered.events.some(event=>event.finishes.some(finish=>finish.leaderCode===activeLeader.code))&&<p className="meta-inline-empty">{t('No tournament finishes in this selection.','Belum ada hasil turnamen untuk pilihan ini.')}</p>}</section>
        </div></div>
      </>:empty)}
      {view==='matchups'&&(games&&visibleLeaders.length?<>
        <div className="meta-section-heading"><div><h2>{t('Matchup matrix','Matriks matchup')}</h2><p>{t('Win rate of the row against the column. Select a result to see the matches.','Win rate baris melawan kolom. Pilih hasil untuk melihat pertandingan.')}</p></div><div className="meta-period" role="group" aria-label={t('Matrix grouping','Kelompok matriks')}>{(['leader','color'] as const).map(mode=><button type="button" key={mode} aria-pressed={matrixMode===mode} onClick={()=>setMatrixMode(mode)}>{mode==='leader'?t('By leader','Per leader'):t('By color','Per warna')}</button>)}</div></div>
        <div className="meta-matrix-key"><span><i className="is-negative"/>{t('Lower win rate','Win rate rendah')}</span><span><i className="is-even"/>50%</span><span><i className="is-positive"/>{t('Higher win rate','Win rate tinggi')}</span><small>{t('Light cells: fewer than 20 games. Blank cells: no games.','Warna tipis: kurang dari 20 game. Sel kosong: belum ada game.')}</small></div>
        {(()=>{const key=(code:string)=>matrixMode==='color'?colorKey(leaders.find(leader=>leader.code===code)?.color??code):code;const keys=matrixMode==='color'?[...new Set(visibleLeaders.map(leader=>colorKey(leader.color)))].filter(Boolean):visibleLeaders.filter(leader=>leader.games).slice(0,12).map(leader=>leader.code);const label=(code:string)=>matrixMode==='color'?code:nameFor(code);return <div className="meta-matrix-scroll" tabIndex={0} role="region" aria-label={t('Matchup matrix','Matriks matchup')}><table className="meta-matrix"><thead><tr><th className="meta-matrix-corner">{t('Player ↓ / Opponent →','Pemain ↓ / Lawan →')}</th>{keys.map(code=><th key={code} scope="col">{matrixMode==='leader'?<CardTrigger card={cardByCode.get(code)} code={code} name={nameFor(code)} onOpen={openCard}/>:<ColorDots color={code}/>}<span>{matrixMode==='leader'?code:code.replaceAll('/',' / ')}</span></th>)}</tr></thead><tbody>{keys.map(one=><tr key={one}><th scope="row"><div className="meta-matrix-player">{matrixMode==='leader'?<CardTrigger card={cardByCode.get(one)} code={one} name={nameFor(one)} onOpen={openCard}/>:<ColorDots color={one}/>}<button type="button" onClick={()=>matrixMode==='leader'?openLeader(one):patchFilter({color:one.split('/')[0]})}>{label(one)}</button></div></th>{keys.map(two=>{const sameColor=matrixMode==='color'&&one===two;const pair=sameColor?null:matchup(filtered.records,one,two,key);const games=sameColor?filtered.records.filter(match=>key(match.leaderOneCode)===one&&key(match.leaderTwoCode)===one).reduce((sum,match)=>sum+match.scoreOne+match.scoreTwo,0):pair?.games??0;return <td key={two}>{sameColor?<span className="meta-matrix-blank" aria-label={t('Same color group','Warna sama')}>{games?`${games} ${t('games','game')}`:'–'}</span>:pair?.games?<button type="button" className={`meta-matrix-cell ${pair.mirror?'is-mirror':resultClass(pair.rate)} ${pair.games<20?'is-small-sample':''}`} aria-label={`${label(one)} vs ${label(two)}: ${pair.mirror?'mirror':rateText(pair.rate)}, ${pair.games} games`} onClick={()=>openMatch(one,two,key)}><b>{pair.mirror?t('Mirror','Mirror'):rateText(pair.rate)}</b><span>{pair.mirror?'':`${pair.wins}–${pair.losses}`}</span><small>{pair.games} {pair.games===1?t('game','game'):t('games','game')}</small></button>:<span className="meta-matrix-blank" aria-label={t('No games','Belum ada game')}>–</span>}</td>;})}</tr>)}</tbody></table></div>;})()}
      </>:empty)}
      {view==='events'&&(filtered.events.length?<div className="meta-events-list">{filtered.events.map(event=><section key={event.id}><div className="meta-section-heading"><div><p>{dateText(event.eventDate)}{event.playerCount?` · ${event.playerCount.toLocaleString()} ${t('players','pemain')}`:''}</p><h2>{event.name}</h2></div><a href={event.sourceUrl} target="_blank" rel="noreferrer">{t('Event page','Halaman event')}<ArrowSquareOutIcon size={14}/></a></div>{event.finishes.length?<div className="meta-event-finishes">{event.finishes.filter(finish=>matchesColor(leaders.find(leader=>leader.code===finish.leaderCode)?.color??'',filters.color)).map(finish=><article className="meta-event-finish" key={finish.id}><strong>#{finish.place}</strong><CardTrigger card={cardByCode.get(finish.leaderCode??'')} code={finish.leaderCode??''} name={nameFor(finish.leaderCode??'')} onOpen={openCard}/><button type="button" className="meta-event-finish-open" onClick={()=>setSelectedDeck({...finish,eventName:event.name,eventDate:event.eventDate})}><span><b>{finish.playerName}</b><small>{finish.leaderCode?nameFor(finish.leaderCode):finish.archetype}</small></span><span>{finish.cards===50?t('Decklist','Decklist'):t('Result','Hasil')}</span></button></article>)}</div>:<div className="meta-event-matches">{filtered.records.filter(match=>match.eventId===event.id).map(match=><article className="meta-event-match" key={match.id}><span>{match.round}<small>{dateText(match.eventDate)}</small></span><CardTrigger card={cardByCode.get(match.leaderOneCode)} code={match.leaderOneCode} name={nameFor(match.leaderOneCode)} onOpen={openCard}/><CardTrigger card={cardByCode.get(match.leaderTwoCode)} code={match.leaderTwoCode} name={nameFor(match.leaderTwoCode)} onOpen={openCard}/><button type="button" className="meta-event-match-open" onClick={()=>setSelectedMatch({one:nameFor(match.leaderOneCode),two:nameFor(match.leaderTwoCode),matches:[match]})}><b>{nameFor(match.leaderOneCode)} <em>{match.scoreOne}–{match.scoreTwo}</em> {nameFor(match.leaderTwoCode)}</b></button></article>)}</div>}</section>)}</div>:empty)}
      </>}
    </div>
    <Dialog open={Boolean(selectedMatch)} onOpenChange={open=>{if(!open)setSelectedMatch(null);}}><DialogContent className="meta-results-dialog"><DialogHeader><DialogTitle>{selectedMatch?.one} {selectedMatch?.one===selectedMatch?.two?t('mirror','mirror'):`vs ${selectedMatch?.two}`}</DialogTitle><DialogDescription>{t('Tournament match results','Hasil pertandingan turnamen')}</DialogDescription></DialogHeader><div className="meta-match-results">{selectedMatch?.matches.map(match=><article key={match.id}><header><span>{match.round} · {dateText(match.eventDate)}</span><a href={match.sourceUrl} target="_blank" rel="noreferrer">{t('Watch / source','Video / sumber')}<ArrowSquareOutIcon size={14}/></a></header><p>{match.eventName}</p><div className="meta-scoreline"><div><CardTrigger card={cardByCode.get(match.leaderOneCode)} code={match.leaderOneCode} name={nameFor(match.leaderOneCode)} onOpen={openCard}/><b>{nameFor(match.leaderOneCode)}</b>{match.playerOneName&&<small>{match.playerOneName}</small>}</div><strong>{match.scoreOne}<span>–</span>{match.scoreTwo}<small>{match.seriesComplete?`BO${match.bestOf}`:t('Series in progress','Seri belum selesai')}</small></strong><div><CardTrigger card={cardByCode.get(match.leaderTwoCode)} code={match.leaderTwoCode} name={nameFor(match.leaderTwoCode)} onOpen={openCard}/><b>{nameFor(match.leaderTwoCode)}</b>{match.playerTwoName&&<small>{match.playerTwoName}</small>}</div></div>{match.summary&&<details className="meta-match-notes"><summary>{t('Game by game','Per game')}<span>{t('Round results and key turns','Hasil tiap game dan momen penting')}</span></summary><MatchBreakdown text={match.summary}/></details>}</article>)}</div></DialogContent></Dialog>
    <Dialog open={Boolean(selectedDeck)} onOpenChange={open=>{if(!open)setSelectedDeck(null);}}><DialogContent className="meta-deck-dialog"><DialogHeader><DialogTitle>#{selectedDeck?.place} · {selectedDeck?.playerName}</DialogTitle><DialogDescription>{selectedDeck?.eventName}</DialogDescription></DialogHeader>{selectedDeck&&<><div className="meta-deck-dialog-actions"><a href={selectedDeck.deckSourceUrl} target="_blank" rel="noreferrer">{t('Deck source','Sumber deck')}<ArrowSquareOutIcon size={14}/></a>{deckList.length>0&&<Link href={`/decks/builder?${sharedDeckSearch({leaderCode:selectedDeck.leaderCode??undefined,title:`${selectedDeck.playerName} · ${nameFor(selectedDeck.leaderCode??'')}`,entries:deckList})}`}>{t('Open in deck builder','Buka di deck builder')}</Link>}</div>{deckList.length?<div className="meta-deck-card-grid">{deckList.map(card=><article key={card.code}><CardTrigger card={cardByCode.get(card.code)} code={card.code} name={cardByCode.get(card.code)?.name??card.code} quantity={card.quantity} onOpen={openCard}/><span>{cardByCode.get(card.code)?.name??card.code}</span><small>{card.code} · {card.quantity}×</small></article>)}</div>:<p className="meta-inline-empty">{t('The decklist is available on the linked event page.','Decklist tersedia di halaman event pada tautan di atas.')}</p>}</>}</DialogContent></Dialog>
    {cardPreview&&feed?.cards?.length&&typeof document!=='undefined'&&createPortal(<CardPreviewModal card={cardPreview.card} origin={cardPreview.origin} language="EN" cards={feed.cards} context="catalog" onClose={()=>setCardPreview(null)} onNavigate={card=>setCardPreview(current=>current?{...current,card}:null)}/>,document.body)}
  </main>;
}
