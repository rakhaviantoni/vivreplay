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

function sideClosestTo(text:string,position:number,match:MetaMatch):1|2|null{
  const candidates:Array<{side:1|2;distance:number;player:boolean}>=[];
  for(const side of [1,2] as const){
    const player=side===1?match.playerOneName:match.playerTwoName;
    for(const alias of sideAliases(match,side)){
      const pattern=alias.split(/[^a-z0-9']+/i).filter(Boolean).map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[^a-z0-9]+');
      for(const found of text.matchAll(new RegExp(`\\b${pattern}\\b`,'gi'))){
        const start=found.index??0;
        const end=start+found[0].length;
        candidates.push({side,distance:position<start?start-position:position>end?position-end:0,player:Boolean(player&&alias===player)});
      }
    }
  }
  candidates.sort((a,b)=>a.distance-b.distance||Number(b.player)-Number(a.player));
  return candidates[0]&&candidates[1]&&(candidates[1].distance!==candidates[0].distance||candidates[1].player!==candidates[0].player)?candidates[0].side:null;
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
  const heading=String.raw`(?:#{1,3}[ \t]*)?\*{0,2}Game\s+\d+\b[ \t]*(?::|[—–-]|(?:ends|repeats|is|begins|starts|opens)\b|(?=\r?\n))`;
  const normalized=summary.replace(/\r/g,'').replace(new RegExp(String.raw`\s+(?=${heading})`,'gi'),'\n\n');
  const parts=normalized.split(new RegExp(String.raw`(?=^\s*${heading})`,'gim'));
  return parts.flatMap(part=>{
    const found=part.match(/^\s*(?:#{1,3}[ \t]*)?\*{0,2}Game\s+(\d+)\b\*{0,2}[ \t]*(?::|[—–-]|(?:ends|repeats|is|begins|starts|opens)\b)?[ \t]*(?:\r?\n)?([\s\S]*)$/i);
    return found?[{number:Number(found[1]),text:found[2].trim().replace(/(?:^|\n)[ \t]*#{1,3}[ \t]*$/,'')}]:[];
  });
}

export function matchGames(match:MetaMatch):MatchGame[]{
  const sections=gameSections(match.summary);
  const games:MatchGame[]=sections.map(section=>{
    let winnerSide:1|2|null=null;
    const sentences=section.text.split(/(?<=[.!?;])\s+/);
    for(const sentence of sentences){
      const side=sideMentioned(sentence,match);
      const losingAction=/\b(?:can't|cannot|couldn't|could not|isn't able to|is unable to)\s+(?:counter|stop|defend|cover|survive|answer|match|block)\b/i.test(sentence);
      const losingSide=sideInLosingClause(sentence,match);
      if(losingSide&&losingAction){winnerSide=losingSide===1?2:1;break;}
      if(side&&losingAction){winnerSide=side===1?2:1;break;}
      const winningAction=/\b(?:wins?|won)\s+(?:(?:the|this)\s+)?(?:(?:deciding|final|first|second|last|opening)\s+)?(?:game|match|series|set|title|decider|round|battle)\b|\b(?:wins?|won)\s+(?:on|through|by|after|in|with|via|using)\b|\b(?:wins?|won)[.!?]?$|\b(?:takes?|took|claims?|claimed)\s+(?:the\s+)?(?:(?:deciding|final|first|second|last|opening)\s+)?(?:game|match|series|set|title|decider)\b|\b(?:closes?|closed)\s+(?:(?:out|with|on)\s+)?(?:(?:the|a)\s+)?(?:(?:deciding|final|last)\s+)?(?:game|match|series|set|title|decider)\b|\b(?:closes?|closed)\s+(?:with|by)\s+.{0,60}\b(?:attacks?|lethal|the win)\b|\b(?:advances?|advanced)\s+to\b|\bwinning\s+(?:the\s+)?(?:game|match|series|semifinal|final|title|decider)\b|\bto win\b/i.exec(sentence);
      if(winningAction){
        const actionPosition=/\bto win\b/i.test(sentence)?0:winningAction.index;
        winnerSide=sideClosestTo(sentence,actionPosition,match)??side;
        if(winnerSide)break;
      }
      const concedeAction=/\b(?:concedes?|conceded|surrenders?|surrendered)\b/i.exec(sentence);
      if(concedeAction){
        const concedingSide=sideClosestTo(sentence,concedeAction.index,match)??side;
        if(concedingSide){winnerSide=concedingSide===1?2:1;break;}
      }
      if(!side)continue;
      if(/\b(?:game|match|series|decider)\b.{0,40}\b(?:goes|went) to\b/i.test(sentence)){winnerSide=side;break;}
    }
    const startSentence=sentences.find(sentence=>/\b(?:go(?:es|ing)? (?:first|second)|went (?:first|second)|chooses? to go (?:first|second)|chooses? (?:first|second)|plays? (?:first|second)|starts? (?:first|second)|on the (?:play|draw))\b/i.test(sentence));
    const startSide=startSentence?sideMentioned(startSentence,match):null;
    const startsSecond=Boolean(startSentence&&/\b(?:go(?:es|ing)? second|went second|chooses? to go second|chooses? second|plays? second|starts? second|on the draw)\b/i.test(startSentence));
    const firstSide=(startSide?(startsSecond?(startSide===1?2:1):startSide):null) as 1|2|null;
    return {number:section.number,text:section.text,winnerSide,firstSide};
  });

  // Use the series score to fill a game result only when the remaining wins
  // force the outcome of the summarized games; omitted later games stay omitted.
  if(games.length&&(match.seriesComplete||match.scoreComplete)&&match.winnerSide>0){
    // A completed sweep fixes every game in a fully summarized series. This
    // also corrects false positives from recap text that mentions the losing
    // leader close to phrases such as “closes” or “cannot cover”.
    const recordedGames=match.scoreOne+match.scoreTwo;
    if(match.scoreComplete&&games.length===recordedGames&&(match.scoreOne===0||match.scoreTwo===0)){
      const sweptBy=(match.scoreOne>0?1:2) as 1|2;
      for(const game of games)game.winnerSide=sweptBy;
    }
    const remaining={1:match.scoreOne,2:match.scoreTwo};
    for(const game of games)if(game.winnerSide)remaining[game.winnerSide]--;
    const unknown=games.filter(game=>!game.winnerSide);
    const unlisted=Math.max(0,match.scoreOne+match.scoreTwo-games.length);
    if(unknown.length&&(remaining[1]>unlisted&&remaining[2]===0||remaining[2]>unlisted&&remaining[1]===0)){
      const side=(remaining[1]>unlisted?1:2) as 1|2;
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

export function leaderDetailStats(records:MetaMatch[],code:string,finishes:MetaFinish[],deckCards:MetaFeed['deckCards']){
  const leaderRecords=records.filter(match=>match.leaderOneCode===code||match.leaderTwoCode===code);
  let firstGames=0,firstWins=0,secondGames=0,secondWins=0;
  for(const match of leaderRecords){
    const side=(match.leaderOneCode===code?1:2) as 1|2;
    for(const game of matchGames(match)){
      if(!game.winnerSide||!game.firstSide)continue;
      if(game.firstSide===side){firstGames++;if(game.winnerSide===side)firstWins++;}
      else{secondGames++;if(game.winnerSide===side)secondWins++;}
    }
  }

  // Standardize each observed rival matchup to the opponents' share of seats
  // in this sample. Unobserved matchups are omitted from the weighting.
  const opponentSeats=new Map<string,number>();
  for(const match of records){
    const games=match.scoreOne+match.scoreTwo;
    opponentSeats.set(match.leaderOneCode,(opponentSeats.get(match.leaderOneCode)??0)+games);
    opponentSeats.set(match.leaderTwoCode,(opponentSeats.get(match.leaderTwoCode)??0)+games);
  }
  const opponents=[...new Set(leaderRecords.map(match=>match.leaderOneCode===code?match.leaderTwoCode:match.leaderOneCode))];
  const observed=opponents.filter(opponent=>opponent!==code&&matchup(records,code,opponent).games>0);
  const weightTotal=observed.reduce((sum,opponent)=>sum+(opponentSeats.get(opponent)??0),0);
  const adjustedRate=weightTotal?observed.reduce((sum,opponent)=>{
    const pair=matchup(records,code,opponent);
    return sum+(pair.rate??0)*(opponentSeats.get(opponent)??0);
  },0)/weightTotal:null;

  const leaderFinishes=finishes.filter(finish=>finish.leaderCode===code&&finish.cards===50);
  const deckRows=leaderFinishes.map(finish=>({finish,cards:deckCards.filter(row=>row.finishId===finish.id)}))
    .filter(row=>row.cards.reduce((sum,card)=>sum+card.quantity,0)===50);
  const signatures=new Map<string,number>();
  for(const {cards} of deckRows){
    const normalized=new Map<string,number>();
    for(const card of cards)normalized.set(card.code,(normalized.get(card.code)??0)+card.quantity);
    const signature=[...normalized].map(([cardCode,quantity])=>`${cardCode}:${quantity}`).sort().join('|');
    signatures.set(signature,(signatures.get(signature)??0)+1);
  }
  const listCount=deckRows.length;
  const effectiveLists=listCount?1/[...signatures.values()].reduce((sum,count)=>sum+(count/listCount)**2,0):0;
  return {firstGames,firstWins,secondGames,secondWins,adjustedRate,listCount,effectiveLists};
}

export function rateText(rate:number|null){return rate===null?'–':`${Math.round(rate*100)}%`;}
