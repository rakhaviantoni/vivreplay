import type {Card} from '@/packages/card-data/catalog';

export type MetaMatch={id:string;eventId:string;eventName:string;eventDate:string;round:string;bestOf:number;leaderOneCode:string;leaderTwoCode:string;archetypeOne:string;archetypeTwo:string;playerOneName:string|null;playerTwoName:string|null;scoreOne:number;scoreTwo:number;winnerSide:number;seriesComplete:number;scoreComplete:number;summary:string;sourceUrl:string;source:'tournament'|'ranked'|'casual'};
export type MetaFinish={id:string;place:number;playerName:string;leaderCode:string|null;archetype:string|null;deckSourceUrl:string;cards:number;cardCount:number};
export type MetaEvent={id:string;name:string;eventDate:string;playerCount:number|null;sourceUrl:string;finishes:MetaFinish[]};
export type MetaFeed={events:MetaEvent[];records:MetaMatch[];deckCards:{finishId:string;code:string;quantity:number}[];cards:Card[];asOf:string};
export type LeaderStat={code:string;name:string;color:string;games:number;wins:number;losses:number;series:number;seriesWins:number;players:Set<string>;topFinishes:number;decks:number;playRate:number;winRate:number|null;tier:'Above 50%'|'Around 50%'|'Below 50%'|'Small sample'};
export type MetaFilters={period:'7'|'30'|'all';source:'all'|'tournament'|'ranked'|'casual';event:string;color:string;query:string};
export type MatchGame={number:number;text:string;winnerSide:1|2|null;firstSide:1|2|null};

