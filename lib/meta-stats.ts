import type {Card} from '@/packages/card-data/catalog';

export type MetaMatch={id:string;eventId:string;eventName:string;eventDate:string;round:string;bestOf:number;leaderOneCode:string;leaderTwoCode:string;archetypeOne:string;archetypeTwo:string;playerOneName:string|null;playerTwoName:string|null;scoreOne:number;scoreTwo:number;winnerSide:number;seriesComplete:number;scoreComplete:number;summary:string;sourceUrl:string;source:'tournament'|'ranked'|'casual'};
export type MetaFinish={id:string;place:number;playerName:string;leaderCode:string|null;archetype:string|null;deckSourceUrl:string;cards:number;cardCount:number};
export type MetaEvent={id:string;name:string;eventDate:string;playerCount:number|null;sourceUrl:string;finishes:MetaFinish[]};
export type MetaFeed={events:MetaEvent[];records:MetaMatch[];deckCards:{finishId:string;code:string;quantity:number}[];cards:Card[];asOf:string};
export type LeaderStat={code:string;name:string;color:string;games:number;wins:number;losses:number;series:number;seriesWins:number;players:Set<string>;topFinishes:number;decks:number;playRate:number;winRate:number|null;tier:'Above 50%'|'Around 50%'|'Below 50%'|'Small sample'};
export type MetaFilters={period:'7'|'30'|'all';source:'all'|'tournament'|'ranked'|'casual';event:string;color:string;query:string};

export function inPeriod(date:string,period:MetaFilters['period'],asOf:string){
  if(period==='all')return true;
  const time=Date.parse(`${date.slice(0,10)}T00:00:00Z`);
  const end=Date.parse(asOf);
  return Number.isFinite(time)&&time>=end-Number(period)*86400000&&time<=end;
}

export function filterMeta(feed:MetaFeed,filters:MetaFilters){
  const events=feed.events.filter(event=>inPeriod(event.eventDate,filters.period,feed.asOf)&&(filters.event==='all'||filters.event===event.id));
  const eventIds=new Set(events.map(event=>event.id));
  const records=feed.records.filter(match=>inPeriod(match.eventDate,filters.period,feed.asOf)&&(filters.source==='all'||match.source===filters.source)&&(filters.event==='all'||match.eventId===filters.event));
  return {events:filters.source==='ranked'||filters.source==='casual'?[]:events,records,deckCards:feed.deckCards.filter(card=>events.some(event=>eventIds.has(event.id)&&event.finishes.some(finish=>finish.id===card.finishId)))};
}

export function leaderStats(feed:MetaFeed,records:MetaMatch[],events:MetaEvent[]):LeaderStat[]{
  const cards=new Map(feed.cards.map(card=>[card.code,card]));
  const stats=new Map<string,LeaderStat>();
  const get=(code:string,archetype:string)=>{
    let stat=stats.get(code);
    if(!stat){const card=cards.get(code);stat={code,name:card?.name??archetype.split(' · ')[0],color:card?.color??archetype.match(/^(Red|Green|Blue|Purple|Black|Yellow)(?:\/(Red|Green|Blue|Purple|Black|Yellow))?/)?.[0]??'',games:0,wins:0,losses:0,series:0,seriesWins:0,players:new Set(),topFinishes:0,decks:0,playRate:0,winRate:null,tier:'Small sample'};stats.set(code,stat);}
    return stat;
  };
  for(const match of records){
    const games=match.scoreOne+match.scoreTwo;
    for(const side of [1,2]){
      const stat=get(side===1?match.leaderOneCode:match.leaderTwoCode,side===1?match.archetypeOne:match.archetypeTwo);
      const wins=side===1?match.scoreOne:match.scoreTwo;
      stat.games+=games;stat.wins+=wins;stat.losses+=games-wins;
      if(match.seriesComplete&&match.winnerSide>0){stat.series++;stat.seriesWins+=match.winnerSide===side?1:0;}
      const player=side===1?match.playerOneName:match.playerTwoName;
      if(player)stat.players.add(player.trim().toLowerCase());
    }
  }
  for(const event of events)for(const finish of event.finishes){
    if(!finish.leaderCode)continue;
    const stat=get(finish.leaderCode,finish.archetype??finish.leaderCode);
    stat.topFinishes+=finish.place<=8?1:0;stat.decks+=finish.cards===50?1:0;
  }
  const appearances=[...stats.values()].reduce((sum,stat)=>sum+stat.games,0);
  return [...stats.values()].map(stat=>{
    stat.playRate=appearances?stat.games/appearances:0;
    if(stat.games){
      stat.winRate=stat.wins/stat.games;
      const z=1.96,n=stat.games,p=stat.winRate;
      const center=(p+z*z/(2*n))/(1+z*z/n),margin=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/(1+z*z/n);
      if(n>=20)stat.tier=center-margin>.5?'Above 50%':center+margin<.5?'Below 50%':'Around 50%';
    }
    return stat;
  });
}

export function matchup(records:MetaMatch[],one:string,two:string,key:(code:string)=>string=code=>code){
  const matches=records.filter(match=>(key(match.leaderOneCode)===one&&key(match.leaderTwoCode)===two)||(key(match.leaderOneCode)===two&&key(match.leaderTwoCode)===one));
  const games=matches.reduce((sum,match)=>sum+match.scoreOne+match.scoreTwo,0);
  const wins=matches.reduce((sum,match)=>sum+(key(match.leaderOneCode)===one?match.scoreOne:match.scoreTwo),0);
  const series=matches.filter(match=>match.seriesComplete&&match.winnerSide>0);
  const seriesWins=series.filter(match=>(key(match.leaderOneCode)===one?1:2)===match.winnerSide).length;
  return {matches,games,wins,losses:games-wins,rate:games&&one!==two?wins/games:null,series:series.length,seriesWins,mirror:one===two};
}

export function rateText(rate:number|null){return rate===null?'–':`${Math.round(rate*100)}%`;}
