import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {runD1AuditQuery} from './d1-audit-reader';
import {beginTurn,declareAttack,effectiveCardPower,finishTurn,playCard,resolveBattle,type MatchCard,type MatchEffectState,type PlayerId} from '../packages/domain/match-effect-state';

type SnapshotCard={code:string;name:string;color:string;cardType:'Character'|'Leader'|'Event'|'Stage';cost:number;power:number;printedText:string;localSchema:{ast:unknown[]}|null};
type TournamentFinish={id:string;place:number;leaderCode:string;archetype:string|null;event:string;eventDate:string;player:string;source:string};
type TournamentCard={code:string;quantity:number};
const seed=Number(process.argv[2]??20261018)>>>0;
const requestedMatchId=process.argv.slice(3).find(value=>value.startsWith('--match='))?.slice('--match='.length);
let randomState=seed;
const random=()=>{randomState=(randomState*1664525+1013904223)>>>0;return randomState/0x1_0000_0000;};
const esc=(value:string)=>value.replaceAll("'","''");
const localDb=process.env.VIVREPLAY_LOCAL_D1;
const query=<T>(sql:string):T[]=>localDb?JSON.parse(execFileSync('sqlite3',['-json',localDb,sql],{encoding:'utf8'})) as T[]:runD1AuditQuery<T>(sql);
const allFinishes=query<TournamentFinish>(`SELECT f.id,f.place,f.leader_code AS leaderCode,f.archetype,e.name AS event,e.event_date AS eventDate,f.player_name AS player,f.deck_source_url AS source FROM tournament_finishes f JOIN tournament_events e ON e.id=f.event_id WHERE f.list_status='VERIFIED' AND f.leader_code IS NOT NULL AND e.game_slug='onepiece' AND (SELECT COALESCE(SUM(quantity),0) FROM tournament_deck_cards c WHERE c.finish_id=f.id)=50 ORDER BY e.event_date DESC,f.place ASC LIMIT 100`);
const summary= requestedMatchId ? query<{id:string;round:string;leader_one_code:string;leader_two_code:string;archetype_one:string;archetype_two:string;score_one:number;score_two:number;winner_leader_code:string;winner_side:number;summary:string;event:string;event_date:string;source_url:string}>(`SELECT m.id,m.round,m.leader_one_code,m.leader_two_code,m.archetype_one,m.archetype_two,m.score_one,m.score_two,m.winner_leader_code,m.winner_side,m.summary,e.name AS event,e.event_date,m.source_url FROM tournament_match_summaries m JOIN tournament_events e ON e.id=m.event_id WHERE m.id='${esc(requestedMatchId)}' LIMIT 1`)[0] : undefined;
if(requestedMatchId&&!summary)throw new Error(`Tournament match summary ${requestedMatchId} was not found in D1.`);
const leaderCodes=summary?[summary.leader_one_code,summary.leader_two_code]:[...new Set(allFinishes.map(row=>row.leaderCode))].slice(0,2);
if(leaderCodes.length<2||leaderCodes[0]===leaderCodes[1])throw new Error('This reconstruction needs two distinct Leaders. For mirror match records, choose another summary or provide distinct lists.');
const picked=leaderCodes.map(leaderCode=>allFinishes.filter(row=>row.leaderCode===leaderCode).sort((a,b)=>a.place-b.place)[0]).filter((row):row is TournamentFinish=>Boolean(row));
if(picked.length<2)throw new Error('No verified 50-card representative tournament deck exists for both Leaders in D1.');
const deckRows=picked.map(finish=>({finish,cards:query<TournamentCard>(`SELECT card_code AS code,quantity FROM tournament_deck_cards WHERE finish_id='${esc(finish.id)}' ORDER BY card_code`)}));
const allCodes=[...new Set([...picked.map(row=>row.leaderCode),...deckRows.flatMap(row=>row.cards.map(card=>card.code))])];
let byCode:Map<string,SnapshotCard>;
if(localDb){const snapshot=JSON.parse(readFileSync('reports/effects/per-card-d1.json','utf8')) as {cards:SnapshotCard[]};byCode=new Map(snapshot.cards.map(row=>[row.code,row]));}
else{
 const identities=query<{id:string;code:string;name:string;color:string;card_type:SnapshotCard['cardType'];cost:number;power:number;effect_text:string}>(`SELECT id,code,name,color,card_type,cost,power,effect_text FROM tcg_card_identities WHERE code IN (${allCodes.map(code=>`'${esc(code)}'`).join(',')})`);
 const ruleset=query<{id:string}>("SELECT id FROM tcg_rulesets WHERE status='published' AND effective_from<=date('now') ORDER BY effective_from DESC LIMIT 1")[0];if(!ruleset)throw new Error('D1 has no active published ruleset.');
 const revisions=query<{identity_id:string;effect_schema:{ast:unknown[]}|string}>(`SELECT identity_id,effect_schema FROM tcg_card_rule_revisions WHERE ruleset_id='${esc(ruleset.id)}' AND identity_id IN (${identities.map(row=>`'${esc(row.id)}'`).join(',')})`);
 const schemas=new Map(revisions.map(row=>[row.identity_id,typeof row.effect_schema==='string'?JSON.parse(row.effect_schema):row.effect_schema]));
 byCode=new Map(identities.map(row=>[row.code,{code:row.code,name:row.name,color:row.color,cardType:row.card_type,cost:row.cost,power:row.power,printedText:row.effect_text,localSchema:schemas.get(row.id)??null}]));
}
const selectedLeaders={player:byCode.get(picked[0].leaderCode)!,opponent:byCode.get(picked[1].leaderCode)!};
if(!selectedLeaders.player||!selectedLeaders.opponent)throw new Error('A tournament Leader is missing from the card catalog snapshot.');
const gameOneSummary=summary?.summary.split(/\bGame\s*2\b/i)[0]??'';
const strategicLine=gameOneSummary.match(/(?:starv\w*|withhold\w* attacks?|hold(?:ing)? back attacks?|deny\w* (?:the opponent'?s )?life|remove\w* (?:the )?board|clear\w* (?:the )?board|control\w* the board)/i)?.[0];
let starvationSide:PlayerId|undefined;
if(strategicLine){const position=gameOneSummary.toLowerCase().indexOf(strategicLine.toLowerCase()),prefix=gameOneSummary.slice(Math.max(0,position-180),position).toLowerCase();const alias=(archetype:string)=>archetype.split(/[ /]+/).filter(word=>word.length>=4).at(-1)?.toLowerCase()??'';const p=prefix.lastIndexOf(alias(summary?.archetype_one??'')),o=prefix.lastIndexOf(alias(summary?.archetype_two??''));if(p>=0||o>=0)starvationSide=p>o?'player':'opponent';}
const firstPhrase=gameOneSummary.match(/([A-Za-z.D'’ -]+?)\s+(?:chooses? to go|goes) first\b/i)?.[1]?.trim().toLowerCase();
const explicitFirst=firstPhrase&&(summary?.archetype_one.toLowerCase().includes(firstPhrase)||summary?.leader_one_code.toLowerCase().includes(firstPhrase))?'player':firstPhrase&&(summary?.archetype_two.toLowerCase().includes(firstPhrase)||summary?.leader_two_code.toLowerCase().includes(firstPhrase))?'opponent':undefined;
const firstOwner=explicitFirst??(random()<.5?'player':'opponent');
function makeDeck(entries:typeof deckRows[number]['cards']){const list=entries.flatMap(entry=>{const card=byCode.get(entry.code);if(!card)throw new Error(`Card catalog snapshot lacks tournament card ${entry.code}.`);if(entry.quantity<1||entry.quantity>4)throw new Error(`Invalid tournament quantity for ${entry.code}: ${entry.quantity}.`);return Array.from({length:entry.quantity},()=>card);});if(list.length!==50)throw new Error(`Verified tournament deck ${list.length}/50 failed the simulation guard.`);for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}
const sourceDecks={player:makeDeck(deckRows[0].cards),opponent:makeDeck(deckRows[1].cards)};
const mentionedCardCodes=new Set((['player','opponent'] as const).flatMap(owner=>sourceDecks[owner].filter(card=>card.name.length>=4&&gameOneSummary.toLowerCase().includes(card.name.toLowerCase())).map(card=>card.code)));
const initialCards:MatchCard[]=[];
for(const owner of ['player','opponent'] as const){
 const leader=selectedLeaders[owner];initialCards.push({id:`${owner}-leader`,owner,zone:'leader',type:'Leader',name:leader.name,code:leader.code,color:leader.color,power:leader.power,effectText:leader.printedText,effectSchema:leader.localSchema as never});
 const deck=sourceDecks[owner];
 deck.forEach((card,index)=>initialCards.push({id:`${owner}-${card.code}-${index}`,owner,zone:index<5?'hand':index<10?'life':'deck',type:card.cardType,name:card.name,code:card.code,color:card.color,cost:card.cost,power:card.power,effectText:card.printedText,effectSchema:card.localSchema as never}));
 for(let index=0;index<10;index++)initialCards.push({id:`${owner}-don-${index}`,owner,zone:'don-deck',type:'DON!!'});
}
let state:MatchEffectState={cards:initialCards,turn:'player',turnEffects:[],restrictions:[],delayed:[],phase:'main',turnNumber:0,firstPlayer:'player',playedThisTurn:[]};
const trace:Array<{turn:number;player:PlayerId;plays:string[];attacks:Array<{attacker:string;power:number;lifeTaken:number;target:string;targetSide:PlayerId}>;life:{player:number;opponent:number};board:Record<PlayerId,{leader:string;leaderRested:boolean;leaderPower:number;characters:Array<{code:string;power:number;rested:boolean;attachedDon:number}>;stage:string|null;hand:string[];trash:string[];deck:number;don:{active:number;rested:number;attached:number;deck:number}}>} > = [];
const boardSnapshot=():Record<PlayerId,{leader:string;leaderRested:boolean;leaderPower:number;characters:Array<{code:string;power:number;rested:boolean;attachedDon:number}>;stage:string|null;hand:string[];trash:string[];deck:number;don:{active:number;rested:number;attached:number;deck:number}}>=>Object.fromEntries((['player','opponent'] as const).map(owner=>{const owned=state.cards.filter(card=>card.owner===owner),leader=owned.find(card=>card.zone==='leader');return[owner,{leader:leader?.code??'',leaderRested:Boolean(leader?.rested),leaderPower:leader?effectiveCardPower(state,leader.id):0,characters:owned.filter(card=>card.zone==='character').map(card=>({code:card.code??'',power:effectiveCardPower(state,card.id),rested:Boolean(card.rested),attachedDon:owned.filter(don=>don.type==='DON!!'&&don.attachedTo===card.id).length})),stage:owned.find(card=>card.zone==='stage')?.code??null,hand:owned.filter(card=>card.zone==='hand').map(card=>card.code??''),trash:owned.filter(card=>card.zone==='trash').map(card=>card.code??''),deck:owned.filter(card=>card.zone==='deck').length,don:{active:owned.filter(card=>card.type==='DON!!'&&card.zone==='cost-area'&&!card.rested&&!card.attachedTo).length,rested:owned.filter(card=>card.type==='DON!!'&&card.zone==='cost-area'&&card.rested&&!card.attachedTo).length,attached:owned.filter(card=>card.type==='DON!!'&&card.zone==='cost-area'&&Boolean(card.attachedTo)).length,deck:owned.filter(card=>card.type==='DON!!'&&card.zone==='don-deck').length}}]})) as Record<PlayerId,{leader:string;leaderRested:boolean;leaderPower:number;characters:Array<{code:string;power:number;rested:boolean;attachedDon:number}>;stage:string|null;hand:string[];trash:string[];deck:number;don:{active:number;rested:number;attached:number;deck:number}}>;
let winner:PlayerId|undefined;let stopReason='turn-cap';
for(let turn=1;turn<=60&&!winner;turn++){
 const actor:PlayerId=(turn%2===1)=== (firstOwner==='player')?'player':'opponent';const start=beginTurn(state,actor,turn);state=start.state;
 if(start.gameOver){winner=start.gameOver;stopReason='deck-out-at-turn-start';break;}
 const plays:string[]=[];
 for(;;){
  const readyDon=state.cards.filter(card=>card.owner===actor&&card.type==='DON!!'&&card.zone==='cost-area'&&!card.rested&&!card.attachedTo).length;
  const hand=state.cards.filter(card=>card.owner===actor&&card.zone==='hand'&&['Character','Stage','Event'].includes(card.type??'')).sort((a,b)=>(b.cost??0)-(a.cost??0));
  const playable=hand.filter(card=>(card.cost??Infinity)<=readyDon&&(card.type==='Character'||card.type==='Stage')&&state.cards.filter(item=>item.owner===actor&&item.zone===(card.type==='Stage'?'stage':'character')).length<(card.type==='Stage'?1:5));
  const candidate=playable.find(card=>mentionedCardCodes.has(card.code??''))??playable.sort((a,b)=>(b.cost??0)-(a.cost??0))[0];
  if(!candidate)break;const result=playCard(state,actor,candidate.id);if(result.error||result.requiresSelection)break;state=result.state;plays.push(`${candidate.code} ${candidate.cost}c`);
 }
 const attacks:Array<{attacker:string;power:number;lifeTaken:number;target:string;targetSide:PlayerId}>=[];const enemy:PlayerId=actor==='player'?'opponent':'player';
 const attackers=state.cards.filter(card=>card.owner===actor&&(card.zone==='leader'||card.zone==='character')&&!card.rested);
 for(const attacker of attackers){
  const characters=state.cards.filter(card=>card.owner===enemy&&card.zone==='character'&&card.rested).sort((a,b)=>(a.cost??0)-(b.cost??0));
  const protectLife=actor===starvationSide&&turn<=4,boardFocus=Boolean(strategicLine&&/starv|withhold|hold back|deny|remov|clear|control/i.test(strategicLine));
  const target=(protectLife||boardFocus?characters[0]:undefined)??(protectLife?undefined:state.cards.find(card=>card.owner===enemy&&card.zone==='leader'));if(!target)continue;
  const declaration=declareAttack(state,actor,attacker.id,target.id);if(declaration.error)continue;state=declaration.state;
  const before=state.cards.filter(card=>card.owner===enemy&&card.zone==='life').length;const battle=resolveBattle(state,attacker.id,target.id);if(battle.error)continue;state=battle.state;
  const after=state.cards.filter(card=>card.owner===enemy&&card.zone==='life').length;attacks.push({attacker:attacker.code??'Leader',power:effectiveCardPower(state,attacker.id),lifeTaken:before-after,target:target.code??'Leader',targetSide:enemy});if(battle.gameOver){winner=actor;stopReason='leader-damage-at-zero-life';break;}
 }
 trace.push({turn,player:actor,plays,attacks,life:{player:state.cards.filter(card=>card.owner==='player'&&card.zone==='life').length,opponent:state.cards.filter(card=>card.owner==='opponent'&&card.zone==='life').length},board:boardSnapshot()});
 if(winner)break;const ended=finishTurn(state);state=ended.state;if(ended.gameOver){winner=ended.gameOver;stopReason='deck-out-at-turn-end';break;}
}
const deckLists=Object.fromEntries((['player','opponent'] as const).map((owner,index)=>[owner,{leader:selectedLeaders[owner].code,leaderColors:selectedLeaders[owner].color,event:picked[index].event,eventDate:picked[index].eventDate,finish:picked[index].place,archetype:picked[index].archetype,player:picked[index].player,source:picked[index].source,cards:sourceDecks[owner].reduce<Record<string,number>>((counts,card)=>(counts[card.code]=(counts[card.code]??0)+1,counts),{})}]));
console.log(JSON.stringify({mode:summary?'tournament-summary-based inferred match simulation':'AI-vs-AI tournament-deck core combat smoke test',seed,turns:trace.length,winner:winner??null,stopReason,strategy:{mentionedCardsPrioritized:[...mentionedCardCodes],starvationOrBoardPressure:strategicLine??'not specified',inferredWithholdingSide:starvationSide??null},firstPlayer:{owner:firstOwner,leader:selectedLeaders[firstOwner].code,basis:explicitFirst?'explicitly stated in game-one summary':'seeded assumption because the summary does not identify who went first'},match:summary?{id:summary.id,round:summary.round,event:summary.event,eventDate:summary.event_date,recordedScore:[summary.score_one,summary.score_two],recordedWinner:summary.winner_leader_code,source:summary.source_url,summary:summary.summary,reconstruction:'The seeded engine run uses the game-one first-player detail, prioritizes cards named in that game-one narrative when those cards are available in the representative deck, and biases attacks toward the board for summaries describing board control or starvation. Exact historical actions are inferred.'}:undefined,coverage:`Uses two verified tournament lists and ${localDb?'cached local effect schemas':'the active published D1 effect schemas'} in card state. Exercises setup zones, draws, DON!! phase, normal play, attacks, battle, Life, turn rotation, and deck-out. This core simulator does not yet resolve the full card-specific choice tree, Trigger, Counter, Blocker, mulligan, or browser/DO integration.`,deckLists,trace},null,2));