function sideAliases(match:MetaMatch,side:1|2){
  const code=side===1?match.leaderOneCode:match.leaderTwoCode;
  const player=side===1?match.playerOneName:match.playerTwoName;
  const archetype=side===1?match.archetypeOne:match.archetypeTwo;
  const withoutColors=archetype.replace(/^(?:(?:red|green|blue|purple|black|yellow)[\s/+-]*)+/i,'').trim();
  const nameParts=withoutColors.split(/[^a-z0-9']+/i).filter(part=>part.length>=4);
  return [...new Set([player,withoutColors,...nameParts,archetype,code].filter((value):value is string=>Boolean(value&&value.trim().length>=3)))];
}

function sideMentioned(text:string,match:MetaMatch):1|2|null{
  const normalized=text.toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const contains=(alias:string)=>{
    const name=alias.toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    return name.length>=3&&(` ${normalized} `).includes(` ${name} `);
  };
  const playerOne=match.playerOneName?contains(match.playerOneName):false;
  const playerTwo=match.playerTwoName?contains(match.playerTwoName):false;
  if(playerOne!==playerTwo)return playerOne?1:2;
  const found=(side:1|2)=>sideAliases(match,side).some(contains);
  const one=found(1),two=found(2);
  return one===two?null:one?1:2;
}

function sideInLosingClause(text:string,match:MetaMatch):1|2|null{
  for(const side of [1,2] as const){
    for(const alias of sideAliases(match,side)){
      const name=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      if(new RegExp(`\\b${name}\\b.{0,24}\\b(?:can't|cannot|couldn't|could not|isn't able to|is unable to)\\s+(?:counter|stop|defend|cover|survive|answer|match|block)\\b`,'i').test(text))return side;
    }
  }
  return null;
}

function gameSections(summary:string){
  const normalized=summary.replace(/\r/g,'').replace(/\s+(?=(?:#{1,3}\s*)?\*{0,2}Game\s+\d+\b)/gi,'\n\n');
  const parts=normalized.split(/(?=^\s*(?:#{1,3}\s*)?\*{0,2}Game\s+\d+\b)/gim);
  return parts.flatMap(part=>{
    const heading=part.match(/^\s*(?:#{1,3}\s*)?\*{0,2}Game\s+(\d+)\b\*{0,2}\s*(?:[:—–-]\s*)?([\s\S]*)$/i);
    return heading?[{number:Number(heading[1]),text:heading[2].trim()}]:[];
  });
}

export function matchGames(match:MetaMatch):MatchGame[]{
  const sections=gameSections(match.summary);
  const games:MatchGame[]=sections.map(section=>{
    let winnerSide:1|2|null=null;
    const sentences=section.text.split(/(?<=[.!?])\s+/);
    for(const sentence of sentences){
      const side=sideMentioned(sentence,match);
      const losingAction=/\b(?:can't|cannot|couldn't|could not|isn't able to|is unable to)\s+(?:counter|stop|defend|cover|survive|answer|match|block)\b/i.test(sentence);
      const losingSide=sideInLosingClause(sentence,match);
      if(losingSide&&losingAction){winnerSide=losingSide===1?2:1;break;}
      if(side&&losingAction){winnerSide=side===1?2:1;break;}
      if(!side)continue;
      if(/\b(?:wins?|won|takes?|took|taking|claims?|claimed|closes?|closed|closing|advances?|advanced|winning)\b.{0,50}\b(?:game|it|match|series|decider|title)\b/i.test(sentence)||/\b(?:game|match|series|decider)\b.{0,40}\b(?:goes|went) to\b/i.test(sentence)){winnerSide=side;break;}
      if(/\b(?:concedes?|conceded|surrenders?|surrendered)\b/i.test(sentence)){winnerSide=side===1?2:1;break;}
    }
    const startSentence=sentences.find(sentence=>/\b(?:go(?:es|ing)? (?:first|second)|went (?:first|second)|chooses? to go (?:first|second)|chooses? (?:first|second)|plays? (?:first|second)|starts? (?:first|second)|on the (?:play|draw))\b/i.test(sentence));
    const startSide=startSentence?sideMentioned(startSentence,match):null;
    const startsSecond=Boolean(startSentence&&/\b(?:go(?:es|ing)? second|went second|chooses? to go second|chooses? second|plays? second|starts? second|on the draw)\b/i.test(startSentence));
    const firstSide=(startSide?(startsSecond?(startSide===1?2:1):startSide):null) as 1|2|null;
    return {number:section.number,text:section.text,winnerSide,firstSide};
  });

  // The final game in a complete series is necessarily won by the series winner.
  if(games.length&&(match.seriesComplete||match.scoreComplete)&&match.winnerSide>0&&games.length===match.scoreOne+match.scoreTwo){
    games[games.length-1].winnerSide=match.winnerSide as 1|2;
    const remaining={1:match.scoreOne,2:match.scoreTwo};
    for(const game of games)if(game.winnerSide)remaining[game.winnerSide]--;
    const unknown=games.filter(game=>!game.winnerSide);
    if(unknown.length&&(remaining[1]===unknown.length||remaining[2]===unknown.length)){
      const side=(remaining[1]===unknown.length?1:2) as 1|2;
      for(const game of unknown)game.winnerSide=side;
    }
  }
  return games;
}

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
  let firstGames=0,firstWins=0,secondGames=0,secondWins=0;
  for(const match of matches){
    const rowSide=(key(match.leaderOneCode)===one?1:2) as 1|2;
    for(const game of matchGames(match)){
      if(!game.firstSide||!game.winnerSide)continue;
      if(game.firstSide===rowSide){firstGames++;if(game.winnerSide===rowSide)firstWins++;}
      else{secondGames++;if(game.winnerSide===rowSide)secondWins++;}
    }
  }
  return {matches,games,wins,losses:games-wins,rate:games&&one!==two?wins/games:null,series:series.length,seriesWins,firstGames,firstWins,secondGames,secondWins,turnOrderGames:firstGames+secondGames,mirror:one===two};
}

export function confidenceInterval(wins:number,games:number){
  if(!games)return null;
  const z=1.96,p=wins/games,z2=z*z,denominator=1+z2/games;
  const center=(p+z2/(2*games))/denominator;
  const margin=z*Math.sqrt(p*(1-p)/games+z2/(4*games*games))/denominator;
  return {low:Math.max(0,center-margin),high:Math.min(1,center+margin),margin};
}

export function rateText(rate:number|null){return rate===null?'–':`${Math.round(rate*100)}%`;}
