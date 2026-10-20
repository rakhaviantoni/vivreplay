'use client';

import Link from 'next/link';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeftIcon,PauseIcon,PlayIcon,SkipBackIcon,SkipForwardIcon,ArrowsDownUpIcon,SpeakerHighIcon,SpeakerSlashIcon} from '@phosphor-icons/react';
import {CardArt} from './card-art';
import {Back,BattleTableFrame,CostArea,PlayCard,ZoneArtwork,matMarks,matTones,Dice,ShowdownEffect,showdownDieValue} from './play-tutorial';
import {CardPreviewModal} from './card-preview-modal';
import {playReplayCue,setReplayShowdownActive,setReplaySoundEnabled} from '@/lib/replay-audio';
import type {Card} from '@/packages/card-data/catalog';
import '@/app/playmat.css';

type Side={leader:string;leaderRested?:boolean;leaderPower?:number;characters:{code:string;power:number;rested:boolean;attachedDon:number}[];stage:string|null;hand:string[];trash:string[];deck:number;don:{active:number;rested:number;attached:number;deck:number}};
type Turn={turn:number;player:'player'|'opponent';plays:string[];attacks:{attacker:string;power:number;lifeTaken:number;target?:string;targetSide?:'player'|'opponent'}[];life:{player:number;opponent:number};board:Record<'player'|'opponent',Side>};
type Replay={source:{id:string;round:string;event:string;eventDate:string;recordedScore:number[];recordedWinner:string;sourceUrl:string};reconstruction:{turns:number;simulatedWinner:string|null;firstPlayer:{owner:string;leader:string;basis:string};deckLists:Record<'player'|'opponent',{leader:string;archetype:string;event:string;eventDate:string;finish:number;player:string;source:string;cards:Record<string,number>}>;trace:Turn[]}};
type FeedCard={id:string;rarity:string;variant?:string;set_code:string;printing_code:string;language:string;card_image_url:string|null;counter_amount:number|null;tcg_card_identities:{code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string};tcg_card_assets?:{object_key:string}[]};
type MotionFlight={id:string;card:Card;fromX:number;fromY:number;deltaX:number;deltaY:number;delay:number;width:number;height:number;fromScale:number;targetIndex?:number;startRotation?:number;endRotation?:number};
type ReplayTransition={kind:'return'|'trash'|'attach'|'bottom';code:string;side:'player'|'opponent';handIndex?:number;boardIndex?:number;trashIndex?:number;characterIndex?:number;donSlot?:number;attachedIndex?:number};
function cardsAddedToHand(previous:string[],current:string[]){
 const remaining=[...previous];
 return current.flatMap((code,index)=>{const match=remaining.indexOf(code);if(match>=0){remaining.splice(match,1);return []}return [{code,index}]});
}
function boardTransitions(previous:Turn,current:Turn):ReplayTransition[]{
 const transitions:ReplayTransition[]=[];
 for(const side of ['player','opponent'] as const){
  const before=previous.board[side],after=current.board[side];
  const removedCharacters=before.characters.flatMap((character,index)=>{const priorCopies=before.characters.slice(0,index+1).filter(card=>card.code===character.code).length;const nextCopies=after.characters.filter(card=>card.code===character.code).length;return priorCopies>nextCopies?[{code:character.code,index}]:[]});
  const gainedHand=cardsAddedToHand(before.hand,after.hand),gainedTrash=cardsAddedToHand(before.trash,after.trash);
  const available=[...removedCharacters];
  for(const moved of gainedHand){
   const sourceIndex=available.findIndex(character=>character.code===moved.code);
   if(sourceIndex>=0){const [source]=available.splice(sourceIndex,1);transitions.push({kind:'return',code:moved.code,side,handIndex:moved.index,boardIndex:source.index})}
  }
  if(before.stage&&before.stage!==after.stage){
   const handIndex=gainedHand.findIndex(card=>card.code===before.stage);
   if(handIndex>=0){const [moved]=gainedHand.splice(handIndex,1);transitions.push({kind:'return',code:moved.code,side,handIndex:moved.index,boardIndex:-2})}
  }
  const discardedFromHand=cardsAddedToHand(after.hand,before.hand);
  const sourceForTrash=(code:string)=>{const characterIndex=available.findIndex(character=>character.code===code);if(characterIndex>=0){const [source]=available.splice(characterIndex,1);return {boardIndex:source.index}}const stageWasRemoved=before.stage===code&&after.stage!==code;if(stageWasRemoved)return {boardIndex:-2};const handIndex=discardedFromHand.findIndex(card=>card.code===code);if(handIndex>=0){const [source]=discardedFromHand.splice(handIndex,1);return {handIndex:source.index}}return undefined};
  for(const moved of gainedTrash){const source=sourceForTrash(moved.code);if(source)transitions.push({kind:'trash',code:moved.code,side,trashIndex:moved.index,...source})}
  const afterTrashRemoved=cardsAddedToHand(after.trash,before.trash);
  for(const moved of gainedHand){if(transitions.some(event=>event.kind==='return'&&event.side===side&&event.handIndex===moved.index))continue;const trashIndex=afterTrashRemoved.findIndex(card=>card.code===moved.code);if(trashIndex>=0){const [source]=afterTrashRemoved.splice(trashIndex,1);transitions.push({kind:'return',code:moved.code,side,handIndex:moved.index,trashIndex:source.index})}}
  for(let index=0;index<after.characters.length;index++){
   const character=after.characters[index],copyIndex=after.characters.slice(0,index+1).filter(card=>card.code===character.code).length-1;
   const prior=before.characters.filter(card=>card.code===character.code)[copyIndex];
   const attached=Math.max(0,character.attachedDon-(prior?.attachedDon??0));
   for(let count=0;count<attached;count++)transitions.push({kind:'attach',code:'DON_8',side,characterIndex:index,attachedIndex:(prior?.attachedDon??0)+count,donSlot:Math.max(0,before.don.active+before.don.rested-1-count)});
  }
  const deckIncrease=after.deck-before.deck;
  if(deckIncrease>0){
   const sources=[...available];
   if(before.stage&&before.stage!==after.stage&&!transitions.some(event=>event.side===side&&event.code===before.stage)){sources.push({code:before.stage,index:-2})}
   const removedFromHand=cardsAddedToHand(after.hand,before.hand);
   for(let count=0;count<deckIncrease;count++){
    const boardSource=sources.shift();
    if(boardSource){transitions.push({kind:'bottom',code:boardSource.code,side,boardIndex:boardSource.index});continue}
    const handSource=removedFromHand.shift();
    if(handSource)transitions.push({kind:'bottom',code:handSource.code,side,handIndex:handSource.index});
   }
  }
 }
 return transitions;
}
function replayPlayedCardTarget(root:HTMLElement|null|undefined,side:'player'|'opponent',current:Turn,previous:Turn|undefined,code:string,occurrence:number){
 const matches=current.board[side].characters.flatMap((character,index)=>character.code===code?[index]:[]);
 const totalPlays=current.plays.filter(play=>play.match(/[A-Z]{2,4}\d{2,3}-\d{3}/i)?.[0]?.toUpperCase()===code).length;
 const existingCount=previous?.board[side].characters.filter(character=>character.code===code).length??Math.max(0,matches.length-totalPlays);
 const targetIndex=matches[Math.min(existingCount+occurrence,matches.length-1)];
 const row=root?.querySelector<HTMLElement>(`.${side}-side .character-row`);
 const slot=targetIndex===undefined?undefined:row?.children[targetIndex];
 const target=slot instanceof HTMLElement&&slot.classList.contains('play-card')?slot:slot?.querySelector<HTMLElement>('.play-card');
 if(target)return target;
 return current.board[side].stage===code?root?.querySelector<HTMLElement>(`.${side}-side .stage-zone .play-card`)??null:null;
}
function replayLeaderRested(replay:Replay,step:number,owner:'player'|'opponent'){
 const snapshot=replay.reconstruction.trace[step]?.board[owner];
 if(snapshot?.leaderRested!==undefined)return snapshot.leaderRested;
 for(let index=step;index>=0;index--){const turn=replay.reconstruction.trace[index];if(turn.player===owner)return turn.attacks.some(attack=>attack.attacker===turn.board[owner].leader)}
 return false;
}
export function TournamentReplayTable({matchId}:{matchId:string}){
 const [replay,setReplay]=useState<Replay>();const [cards,setCards]=useState<Map<string,Card>>(new Map());const [step,setStep]=useState(0);const [playing,setPlaying]=useState(false);const [error,setError]=useState('');const [playmatScene]=useState<'onigashima'|'elbaph'>('onigashima');const [inspected,setInspected]=useState<Card>();const [preview,setPreview]=useState<{card:Card;origin?:DOMRect}>();const [showIntro,setShowIntro]=useState(false);const [showStartingRoll,setShowStartingRoll]=useState(false);const [hasIntroRun,setHasIntroRun]=useState(false);const [soundEnabled,setSoundEnabled]=useState(false);const [dealFlights,setDealFlights]=useState<MotionFlight[]>([]);const [actionFlights,setActionFlights]=useState<Array<MotionFlight&{kind:'play'|'attack'|'block'|'counter'|'life'|'draw'|'don'|'return'|'trash'|'attach'|'bottom';side:'player'|'opponent'}>>([]);const [hiddenDealTargets,setHiddenDealTargets]=useState<string[]>([]);
 const toggleSound=()=>setSoundEnabled(current=>{const next=!current;setReplaySoundEnabled(next);return next});
 const soundButton=()=><button type="button" className="replay-sound-toggle" onClick={toggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled?'Turn replay sound off':'Turn replay sound on'} title={soundEnabled?'Turn replay sound off':'Turn replay sound on'}>{soundEnabled?<SpeakerHighIcon size={16}/>:<SpeakerSlashIcon size={16}/>}<span>Sound {soundEnabled?'on':'off'}</span></button>;
 useEffect(()=>{setReplaySoundEnabled(soundEnabled)},[soundEnabled]);
 useEffect(()=>{setReplayShowdownActive(showIntro);return()=>setReplayShowdownActive(false)},[showIntro]);
 useEffect(()=>()=>setReplaySoundEnabled(false),[]);
 useEffect(()=>{if(showIntro&&soundEnabled)playReplayCue('reveal')},[showIntro,soundEnabled]);
 useEffect(()=>{if(showStartingRoll)playReplayCue('dice')},[showStartingRoll]);
 useEffect(()=>{const abort=new AbortController();fetch('/data/tournament-inferred-replays.json',{signal:abort.signal}).then(async response=>{if(!response.ok)throw new Error('Replay report unavailable.');return await response.json() as {replays:Replay[]}}).then(data=>{const found=data.replays.find(item=>item.source.id===matchId);if(!found)throw new Error('No inferred replay exists for this match.');setReplay(found);const codes=[...new Set([...Object.keys(found.reconstruction.deckLists.player.cards),...Object.keys(found.reconstruction.deckLists.opponent.cards),found.reconstruction.deckLists.player.leader,found.reconstruction.deckLists.opponent.leader,'DON_8'])];return fetch(`/api/cards/catalog?codes=${encodeURIComponent(codes.join(','))}&language=EN`,{signal:abort.signal}).then(async response=>{if(!response.ok)throw new Error('Card artwork could not be loaded.');return await response.json() as {cards:FeedCard[]}})}).then(payload=>{if(!payload)return;setCards(new Map(payload.cards.map(row=>{const identity=row.tcg_card_identities;const card={id:row.id,code:identity.code,name:identity.name,color:identity.color,type:identity.card_type as Card['type'],cost:identity.cost??0,power:identity.power??0,counter:row.counter_amount??0,rarity:row.rarity,art:0,effect:identity.effect_text??'',imageUrl:row.card_image_url??undefined,setCode:row.set_code,language:row.language,printingCode:row.printing_code,variant:row.variant,assetPath:row.tcg_card_assets?.[0]?.object_key} as Card;return[identity.code,card] as const})));}).catch(reason=>{if(!abort.signal.aborted)setError(reason instanceof Error?reason.message:'Unable to load this replay.');});return()=>abort.abort()},[matchId]);
 useEffect(()=>{if(!playing||!replay)return;const turn=replay.reconstruction.trace[step];const previous=replay.reconstruction.trace[step-1];const actionCount=(turn?.plays.length??0)+(turn?.attacks.length??0);const owner=turn?.player??'player';const handDraw=previous&&turn&&previous.board[owner].deck>turn.board[owner].deck?1:0;const donDraw=turn?(previous?Math.max(0,previous.board[owner].don.deck-turn.board[owner].don.deck):step===0&&owner===replay.reconstruction.firstPlayer.owner?1:0):0;const damage=turn?.attacks.reduce((sum,attack)=>sum+attack.lifeTaken,0)??0;const transitions=previous&&turn?boardTransitions(previous,turn).length:0;const delay=Math.max(8000,(actionCount+handDraw+donDraw+damage+transitions+2)*1100+1800);const timer=window.setTimeout(()=>setStep(current=>{if(current>=replay.reconstruction.trace.length-1){setPlaying(false);return current}return current+1}),delay);return()=>window.clearTimeout(timer)},[playing,replay,step]);
 useEffect(()=>{if(!replay||preview||showIntro||showStartingRoll)return;const onKeyDown=(event:KeyboardEvent)=>{if(event.altKey||event.ctrlKey||event.metaKey)return;const target=event.target;if(target instanceof HTMLElement&&(target.isContentEditable||target.matches('textarea,select,input:not([type="range"])')))return;if(event.key==='ArrowLeft'){event.preventDefault();setStep(current=>Math.max(0,current-1))}else if(event.key==='ArrowRight'){event.preventDefault();setStep(current=>Math.min(replay.reconstruction.trace.length-1,current+1))}};window.addEventListener('keydown',onKeyDown);return()=>window.removeEventListener('keydown',onKeyDown)},[replay,preview,showIntro,showStartingRoll]);
 const introTimer=useRef<number|undefined>(undefined);const diceTimer=useRef<number|undefined>(undefined);const currentLayoutRects=useRef<Map<string,DOMRect>>(new Map());const previousLayoutRects=useRef<Map<string,DOMRect>>(new Map());
 const dealOpeningHand=useCallback(()=>{const first=replay?.reconstruction.trace[0];if(!first)return;const targets=['opponent','player'].flatMap(owner=>first.board[owner as 'opponent'|'player'].hand.map((_,index)=>`${owner}-${index}`));setHiddenDealTargets(targets);requestAnimationFrame(()=>{const flights:MotionFlight[]=[];for(const owner of ['opponent','player'] as const){const source=document.querySelector<HTMLElement>(`.${owner}-side .deck-zone .play-back`),from=source?.getBoundingClientRect();if(!from)continue;first.board[owner].hand.forEach((code,index)=>{const card=cards.get(code),target=document.querySelector<HTMLElement>(`[data-replay-hand="${owner}-${index}"]`),to=target?.getBoundingClientRect();if(!card||!to)return;const width=to.width||82,height=to.height||114,fromX=from.left+from.width/2,fromY=from.top+from.height/2,toX=to.left+to.width/2,toY=to.top+to.height/2,rotation=owner==='opponent'?180:0,delay=(owner==='opponent'?0:260)+index*65;flights.push({id:`deal-${owner}-${index}`,card,fromX:fromX-width/2,fromY:fromY-height/2,deltaX:toX-fromX,deltaY:toY-fromY,delay,width,height,fromScale:Math.min(1,from.width/width,from.height/height),startRotation:rotation,endRotation:rotation});window.setTimeout(()=>playReplayCue('deal',index),delay)})}setDealFlights(flights);const lastDelay=Math.max(0,...flights.map(flight=>flight.delay));window.setTimeout(()=>{setDealFlights([]);setHiddenDealTargets([])},lastDelay+950)})},[replay,cards]);
 useEffect(()=>{if(!replay||!cards.size)return;const showTimer=window.setTimeout(()=>{setHasIntroRun(false);setShowStartingRoll(false);setShowIntro(true)},0);introTimer.current=window.setTimeout(()=>{introTimer.current=undefined;setShowIntro(false);setShowStartingRoll(true);diceTimer.current=window.setTimeout(()=>{diceTimer.current=undefined;setShowStartingRoll(false);setHasIntroRun(true);dealOpeningHand()},2400)},7200);return()=>{window.clearTimeout(showTimer);if(introTimer.current)window.clearTimeout(introTimer.current);if(diceTimer.current)window.clearTimeout(diceTimer.current)}},[replay,cards.size,matchId,dealOpeningHand]);
 useLayoutEffect(()=>{
  const board=document.querySelector<HTMLElement>('.tournament-replay-screen');
  previousLayoutRects.current=currentLayoutRects.current;
  const measuredRects=new Map<string,DOMRect>();
  board?.querySelectorAll<HTMLElement>('[data-replay-hand]').forEach(node=>{if(node.dataset.replayHand)measuredRects.set(`hand:${node.dataset.replayHand}`,node.getBoundingClientRect())});
  board?.querySelectorAll<HTMLElement>('.board-side').forEach(side=>{
   const owner=side.dataset.owner;if(owner!=='player'&&owner!=='opponent')return;
   const row=side.querySelector<HTMLElement>('.character-row');
   Array.from(row?.children??[]).forEach((node,index)=>measuredRects.set(`board:${owner}:character:${index}`,(node as HTMLElement).getBoundingClientRect()));
   for(const [key,selector] of [['leader','.leader-zone > .play-card'],['stage','.stage-zone > .play-card'],['life','.life-stack > .life-back:last-child'],['deck','.deck-zone > .play-back'],['donDeck','.don-deck > .play-back'],['trash','.trash-zone .replay-trash-card']] as const){const node=side.querySelector<HTMLElement>(selector);if(node)measuredRects.set(`board:${owner}:${key}`,node.getBoundingClientRect())}
   side.querySelectorAll<HTMLElement>('.life-stack > .life-back').forEach((node,index)=>measuredRects.set(`board:${owner}:life:${index}`,node.getBoundingClientRect()));
   side.querySelectorAll<HTMLElement>('.don-cost [data-don-slot]').forEach(node=>{if(node.dataset.donSlot)measuredRects.set(`board:${owner}:don:${node.dataset.donSlot}`,node.getBoundingClientRect())});
  });
  currentLayoutRects.current=measuredRects;
  board?.querySelectorAll('.play-card.replay-hidden,[data-replay-hand].replay-hidden,[data-don-slot].replay-hidden,[data-attached-don].replay-hidden,.replay-trash-card.replay-hidden').forEach(card=>card.classList.remove('replay-hidden'));
  if(!replay||showIntro||!hasIntroRun)return;
  const current=replay.reconstruction.trace[step];
  if(!current)return;
  const previous=replay.reconstruction.trace[step-1];
  const transitions=previous?boardTransitions(previous,current):[];
  const donCount=previous?Math.max(0,previous.board[current.player].don.deck-current.board[current.player].don.deck):step===0&&current.player===replay.reconstruction.firstPlayer.owner?1:0;
  const donNodes=[...(board?.querySelectorAll<HTMLElement>(`.${current.player}-side .don-cost [data-don-slot]`)??[])];
  const donTargets=donCount?donNodes.slice(-donCount):[];
  const donTargetSet=new Set(donTargets);
  donTargets.forEach(target=>target.classList.add('replay-hidden'));
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const donAnimations:Animation[]=[];
  const stateAnimations:Animation[]=[];
  let donRotated=false;
  if(previous)for(const owner of ['player','opponent'] as const){
   const oldDon=previous.board[owner].don,newDon=current.board[owner].don;
   const oldRestedIds=new Set(Array.from({length:oldDon.rested},(_,index)=>oldDon.active+index));
   const newRestedIds=new Set(Array.from({length:newDon.rested},(_,index)=>newDon.active+index));
   const donFacing=0,restedAngle=owner==='opponent'?270:90;
   for(const id of new Set([...oldRestedIds,...newRestedIds])){
    if(oldRestedIds.has(id)===newRestedIds.has(id))continue;
    const node=board?.querySelector<HTMLElement>(`.${owner}-side .don-cost [data-don-slot="${id}"]`);
    if(!node||donTargetSet.has(node))continue;
    const wasRested=oldRestedIds.has(id),isRested=newRestedIds.has(id);
    donRotated=true;
    stateAnimations.push(node.animate([{rotate:`${donFacing+(wasRested?restedAngle:0)}deg`},{rotate:`${donFacing+(isRested?restedAngle:0)}deg`}],{duration:reducedMotion?180:520,easing:'cubic-bezier(.2,.78,.18,1)'}));
   }
   const oldRested=replayLeaderRested(replay,step-1,owner),newRested=replayLeaderRested(replay,step,owner);
   if(oldRested!==newRested){const leader=board?.querySelector<HTMLElement>(`.${owner}-side .leader-zone > .play-card`);if(leader){const facing=owner==='opponent'?180:0;stateAnimations.push(leader.animate([{rotate:`${facing+(oldRested?90:0)}deg`},{rotate:`${facing+(newRested?90:0)}deg`}],{duration:reducedMotion?180:520,easing:'cubic-bezier(.2,.78,.18,1)'}))}}
   const oldLeaderPower=previous.board[owner].leaderPower;
   const newLeaderPower=current.board[owner].leaderPower;
   if(oldLeaderPower!==undefined&&newLeaderPower!==undefined&&oldLeaderPower!==newLeaderPower){
    const leader=board?.querySelector<HTMLElement>(`.${owner}-side .leader-zone > .play-card .play-card-art .tcg-card`);
    if(leader){
     const animation=leader.animate(
      [
       {filter:'drop-shadow(0 0 0 rgb(232 187 75 / 0)) scale(.97)'},
       {filter:'drop-shadow(0 0 15px rgb(232 187 75 / .82)) scale(1.04)'},
       {filter:'drop-shadow(0 0 2px rgb(232 187 75 / .08)) scale(1)'},
      ],
      {duration:reducedMotion?180:560,easing:'cubic-bezier(.2,.78,.18,1)'},
     );
     stateAnimations.push(animation);
    }
   }
   current.board[owner].characters.forEach((character,index)=>{
    const copyIndex=current.board[owner].characters.slice(0,index+1).filter(card=>card.code===character.code).length-1;
    const old=previous.board[owner].characters.filter(card=>card.code===character.code)[copyIndex];
    if(!old)return;
    const row=board?.querySelector<HTMLElement>(`.${owner}-side .character-row`),slot=row?.children[index];
    const target=slot instanceof HTMLElement?(slot.classList.contains('play-card')?slot:slot.querySelector<HTMLElement>('.play-card')):null;
    if(!target)return;
    const facing=owner==='opponent'?180:0;
    if(old.rested!==character.rested)stateAnimations.push(target.animate([{rotate:`${facing+(old.rested?90:0)}deg`},{rotate:`${facing+(character.rested?90:0)}deg`}],{duration:reducedMotion?180:520,easing:'cubic-bezier(.2,.78,.18,1)'}));
    if(old.power!==character.power||old.attachedDon!==character.attachedDon){const art=target.querySelector<HTMLElement>('.play-card-art .tcg-card');if(art)stateAnimations.push(art.animate([{filter:'drop-shadow(0 0 0 rgb(232 187 75 / 0)) scale(.96)'},{filter:'drop-shadow(0 0 15px rgb(232 187 75 / .82)) scale(1.045)'},{filter:'drop-shadow(0 0 2px rgb(232 187 75 / .08)) scale(1)'}],{duration:reducedMotion?180:560,easing:'cubic-bezier(.2,.78,.18,1)'}))}
   });
  }
  if(donRotated)playReplayCue('don');
  const occurrences=new Map<string,number>();
  for(const play of current.plays){
   const code=play.match(/[A-Z]{2,4}\d{2,3}-\d{3}/i)?.[0]?.toUpperCase();
   if(!code)continue;
   const occurrence=occurrences.get(code)??0;
   occurrences.set(code,occurrence+1);
   replayPlayedCardTarget(board,current.player,current,previous,code,occurrence)?.classList.add('replay-hidden');
  }
  if(!previous)return()=>donAnimations.forEach(animation=>animation.cancel());
   const drawCount=Math.max(0,previous.board[current.player].deck-current.board[current.player].deck);
   const drawn=cardsAddedToHand(previous.board[current.player].hand,current.board[current.player].hand).slice(0,drawCount);
   drawn.forEach(card=>board?.querySelector<HTMLElement>(`[data-replay-hand="${current.player}-${card.index}"]`)?.classList.add('replay-hidden'));
  const damageTaken=new Map<'player'|'opponent',number>([['player',0],['opponent',0]]);
  for(const attack of current.attacks){
   if(attack.lifeTaken<=0)continue;
   const defender=current.player==='player'?'opponent':'player';
   const prior=damageTaken.get(defender)??0;
   const gained=cardsAddedToHand(previous.board[defender].hand,current.board[defender].hand);
   for(let index=0;index<attack.lifeTaken;index++){
    const moved=gained[prior+index];
    if(moved)board?.querySelector<HTMLElement>(`[data-replay-hand="${defender}-${moved.index}"]`)?.classList.add('replay-hidden');
   }
   damageTaken.set(defender,prior+attack.lifeTaken);
  }
  for(const transition of transitions){
   if(transition.kind==='return'&&transition.handIndex!==undefined)board?.querySelector<HTMLElement>(`[data-replay-hand="${transition.side}-${transition.handIndex}"]`)?.classList.add('replay-hidden');
   if(transition.kind==='trash'&&transition.trashIndex!==undefined){const top=board?.querySelector<HTMLElement>(`.${transition.side}-side .replay-trash-card`);if(top?.dataset.cardCode===transition.code)top.classList.add('replay-hidden')}
   if(transition.kind==='attach'&&transition.characterIndex!==undefined){const slot=board?.querySelector<HTMLElement>(`.${transition.side}-side .character-row`)?.children[transition.characterIndex];slot?.querySelector<HTMLElement>(`[data-attached-don="${transition.attachedIndex}"]`)?.classList.add('replay-hidden')}
  }
  return()=>{donAnimations.forEach(animation=>animation.cancel());stateAnimations.forEach(animation=>animation.cancel())};
 },[step,replay,showIntro,hasIntroRun]);
 useEffect(()=>{
  if(!replay||showIntro||!hasIntroRun)return;
  const current=replay.reconstruction.trace[step];
  if(!current)return;
  const previous=replay.reconstruction.trace[step-1];
  const timers:number[]=[];
  const events:Array<{kind:'play'|'attack'|'block'|'counter'|'life'|'draw'|'don'|'return'|'trash'|'attach'|'bottom';code:string;side:'player'|'opponent';targetCode?:string;targetSide?:'player'|'opponent';playOccurrence?:number;handIndex?:number;lifeIndex?:number;donSlot?:number;boardIndex?:number;trashIndex?:number;characterIndex?:number;attachedIndex?:number}>=[];
  if(previous){
   const drawCount=Math.max(0,previous.board[current.player].deck-current.board[current.player].deck);
   cardsAddedToHand(previous.board[current.player].hand,current.board[current.player].hand).slice(0,drawCount).forEach(drawn=>events.push({kind:'draw',code:drawn.code,side:current.player,handIndex:drawn.index}));
  }
  const distributedDon=previous?Math.max(0,previous.board[current.player].don.deck-current.board[current.player].don.deck):step===0&&current.player===replay.reconstruction.firstPlayer.owner?1:0;
  const donTargets=[...(document.querySelectorAll<HTMLElement>(`.${current.player}-side .don-cost [data-don-slot]`))].slice(-distributedDon);
  for(let index=0;index<distributedDon;index++){const donSlot=Number(donTargets[index]?.dataset.donSlot);events.push({kind:'don',code:'DON_8',side:current.player,donSlot:Number.isFinite(donSlot)?donSlot:undefined})}
  const occurrences=new Map<string,number>();
  for(const play of current.plays){
   const code=play.match(/[A-Z]{2,4}\d{2,3}-\d{3}/i)?.[0]?.toUpperCase();
   if(!code)continue;
   const playOccurrence=occurrences.get(code)??0;
   occurrences.set(code,playOccurrence+1);
   const matchingHand=[...(previous?.board[current.player].hand??[])].flatMap((candidate,index)=>candidate===code?[index]:[]);
   const handIndex=matchingHand[playOccurrence]??-1;
   events.push({kind:'play',code,side:current.player,playOccurrence,handIndex:handIndex>=0?handIndex:undefined});
  }
  if(previous)events.push(...boardTransitions(previous,current).map(transition=>({...transition,targetSide:transition.side})));
  const claimedKnockouts=new Set<string>();
  const attackOccurrences=new Map<string,number>();
  const targetSide=current.player==='player'?'opponent':'player';
  const defendersBefore=previous?.board[targetSide];
  const defendersNow=current.board[targetSide];
  const removedTargets=defendersBefore?.characters.filter((character,index)=>defendersBefore.characters.slice(0,index+1).filter(item=>item.code===character.code).length>defendersNow.characters.filter(item=>item.code===character.code).length).map(character=>character.code)??[];
  const becameRested=defendersNow.characters.filter((character,index)=>character.rested&&!defendersBefore?.characters[index]?.rested).map(character=>character.code);
  for(const attack of current.attacks){
   const attackerOccurrence=attackOccurrences.get(attack.attacker)??0;
   attackOccurrences.set(attack.attacker,attackerOccurrence+1);
   const matchingAttackers=current.board[current.player].characters.flatMap((character,index)=>character.code===attack.attacker?[index]:[]);
   const attackerIndex=attack.attacker===current.board[current.player].leader?undefined:matchingAttackers[attackerOccurrence];
   const inferredTarget=attack.lifeTaken>0?'Leader':removedTargets.shift()??becameRested.shift()??(defendersBefore?.characters.filter(character=>character.rested).sort((a,b)=>(cards.get(a.code)?.cost??Infinity)-(cards.get(b.code)?.cost??Infinity))[0]?.code);
   const attackEvent:{kind:'attack';code:string;side:'player'|'opponent';targetCode?:string;targetSide?:'player'|'opponent';boardIndex?:number}={kind:'attack',code:attack.attacker,side:current.player,targetCode:attack.target??inferredTarget,targetSide:attack.targetSide??(inferredTarget?targetSide:undefined),boardIndex:attackerIndex};
   events.push(attackEvent);
   const defender=current.player==='player'?'opponent':'player';
   if(attack.lifeTaken>0&&previous){
    const movedCards=cardsAddedToHand(previous.board[defender].hand,current.board[defender].hand);
    const damageCursor=events.filter(event=>event.kind==='life'&&event.side===defender).length;
    for(let damage=0;damage<attack.lifeTaken;damage++){
     const moved=movedCards[damageCursor+damage];
     if(moved)events.push({kind:'life',code:moved.code,side:defender,handIndex:moved.index,lifeIndex:previous.life[defender]-1-damageCursor-damage});
    }
   }
   if(attack.lifeTaken!==0||!previous)continue;
   const priorDefender=previous.board[defender];
   const currentDefender=current.board[defender];
   const blocker=currentDefender.characters.find((character,index)=>character.rested&&!priorDefender.characters[index]?.rested&&/\[\s*Blocker\s*\]/i.test(cards.get(character.code)?.effect??''));
   if(blocker){attackEvent.targetCode=blocker.code;attackEvent.targetSide=defender;events.splice(events.length-1,0,{kind:'block',code:blocker.code,side:defender,targetCode:attack.attacker,targetSide:current.player,boardIndex:currentDefender.characters.indexOf(blocker)});continue}
   const remaining=[...currentDefender.hand];
   const spent=priorDefender.hand.find(code=>{const index=remaining.indexOf(code);if(index<0)return Boolean((cards.get(code)?.counter??0)>0);remaining.splice(index,1);return false});
   if(spent&&cards.get(spent)?.counter){events.splice(events.length-1,0,{kind:'counter',code:spent,side:defender,targetCode:attack.attacker,targetSide:current.player,handIndex:priorDefender.hand.indexOf(spent)});continue}
   const knockout=boardTransitions(previous,current).find(transition=>transition.kind==='trash'&&transition.side===defender&&transition.boardIndex!==undefined&&transition.boardIndex>=0&&!claimedKnockouts.has(`${transition.side}:${transition.code}`));
   if(knockout){claimedKnockouts.add(`${knockout.side}:${knockout.code}`);attackEvent.targetCode=knockout.code;attackEvent.targetSide=defender}
  }
  events.forEach((event,index)=>{
   const timer=window.setTimeout(()=>{
    playReplayCue(event.kind,index);
    const card=cards.get(event.code);
    if(!card){document.querySelectorAll(`.${event.side}-side .play-card[data-card-code="${CSS.escape(event.code)}"],[data-replay-hand="${event.side}-${event.handIndex}"],[data-don-slot="${event.donSlot}"],[data-attached-don="${event.attachedIndex}"]`).forEach(target=>target.classList.remove('replay-hidden'));return;}
    const board=document.querySelector<HTMLElement>('.tournament-replay-screen');
    const root=board?.querySelector<HTMLElement>(`.${event.side}-side`);
    let source:HTMLElement|null=null;
    if(event.kind==='play'||event.kind==='counter'){
     const handRoot=document.querySelector<HTMLElement>(event.side==='player'?'.player-hand .hand-cards':'.opponent-hand');
     const visibleCard=handRoot?.querySelector<HTMLElement>(`[data-card-id^="${CSS.escape(event.code)}-"]`);
     const hand=previous?.board[event.side].hand??current.board[event.side].hand;
     const handIndex=hand.indexOf(event.code);
     const originIndex=event.handIndex??handIndex;
     source=visibleCard??(originIndex>=0?document.querySelector<HTMLElement>(`[data-replay-hand="${event.side}-${originIndex}"]`):null)??handRoot??document.querySelector<HTMLElement>(event.side==='player'?'.player-hand':'.opponent-hand');
    }else if(event.kind==='life')source=root?.querySelector<HTMLElement>('.life-stack > .life-back:last-child')??root?.querySelector<HTMLElement>('.life-stack')??null;
    else if(event.kind==='draw')source=root?.querySelector<HTMLElement>('.deck-zone > .play-back')??root?.querySelector<HTMLElement>('.deck-zone')??null;
    else if(event.kind==='don')source=root?.querySelector<HTMLElement>('.don-deck > .play-back')??root?.querySelector<HTMLElement>('.don-deck')??null;
    else if(event.kind==='return'||event.kind==='trash'){
     const row=root?.querySelector<HTMLElement>('.character-row'),slot=event.boardIndex!==undefined&&event.boardIndex>=0?row?.children[event.boardIndex]:null;
     if(event.kind==='trash'&&event.handIndex!==undefined){const handRoot=document.querySelector<HTMLElement>(event.side==='player'?'.player-hand .hand-cards':'.opponent-hand');const handNodes=[...(handRoot?.querySelectorAll<HTMLElement>('[data-replay-hand]')??[])];source=handNodes[Math.min(event.handIndex,Math.max(0,handNodes.length-1))]??handRoot??null}
     else if(event.boardIndex===-2)source=root?.querySelector<HTMLElement>('.stage-zone .play-card')??root?.querySelector<HTMLElement>('.stage-zone')??null;
     else if(slot instanceof HTMLElement)source=slot.classList.contains('play-card')?slot:slot.querySelector<HTMLElement>('.play-card')??slot;
     else if(event.trashIndex!==undefined)source=root?.querySelector<HTMLElement>('.trash-zone .replay-trash-card')??root?.querySelector<HTMLElement>('.trash-zone')??null;
     else source=event.side==='player'?document.querySelector<HTMLElement>('.player-hand'):document.querySelector<HTMLElement>('.opponent-hand');
    }else if(event.kind==='attach')source=root?.querySelector<HTMLElement>(`[data-don-slot="${event.donSlot}"]`)??root?.querySelector<HTMLElement>('.don-cost')??null;
    else if(event.kind==='bottom'){
     if(event.handIndex!==undefined){const handRoot=document.querySelector<HTMLElement>(event.side==='player'?'.player-hand .hand-cards':'.opponent-hand');const handNodes=[...(handRoot?.querySelectorAll<HTMLElement>('[data-replay-hand]')??[])];source=handNodes[Math.min(event.handIndex,Math.max(0,handNodes.length-1))]??handRoot??null}
     else if(event.boardIndex===-2)source=root?.querySelector<HTMLElement>('.stage-zone .play-card')??root?.querySelector<HTMLElement>('.stage-zone')??null;
     else if(event.boardIndex!==undefined)source=root?.querySelector<HTMLElement>('.character-row')?.children[event.boardIndex] as HTMLElement??null;
     else source=event.side==='player'?document.querySelector<HTMLElement>('.player-hand'):document.querySelector<HTMLElement>('.opponent-hand');
    }else if(event.kind==='attack'&&event.boardIndex!==undefined){const slot=root?.querySelector<HTMLElement>('.character-row')?.children[event.boardIndex];source=slot instanceof HTMLElement?(slot.classList.contains('play-card')?slot:slot.querySelector<HTMLElement>('.play-card')):null}
    else if(event.kind==='attack'&&event.code===current.board[event.side].leader)source=root?.querySelector<HTMLElement>('.leader-zone > .play-card')??null;
    else if(event.kind==='block'&&event.boardIndex!==undefined){const slot=root?.querySelector<HTMLElement>('.character-row')?.children[event.boardIndex];source=slot instanceof HTMLElement?(slot.classList.contains('play-card')?slot:slot.querySelector<HTMLElement>('.play-card')):null}
    else source=root?.querySelector<HTMLElement>(`.play-card[data-card-code="${CSS.escape(event.code)}"]`)??null;
    let target:HTMLElement|null=null;
    let targetIndex=-1;
    if(event.kind==='play'){
     target=replayPlayedCardTarget(board,event.side,current,previous,event.code,event.playOccurrence??0);
     const row=root?.querySelector<HTMLElement>('.character-row');
     targetIndex=target&&row?Array.prototype.indexOf.call(row.children,target):-1;
    }else if(event.kind==='life'||event.kind==='draw'){
     targetIndex=event.handIndex??-1;
     target=event.handIndex===undefined?null:document.querySelector<HTMLElement>(`[data-replay-hand="${event.side}-${event.handIndex}"]`);
    }else if(event.kind==='don'){
     targetIndex=event.donSlot??-1;
     target=event.donSlot===undefined?root?.querySelector<HTMLElement>('.don-cost')??null:root?.querySelector<HTMLElement>(`[data-don-slot="${event.donSlot}"]`)??null;
    }else if(event.kind==='return')target=event.handIndex===undefined?null:board?.querySelector<HTMLElement>(`[data-replay-hand="${event.side}-${event.handIndex}"]`)??null;
    else if(event.kind==='trash'){
     const trashTop=root?.querySelector<HTMLElement>('.replay-trash-card');
     target=trashTop?.dataset.cardCode===event.code?trashTop:root?.querySelector<HTMLElement>('.trash-zone')??null;
    }
    else if(event.kind==='attach'){
     const row=root?.querySelector<HTMLElement>('.character-row'),slot=event.characterIndex===undefined?null:row?.children[event.characterIndex];
     target=slot instanceof HTMLElement?slot.querySelector<HTMLElement>(`[data-attached-don="${event.attachedIndex}"]`):null;
    }else if(event.kind==='bottom')target=root?.querySelector<HTMLElement>('.deck-zone .play-back')??root?.querySelector<HTMLElement>('.deck-zone')??null;
    else target=event.targetCode&&event.targetCode!=='Leader'?document.querySelector<HTMLElement>(`.${event.targetSide??(event.side==='player'?'opponent':'player')}-side [data-card-code="${CSS.escape(event.targetCode)}"]`):document.querySelector<HTMLElement>(`.${event.targetSide??(event.side==='player'?'opponent':'player')}-side .leader-zone`);
    const sourceOrigin=event.handIndex!==undefined&&['play','counter','trash','bottom'].includes(event.kind)?previousLayoutRects.current.get(`hand:${event.side}-${event.handIndex}`):event.boardIndex!==undefined&&event.boardIndex>=0?previousLayoutRects.current.get(`board:${event.side}:character:${event.boardIndex}`):event.boardIndex===-2?previousLayoutRects.current.get(`board:${event.side}:stage`):event.kind==='life'?previousLayoutRects.current.get(`board:${event.side}:life:${event.lifeIndex}`)??previousLayoutRects.current.get(`board:${event.side}:life`):event.kind==='draw'?previousLayoutRects.current.get(`board:${event.side}:deck`):event.kind==='don'?previousLayoutRects.current.get(`board:${event.side}:donDeck`):event.kind==='attach'&&event.donSlot!==undefined?previousLayoutRects.current.get(`board:${event.side}:don:${event.donSlot}`):event.kind==='return'&&event.trashIndex!==undefined?previousLayoutRects.current.get(`board:${event.side}:trash`):undefined;
    const from=sourceOrigin??source?.getBoundingClientRect(),to=target?.getBoundingClientRect();
    const hideTarget=event.kind==='play'||event.kind==='life'||event.kind==='draw'||event.kind==='don'||event.kind==='return'||event.kind==='attach'||(event.kind==='trash'&&target instanceof HTMLElement&&target.dataset.cardCode===event.code);
    if(!from||!to){if(target&&hideTarget){const reveal=window.setTimeout(()=>target?.classList.remove('replay-hidden'),120);timers.push(reveal)}return}
    if(hideTarget)target?.classList.add('replay-hidden');
    if(event.kind==='play'&&card.effect.trim())window.setTimeout(()=>{const art=target?.querySelector<HTMLElement>('.tcg-card');art?.animate([{filter:'drop-shadow(0 0 0 rgb(232 187 75 / 0))'},{filter:'drop-shadow(0 0 18px rgb(232 187 75 / .95))'},{filter:'drop-shadow(0 0 2px rgb(232 187 75 / .15))'}],{duration:720,easing:'cubic-bezier(.2,.8,.2,1)'})},930+index*1100);
    const useSourceSize=event.kind==='trash'&&target?.classList.contains('trash-zone');
    const flightArt=(useSourceSize?source:target)?.querySelector<HTMLElement>('.tcg-card')??source?.querySelector<HTMLElement>('.tcg-card')??target?.querySelector<HTMLElement>('.tcg-card');
    const width=flightArt?.offsetWidth||(useSourceSize?from.width:to.width)||82,height=flightArt?.offsetHeight||(useSourceSize?from.height:to.height)||114,fromX=from.left+from.width/2,fromY=from.top+from.height/2,toX=to.left+to.width/2,toY=to.top+to.height/2;
    const id=`turn-${step}-${index}-${Date.now()}`;
    const targetRested=target?.classList.contains('rested-don')??false;
    const opponentRotation=event.side==='opponent';
    const sideFacing=opponentRotation?180:0;
    const targetFacing=event.targetSide==='opponent'?180:event.targetSide==='player'?0:opponentRotation?0:180;
    const startsOnBoard=event.boardIndex!==undefined||event.trashIndex!==undefined;
    const startRotation=event.kind==='don'||event.kind==='attach'||event.kind==='attack'||event.kind==='block'?sideFacing:event.kind==='counter'||event.kind==='play'||event.kind==='bottom'?0:event.kind==='return'||event.kind==='trash'?(startsOnBoard?sideFacing:0):undefined;
    const endRotation=event.kind==='don'?(opponentRotation?(targetRested?270:180):(targetRested?90:0)):event.kind==='attach'||event.kind==='trash'?sideFacing:event.kind==='return'||event.kind==='life'||event.kind==='draw'?0:event.kind==='bottom'?sideFacing:event.kind==='play'?sideFacing:event.kind==='attack'||event.kind==='block'||event.kind==='counter'?targetFacing:undefined;
    setActionFlights(items=>[...items,{id,card,kind:event.kind,side:event.side,fromX:fromX-width/2,fromY:fromY-height/2,deltaX:toX-fromX,deltaY:toY-fromY,delay:0,width,height,fromScale:Math.min(1,from.width/width,from.height/height),targetIndex,startRotation,endRotation}]);
    const clear=window.setTimeout(()=>{setActionFlights(items=>items.filter(item=>item.id!==id));if(hideTarget)target?.classList.remove('replay-hidden')},1000);
    timers.push(clear);
   },(step===0?1600:40)+index*1100);
   timers.push(timer);
  });
  return()=>{timers.forEach(window.clearTimeout);setActionFlights(items=>items.filter(item=>!item.id.startsWith(`turn-${step}-`)))};
 },[step,replay,cards,showIntro,hasIntroRun]);
 const turn=replay?.reconstruction.trace[step];const player=turn?.board.player,opponent=turn?.board.opponent;
 const firstPlayer=replay?.reconstruction.firstPlayer.owner;
 const firstDie=showdownDieValue(`${matchId}:starting-player`)%5+2;
 const secondDie=firstDie-1;
 const playerDie=firstPlayer==='player'?firstDie:secondDie;
 const opponentDie=firstPlayer==='opponent'?firstDie:secondDie;
 const face=(code:string)=>cards.get(code);const seatName=(owner:'player'|'opponent')=>replay?.reconstruction.deckLists[owner].player?.trim()||face(replay?.reconstruction.deckLists[owner].leader??'')?.name||'Unknown player';const donCard=face('DON_8');const life=(owner:'player'|'opponent')=>turn?.life[owner]??5;
 const inspectCard=(card?:Card)=>setInspected(card);const openPreview=(card:Card)=>{const source=document.querySelector<HTMLElement>(`.play-card[data-card-code="${CSS.escape(card.code)}"]`);setPreview({card,origin:source?.getBoundingClientRect()})};
 const renderSide=(owner:'player'|'opponent',side:Side)=>{
  const opposing=owner==='opponent';
  const leader=face(side.leader);
  const style=matTones(leader?.color,[91,104,109],leader?.id??side.leader);
  const slots=[...Array.from({length:side.don.active},(_,id)=>({id,status:'active' as const})),...Array.from({length:side.don.rested},(_,index)=>({id:side.don.active+index,status:'rested' as const})),...Array.from({length:side.don.attached},(_,index)=>({id:side.don.active+side.don.rested+index,status:'attached' as const}))];
  const deck=<div className="deck-zone"><small>Deck</small><Back count={side.deck}/></div>;
  const trashCard=side.trash.at(-1);const topTrash=trashCard?face(trashCard):undefined;const trash=<div className="trash-zone"><small>Trash</small>{topTrash?<button className="replay-trash-card" data-card-code={topTrash.code} type="button" aria-label={`Inspect ${topTrash.name} in Trash`} onPointerEnter={()=>setInspected(topTrash)} onPointerLeave={()=>setInspected(undefined)} onClick={()=>openPreview(topTrash)}><CardArt card={topTrash} small/></button>:<div className="empty-zone"/>}</div>;
  const cost=<CostArea split deckCount={side.don.deck} active={side.don.active} rested={side.don.rested} attached={side.don.attached} donCard={donCard} onUse={()=>{}} donSlots={slots}/>;
  const stageCard=side.stage?face(side.stage):undefined;const stage=<div className="stage-zone"><small>Stage</small>{stageCard?<PlayCard card={stageCard} onInspect={inspectCard} onClick={()=>openPreview(stageCard)} displayPower={stageCard.power} donCard={donCard} well/>:null}</div>;
  const leaderZone=<div className="leader-zone"><div className="leader-branding" aria-label="VivrePlay and One Piece Card Game"><span className="leader-vivre-brand"><img src="/brand/vivreplay-compass.png" alt=""/><b>VivrePlay</b></span><img className="leader-one-piece-brand" src="/assets/one-piece-card-game-logo.png" alt="One Piece Card Game"/></div><small>Leader</small>{leader&&<PlayCard card={leader} displayPower={side.leaderPower??leader.power} onInspect={inspectCard} onClick={()=>openPreview(leader)} rested={side.leaderRested??(replay?replayLeaderRested(replay,step,owner):false)} donCard={donCard} well/>}</div>;
  const characters=<div className="character-row" data-zone="Character area">{Array.from({length:5},(_,index)=>{const character=side.characters[index],card=character?face(character.code):undefined;return card&&character?<PlayCard key={`${character.code}-${index}`} card={card} displayPower={character.power} onInspect={inspectCard} onClick={()=>openPreview(card)} rested={character.rested} attachedDon={character.attachedDon} donCard={donCard} well/>:<i className="character-empty" key={`empty-${index}`}/>})}</div>;
  const lifeStack=<div className="life-stack"><b>Life</b>{Array.from({length:life(owner)},(_,index)=><Back key={index} life count={index===life(owner)-1?life(owner):undefined}/>)}</div>;
  return <div className={`${opposing?'opponent-side':'player-side'} board-side`} data-owner={owner} style={style} key={owner}>
   <div className="mat-brand-pattern" aria-hidden="true">{matMarks(leader?.id??side.leader).map((mark,index)=><i key={index} style={mark}/>)}</div>
   <ZoneArtwork target=".deck-zone" scene={playmatScene} opponent={opposing}/><ZoneArtwork target=".trash-zone" scene={playmatScene} opponent={opposing}/><ZoneArtwork target=".leader-zone" scene={playmatScene} opponent={opposing}/><ZoneArtwork target=".stage-zone" scene={playmatScene} opponent={opposing}/><ZoneArtwork target=".life-stack" scene={playmatScene} opponent={opposing}/><ZoneArtwork target=".don-deck" scene={playmatScene} opponent={opposing}/><ZoneArtwork target=".don-cost" scene={playmatScene} opponent={opposing}/><ZoneArtwork target=".character-row" scene={playmatScene} opponent={opposing}/>
   <div className="board-side-meta"><span><i/>{seatName(owner)}</span><b>{turn?.player===owner?`Turn ${turn.turn} · Main`:`Turn ${turn?.turn} · Waiting`}</b></div>
   {opposing?<>{deck}{trash}{cost}{stage}{leaderZone}{characters}{lifeStack}</>:<>{lifeStack}{deck}{trash}{cost}{leaderZone}{characters}{stage}</>}
  </div>;
 };
 useLayoutEffect(()=>{const boards=[...document.querySelectorAll<HTMLElement>('.tournament-replay-screen .board-side')];if(!boards.length)return;const update=()=>boards.forEach(board=>{const rect=board.getBoundingClientRect(),scaleX=board.offsetWidth?rect.width/board.offsetWidth:1,scaleY=board.offsetHeight?rect.height/board.offsetHeight:1,originX=rect.left+board.clientLeft*scaleX,originY=rect.top+board.clientTop*scaleY;board.querySelectorAll<HTMLElement>('.zone-art').forEach(art=>{const target=art.dataset.zoneArtFor,host=target?board.querySelector<HTMLElement>(target):null;if(!host)return;const box=host.getBoundingClientRect();art.style.setProperty('--playmat-art-width',`${board.clientWidth}px`);art.style.setProperty('--playmat-art-height',`${board.clientHeight}px`);art.style.setProperty('--zone-art-width',`${box.width/scaleX}px`);art.style.setProperty('--zone-art-height',`${box.height/scaleY}px`);art.style.setProperty('--zone-art-left',`${(box.left-originX)/scaleX}px`);art.style.setProperty('--zone-art-top',`${(box.top-originY)/scaleY}px`);art.style.setProperty('--zone-image-x',`${-(box.left-originX)/scaleX}px`);art.style.setProperty('--zone-image-y',`${-(box.top-originY)/scaleY}px`);art.style.setProperty('--zone-art-radius',getComputedStyle(host).borderRadius)})});update();const observer=new ResizeObserver(update);boards.forEach(board=>observer.observe(board));window.addEventListener('resize',update);return()=>{observer.disconnect();window.removeEventListener('resize',update)}},[step,replay,playmatScene]);

 return <main className="play-fullscreen tournament-replay-screen">
  <header className="match-bar"><Link href="/meta?view=events" className="match-exit"><ArrowLeftIcon size={16}/><span>Back to tournament results</span></Link><span className="match-seat opponent"><i/>RECONSTRUCTED MATCH</span>{soundButton()}</header>
  {error?<div className="replay-loading" role="alert">{error}</div>:!replay||!turn||!player||!opponent?<div className="replay-loading" role="status">Loading match simulation…</div>:<>
   <BattleTableFrame label="Reconstructed One Piece Card Game match">
    {renderSide('opponent',opponent)}<div className="turn-line"><span>Turn {turn.turn}</span></div>{renderSide('player',player)}
    <div className="opponent-hand" aria-label={`${seatName('opponent')} hand, ${opponent.hand.length} cards`}>{opponent.hand.map((code,index)=>face(code)?<button type="button" aria-label={`Inspect ${face(code)!.name} in ${seatName('opponent')}'s hand`} key={`${code}-${index}`} data-card-id={`${code}-${index}`} data-replay-hand={`opponent-${index}`} className={hiddenDealTargets.includes(`opponent-${index}`)?'replay-hidden':''} onPointerEnter={()=>setInspected(face(code))} onPointerLeave={()=>setInspected(undefined)} onClick={()=>openPreview(face(code)!)}><CardArt card={face(code)!} small/></button>:<span className="play-back" key={`${code}-${index}`}><img className="play-back-face" src="/assets/one-piece-card-back.webp" alt=""/></span>)}<b className="opponent-hand-count" aria-label={`${opponent.hand.length} cards in ${seatName('opponent')}'s hand`}>{opponent.hand.length}</b></div>
    <div className="player-hand" aria-label={`${seatName('player')} hand, ${player.hand.length} cards`}><div className="hand-sort"><b>{player.hand.length}</b><span role="button" tabIndex={-1} aria-label="Sort hand: Original order" title="Original order"><ArrowsDownUpIcon size={14}/><span>Original</span></span></div><div className="hand-cards">{player.hand.map((code,index)=>face(code)?<button type="button" data-card-id={`${code}-${index}`} data-replay-hand={`player-${index}`} className={hiddenDealTargets.includes(`player-${index}`)?'replay-hidden':''} key={`${code}-${index}`} title={`${face(code)!.name}, ${code}`} onPointerEnter={()=>setInspected(face(code))} onPointerLeave={()=>setInspected(undefined)} onClick={()=>openPreview(face(code)!)}><CardArt card={face(code)!} small/></button>:null)}</div></div>

   </BattleTableFrame>
    {dealFlights.map(flight=><span key={flight.id} className="replay-motion-card replay-deal-flight" aria-hidden="true" style={{left:flight.fromX,top:flight.fromY,"--motion-width":`${flight.width}px`,"--motion-height":`${flight.height}px`,"--motion-x":`${flight.deltaX}px`,"--motion-y":`${flight.deltaY}px`,"--motion-delay":`${flight.delay}ms`,"--motion-from-scale":flight.fromScale,"--motion-start-rotation":`${flight.startRotation??0}deg`,"--motion-end-rotation":`${flight.endRotation??0}deg`} as React.CSSProperties}><CardArt card={flight.card} small priority/></span>)}
    {actionFlights.map(flight=><span key={flight.id} className={`replay-motion-card replay-action-flight ${flight.kind}`} aria-hidden="true" style={{left:flight.fromX,top:flight.fromY,"--motion-width":`${flight.width}px`,"--motion-height":`${flight.height}px`,"--motion-x":`${flight.deltaX}px`,"--motion-y":`${flight.deltaY}px`,"--motion-delay":`${flight.delay}ms`,"--motion-from-scale":flight.fromScale,"--motion-start-rotation":`${flight.startRotation??(flight.side==='opponent'&&flight.kind!=='play'&&flight.kind!=='life'&&flight.kind!=='draw'?'180':'0')}deg`,"--motion-end-rotation":`${flight.endRotation??(flight.side==='opponent'&&flight.kind!=='life'&&flight.kind!=='draw'?'180':'0')}deg`} as React.CSSProperties}>{flight.kind==='life'?<span className="replay-life-reveal"><img className="replay-life-back" src="/assets/one-piece-card-back.webp" alt=""/><span className="replay-life-front"><CardArt card={flight.card} small priority/></span></span>:<CardArt card={flight.card} small priority/>}{!['life','draw','don','return','trash','attach','bottom'].includes(flight.kind)&&<b>{flight.kind==='play'?'Play':flight.kind==='attack'?'Attack':flight.kind==='block'?'Block':'Counter'}</b>}</span>)}
   {showIntro&&<aside className="leader-showdown replay-leader-showdown" aria-label="Leader reveal">{soundButton()}
    <div className="showdown-leader opponent"><span className="showdown-card"><span className="showdown-back"><img src="/assets/one-piece-leader-back.jpg" alt=""/></span><span className="showdown-front"><CardArt card={face(replay.reconstruction.deckLists.opponent.leader)!}/></span></span><div className="showdown-copy"><small className="showdown-player-name">{seatName('opponent')}</small><small>{face(replay.reconstruction.deckLists.opponent.leader)!.code}</small><strong>{face(replay.reconstruction.deckLists.opponent.leader)!.name}</strong><ShowdownEffect card={face(replay.reconstruction.deckLists.opponent.leader)!}/></div></div>
    <b className="showdown-vs"><span>VS</span></b><button type="button" className="showdown-skip" onClick={()=>{if(introTimer.current)window.clearTimeout(introTimer.current);if(diceTimer.current)window.clearTimeout(diceTimer.current);introTimer.current=undefined;diceTimer.current=undefined;setShowIntro(false);setShowStartingRoll(false);setHasIntroRun(true);dealOpeningHand()}}>Skip intro</button>
    <div className="showdown-leader player"><span className="showdown-card"><span className="showdown-back"><img src="/assets/one-piece-leader-back.jpg" alt=""/></span><span className="showdown-front"><CardArt card={face(replay.reconstruction.deckLists.player.leader)!}/></span></span><div className="showdown-copy"><small className="showdown-player-name">{seatName('player')}</small><small>{face(replay.reconstruction.deckLists.player.leader)!.code}</small><strong>{face(replay.reconstruction.deckLists.player.leader)!.name}</strong><ShowdownEffect card={face(replay.reconstruction.deckLists.player.leader)!}/></div></div>
   </aside>}
   {showStartingRoll&&<aside className="starting-roll-backdrop replay-starting-roll" aria-label="Opening dice roll"><section className="starting-roll replay-starting-roll-panel">{soundButton()}<p>Opening roll</p><h1>Who goes first?</h1><div className="dice-result"><div><em>{seatName('opponent')}</em><Dice value={opponentDie} opponent label={`${seatName('opponent')} rolled ${opponentDie}`}/></div><b>VS</b><div><em>{seatName('player')}</em><Dice value={playerDie} label={`${seatName('player')} rolled ${playerDie}`}/></div></div><strong className="roll-outcome">{firstPlayer==='player'?`${seatName('player')} goes first`:`${seatName('opponent')} goes first`}</strong><span className="roll-question">Opening hands are dealt after the roll.</span></section></aside>}
   <aside className="replay-action-log" aria-live="polite"><h2>{replay.source.event}</h2><p className="replay-turn-label">Turn {turn.turn}, {seatName(turn.player)}</p>{turn.plays.length||turn.attacks.length?<ul>{turn.plays.map((play,index)=><li key={`play-${index}`}><b>Play</b> {play}</li>)}{turn.attacks.map((attack,index)=><li key={`attack-${index}`}><b>Attack</b> {face(attack.attacker)?.name??attack.attacker}, {attack.power.toLocaleString()} power{attack.lifeTaken?`, ${attack.lifeTaken} Life`:''}</li>)}</ul>:<p>No plays or attacks this turn.</p>}<p className="replay-provenance">Reconstructed from tournament decks and results. Attack targets belong to this simulation; they are not historical match records.</p></aside>
   <aside className="replay-controls"><div><strong>{seatName(turn.player)} · turn {turn.turn}</strong><span>Life {life('player')}–{life('opponent')}, {turn.plays.length} plays, {turn.attacks.length} attacks</span></div><div className="replay-control-buttons"><button type="button" aria-label="Previous turn" disabled={step===0} onClick={()=>setStep(value=>Math.max(0,value-1))}><SkipBackIcon size={18}/></button><button type="button" aria-label={playing?'Pause simulation':'Play simulation'} onClick={()=>setPlaying(value=>!value)}>{playing?<PauseIcon size={18}/>:<PlayIcon size={18}/>}</button><button type="button" aria-label="Next turn" disabled={step>=replay.reconstruction.trace.length-1} onClick={()=>setStep(value=>Math.min(replay.reconstruction.trace.length-1,value+1))}><SkipForwardIcon size={18}/></button><input aria-label="Simulation turn" type="range" min={0} max={replay.reconstruction.trace.length-1} value={step} onChange={event=>setStep(Number(event.target.value))}/><span>{step+1}/{replay.reconstruction.trace.length}</span></div></aside>
   {inspected&&<aside className="hand-inspector replay-inspector" aria-live="polite"><CardArt card={inspected}/><span>{inspected.name} ({inspected.code})</span></aside>}
   {preview&&<CardPreviewModal card={preview.card} origin={preview.origin} language="EN" cards={Array.from(cards.values())} marketActions={false} onClose={()=>setPreview(undefined)} onNavigate={card=>setPreview(current=>current?{...current,card}:undefined)}/>}
  </>}
 </main>;
}
