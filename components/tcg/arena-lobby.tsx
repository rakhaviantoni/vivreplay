'use client';

import Link from 'next/link';
import {PlayCircleIcon, GameControllerIcon, RobotIcon, SparkleIcon, SwordIcon, TrophyIcon, UsersThreeIcon} from '@phosphor-icons/react';

type ModeIconName='trophy'|'players'|'sparkle'|'sword'|'controller'|'robot';
const modes=[
  {title:'Ranked',eyebrow:'Competitive',copy:'Bring a finished deck and climb with every match.',icon:'trophy' as ModeIconName,tone:'gold',action:'Sign in to play'},
  {title:'Friendly',eyebrow:'Competitive',copy:'Test a deck with another player without the ladder.',icon:'players' as ModeIconName,tone:'blue',action:'Sign in to play'},
  {title:'New cards',eyebrow:'Casual',copy:'Try the newest additions before they settle into the meta.',icon:'sparkle' as ModeIconName,tone:'green',action:'Sign in to play'},
  {title:'Extended',eyebrow:'Casual',copy:'Build beyond the current format and explore more lines.',icon:'sword' as ModeIconName,tone:'rose',action:'Sign in to play'},
  {title:'Solo practice',eyebrow:'Practice',copy:'Run both sides of the table and replay a decision.',icon:'controller' as ModeIconName,tone:'slate',href:'/play/board',action:'Open table'},
  {title:'Solo vs AI',eyebrow:'Practice',copy:'A guided opponent is being prepared for the Arena.',icon:'robot' as ModeIconName,tone:'violet',action:'Coming soon'},
];

function ModeIcon({name}:{name:ModeIconName}){switch(name){
  case 'trophy': return <TrophyIcon size={25}/>;
  case 'players': return <UsersThreeIcon size={25}/>;
  case 'sparkle': return <SparkleIcon size={25}/>;
  case 'sword': return <SwordIcon size={25}/>;
  case 'controller': return <GameControllerIcon size={25}/>;
  case 'robot': return <RobotIcon size={25}/>;
}}

export function ArenaLobby(){return <main className="arena-lobby"><section className="arena-tutorial-intro"><div><p><SparkleIcon size={15}/> Learn to play</p><h1>Make your first move with confidence.</h1><span>Sixteen short lessons take you from the table layout to your first online game.</span><div className="arena-progress" aria-label="Tutorial progress"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div><Link href="/play/tutorial" className="arena-start-tutorial">Start tutorial <PlayCircleIcon size={18}/></Link></section><section className="arena-lobby-heading"><div><p>Arena</p><h2>Choose how you want to play.</h2></div><Link href="/decks/builder">Build a deck</Link></section><section className="arena-mode-grid" aria-label="Arena modes">{modes.map(mode=>{const content=<><span className="arena-mode-icon"><ModeIcon name={mode.icon}/></span><p>{mode.eyebrow}</p><h3>{mode.title}</h3><span>{mode.copy}</span><b>{mode.action}</b></>;return ('href' in mode && mode.href)?<Link key={mode.title} href={mode.href} className={`arena-mode ${mode.tone}`}>{content}</Link>:<article key={mode.title} className={`arena-mode ${mode.tone}`} aria-label={`${mode.title}: ${mode.action}`}>{content}</article>})}</section></main>}

const tutorialChapters=['Basics: the table','The cards','The game begins','Your first action','Play a Character','Attack!','When you can attack','Blockers','Counters','Triggers','Choosing targets','Abilities','Keywords and costs','The table itself','The turn and its phases','Playing online'];
export function ArenaTutorialIndex(){return <main className="arena-tutorial-index"><header><p><SparkleIcon size={15}/> Learn to play</p><h1>Tutorial</h1><span>Learn one chapter at a time, then put it into practice.</span><div className="tutorial-progress"><i/><b>0 of 16 complete</b></div></header><section className="tutorial-chapter-grid">{tutorialChapters.map((title,index)=>index===0?<Link href="/play/table" key={title} className="tutorial-chapter active"><b>1</b><span>{title}</span><em>Start <PlayCircleIcon size={15}/></em></Link>:<article key={title} className="tutorial-chapter locked"><b>{index+1}</b><span>{title}</span><em>Locked</em></article>)}</section><Link className="tutorial-back" href="/play">Back to Arena</Link></main>}
