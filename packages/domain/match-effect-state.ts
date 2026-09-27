import {matchesSearch} from './search-eligibility';
import {compileEffectDocument,type EffectAction,type EffectCost,type EffectTrigger,type EffectDocument} from './effect-rules';
import {resolveCardEffect,type EffectCommand} from './effect-runtime';
import type {Card} from '../card-data/catalog';

export type PlayerId='player'|'opponent';
export type CardZone='deck'|'hand'|'life'|'trash'|'character'|'leader'|'stage'|'cost-area'|'don-deck';
export type MatchCard={id:string;owner:PlayerId;zone:CardZone;type?:'Character'|'Leader'|'Stage'|'Event'|'DON!!';cost?:number;power?:number;counter?:number;name?:string;color?:string;traits?:string[];rested?:boolean;attachedTo?:string;faceUp?:boolean;keywords?:string[];powerModifier?:number;costModifier?:number;temporaryKeywords?:string[];cannotAttack?:boolean;cannotReady?:boolean;effectNegated?:boolean;preventKo?:'battle'|'effect'|'any';effectText?:string;effectSchema?:EffectDocument;code?:string};
export type TurnPhase='refresh'|'draw'|'don'|'main'|'end';
export type MatchEffectState={cards:MatchCard[];turn:PlayerId;turnEffects:Array<{kind:string;target?:string;amount?:number;detail?:string;expires?:'battle'|'turn-end'}>;restrictions:string[];delayed:Array<{when:'next-main-phase'|'end-turn'|'replacement';instruction:string}>;phase?:TurnPhase;turnNumber?:number;firstPlayer?:PlayerId;playedThisTurn?:string[]};
export type EffectSelection={cardIds?:string[];targetId?:string;choice?:string};
export type EffectStepResult={state:MatchEffectState;requiresSelection?:string;error?:string};

const other=(player:PlayerId):PlayerId=>player==='player'?'opponent':'player';
const cardsFor=(state:MatchEffectState,player:PlayerId,zone?:CardZone)=>state.cards.filter(card=>card.owner===player&&(!zone||card.zone===zone));
const update=(state:MatchEffectState,id:string,patch:Partial<MatchCard>):MatchEffectState=>({...state,cards:state.cards.map(card=>card.id===id?{...card,...patch}:card)});
const move=(state:MatchEffectState,id:string,zone:CardZone,patch:Partial<MatchCard>={}):MatchEffectState=>{
 const previous=state.cards.find(card=>card.id===id);
 const leavingField=previous&&['leader','character','stage'].includes(previous.zone)&&!['leader','character','stage'].includes(zone);
 const reset=leavingField?{powerModifier:undefined,costModifier:undefined,temporaryKeywords:undefined,cannotAttack:undefined,cannotReady:undefined,effectNegated:undefined,preventKo:undefined}:{};
 return {...state,turnEffects:leavingField?state.turnEffects.filter(effect=>effect.target!==id):state.turnEffects,cards:state.cards.map(card=>card.id===id?{...card,...reset,zone,rested:false,attachedTo:undefined,...patch}:card.attachedTo===id?{...card,zone:'cost-area',rested:true,attachedTo:undefined}:card)};
};
function moveToDeck(state:MatchEffectState,ids:string[],position:'top'|'bottom'):MatchEffectState{
 const moved=ids.reduce((current,id)=>move(current,id,'deck'),state);
 const selected=ids.map(id=>moved.cards.find(card=>card.id===id)!).filter(Boolean);
 const remaining=moved.cards.filter(card=>!ids.includes(card.id));
 return {...moved,cards:position==='top'?[...selected,...remaining]:[...remaining,...selected]};
}
const selected=(state:MatchEffectState,selection:EffectSelection)=>selection.targetId?state.cards.find(card=>card.id===selection.targetId):undefined;
const selectedCards=(state:MatchEffectState,selection:EffectSelection)=>state.cards.filter(card=>selection.cardIds?.includes(card.id));
const hasTrigger=(card:MatchCard)=>card.keywords?.includes('trigger')??false;
const effect=(state:MatchEffectState,kind:string,target?:string,amount?:number,detail?:string,expires?:'battle'|'turn-end'):MatchEffectState=>({...state,turnEffects:[...state.turnEffects,{kind,target,amount,detail,expires}]});
const requireTarget=(state:MatchEffectState,selection:EffectSelection,message:string):{card:MatchCard}|{result:EffectStepResult}=>{const card=selected(state,selection);return card?{card}:{result:{state,requiresSelection:message}};};
const legalOwner=(card:MatchCard|undefined,owner:PlayerId)=>Boolean(card&&card.owner===owner);



/** Returns the executable commands for any printed timing window on a card in the match. */
export function commandsForTiming(state:MatchEffectState,cardId:string,timing:EffectTrigger):EffectCommand[]{
 const card=state.cards.find(item=>item.id===cardId);
 if(!card?.effectText||card.effectNegated)return [];
 const source={id:card.id,code:card.code??card.id,name:card.name??card.id,color:card.color??'',type:card.type??'Character',cost:card.cost??0,power:card.power??0,counter:card.counter??0,rarity:'',art:0,effect:card.effectText} as Card;
 return resolveCardEffect(card.effectSchema??compileEffectDocument(source),timing).commands;
}

export function expireEffectModifiers(state:MatchEffectState,window:'battle'|'turn-end'):MatchEffectState{
 const expired=state.turnEffects.filter(effect=>effect.expires===window||(window==='turn-end'&&effect.expires==='battle'));
 const remaining=state.turnEffects.filter(effect=>!expired.includes(effect));
 const cards=state.cards.map(card=>{
  const effects=expired.filter(effect=>effect.target===card.id);
  if(!effects.length)return card;
  const power=effects.filter(effect=>effect.kind==='power').reduce((sum,effect)=>sum+(effect.amount??0),0);
  const cost=effects.filter(effect=>effect.kind==='cost').reduce((sum,effect)=>sum+(effect.amount??0),0);
  const keywords=card.temporaryKeywords?.filter(keyword=>!effects.some(effect=>effect.kind==='grant-keyword'&&effect.detail===keyword)||remaining.some(effect=>effect.target===card.id&&effect.kind==='grant-keyword'&&effect.detail===keyword));
  return {...card,powerModifier:((card.powerModifier??0)-power)||undefined,costModifier:((card.costModifier??0)-cost)||undefined,temporaryKeywords:keywords?.length?keywords:undefined};
 });
 return {...state,cards,turnEffects:remaining};
}

export type TurnStartResult={state:MatchEffectState;drawnCardId?:string;addedDonIds:string[];gameOver?:PlayerId};
export type CardPlayResult={state:MatchEffectState;playedCardId?:string;error?:string};
export type AttackDeclaration={state:MatchEffectState;error?:string};
export type CounterResult={state:MatchEffectState;total:number;error?:string};

/** Runs Refresh, Draw, and DON!! in the order mandated by the official turn flow. */
export function beginTurn(state:MatchEffectState,actor:PlayerId,turnNumber=(state.turnNumber??0)+1):TurnStartResult{
 state=expireEffectModifiers(state,'turn-end');
 const firstTurn=turnNumber===1&&state.firstPlayer===actor;
 const returned=state.cards.map(card=>card.owner===actor&&card.type==='DON!!'&&card.attachedTo?{...card,zone:'cost-area' as CardZone,attachedTo:undefined,rested:true}:card);
 const refreshed=returned.map(card=>card.owner===actor&&['leader','character','stage','cost-area'].includes(card.zone)?{...card,rested:false,powerModifier:undefined,costModifier:undefined,temporaryKeywords:undefined,cannotAttack:undefined,cannotReady:undefined,effectNegated:undefined,preventKo:undefined}:card);
 const deck=refreshed.filter(card=>card.owner===actor&&card.zone==='deck');
 if(!firstTurn&&!deck.length)return {state:{...state,cards:refreshed,turn:actor,turnNumber,phase:'draw'},addedDonIds:[],gameOver:actor};
 const drawn=firstTurn?undefined:deck[0];
 const afterDraw=drawn?refreshed.map(card=>card.id===drawn.id?{...card,zone:'hand' as CardZone}:card):refreshed;
 const donCount=firstTurn?1:2;
 const dons=afterDraw.filter(card=>card.owner===actor&&card.zone==='don-deck').slice(0,donCount);
 const nextState={...state,cards:afterDraw.map(card=>dons.some(don=>don.id===card.id)?{...card,zone:'cost-area' as CardZone,rested:false}:card),turn:actor,turnNumber,phase:'main' as TurnPhase,playedThisTurn:[]};
 return {state:nextState,drawnCardId:drawn?.id,addedDonIds:dons.map(card=>card.id),gameOver:!firstTurn&&deck.length===1?actor:undefined};
}

/** Pays a normal card cost with active DON!! and applies the ordinary play destination. */
export function playCard(state:MatchEffectState,actor:PlayerId,cardId:string):CardPlayResult{
 if(state.phase&&state.phase!=='main')return {state,error:'Cards can only be played during the Main Phase.'};
 const card=state.cards.find(item=>item.id===cardId);
 if(!card||card.owner!==actor||card.zone!=='hand'||!['Character','Stage','Event'].includes(card.type??''))return {state,error:'Select a Character, Stage, or Event from your hand.'};
 if(card.type==='Event'&&!card.keywords?.includes('main'))return {state,error:'Only an Event with [Main] can be activated during the Main Phase.'};
 const cost=card.cost??0;const donors=cardsFor(state,actor,'cost-area').filter(item=>item.type==='DON!!'&&!item.rested).slice(0,cost);
 if(donors.length!==cost)return {state,error:'There are not enough active DON!! cards to pay this cost.'};
 const next=state.cards.map(item=>donors.some(don=>don.id===item.id)?{...item,rested:true}:item).map(item=>{
  if(item.id!==cardId)return item;
  if(item.type==='Event')return {...item,zone:'trash' as CardZone,rested:false};
  return {...item,zone:(item.type==='Stage'?'stage':'character') as CardZone,rested:false};
 });
 const withStageReplacement=card.type==='Stage'?next.map(item=>item.owner===actor&&item.zone==='stage'&&item.id!==cardId?{...item,zone:'trash' as CardZone,rested:false}:item):next;
 return {state:{...state,cards:withStageReplacement,playedThisTurn:[...(state.playedThisTurn??[]),cardId]},playedCardId:cardId};
}

/** An attack rests its active attacker; new Characters need Rush and the first player cannot attack on turn one. */
export function declareAttack(state:MatchEffectState,actor:PlayerId,attackerId:string,targetId:string):AttackDeclaration{
 if(state.phase&&state.phase!=='main')return {state,error:'Attacks can only be declared during the Main Phase.'};
 if(state.turn!==actor)return {state,error:'Only the turn player can attack.'};
 if(state.turnNumber===1&&state.firstPlayer===actor)return {state,error:'The first player cannot attack on their first turn.'};
 const attacker=state.cards.find(card=>card.id===attackerId),target=state.cards.find(card=>card.id===targetId);
 if(!attacker||attacker.owner!==actor||!['leader','character'].includes(attacker.zone)||attacker.rested)return {state,error:'Select an active Leader or Character to attack.'};
 if(attacker.cannotAttack)return {state,error:'This card cannot attack for the duration of the printed restriction.'};
 if(attacker.zone==='character'&&(state.playedThisTurn??[]).includes(attackerId)&&!attacker.keywords?.includes('rush')&&!attacker.temporaryKeywords?.includes('rush'))return {state,error:'A Character cannot attack on the turn it was played without Rush.'};
 if(!target||target.owner!==other(actor)||!['leader','character'].includes(target.zone))return {state,error:'Select the opponent Leader or Character as the attack target.'};
 if(target.zone==='character'&&!target.rested)return {state,error:'Characters must be rested to be chosen as an attack target.'};
 return {state:update(state,attackerId,{rested:true})};
}

/** Counter cards are played from hand during battle and go to Trash after contributing their printed Counter. */
export function playCounters(state:MatchEffectState,defender:PlayerId,cardIds:string[],donCardIds:string[]=[]):CounterResult{
 const cards=state.cards.filter(card=>cardIds.includes(card.id));
 if(cards.length!==cardIds.length||cards.some(card=>card.owner!==defender||card.zone!=='hand'||!['Character','Event'].includes(card.type??'')||!(card.counter&&card.counter>0)))return {state,total:0,error:'Selected cards are not legal Counter cards from the defending hand.'};
 const eventCost=cards.filter(card=>card.type==='Event').reduce((sum,card)=>sum+(card.cost??0),0);
 const donors=state.cards.filter(card=>donCardIds.includes(card.id));
 if(donors.length!==eventCost||donors.some(card=>card.owner!==defender||card.zone!=='cost-area'||card.type!=='DON!!'||card.rested))return {state,total:0,error:'Select active DON!! cards equal to the cost of the Counter Event cards.'};
 return {state:{...state,cards:state.cards.map(card=>donCardIds.includes(card.id)?{...card,rested:true}:cardIds.includes(card.id)?{...card,zone:'trash',rested:false}:card)},total:cards.reduce((sum,card)=>sum+(card.counter??0),0)};
}

/** Applies one already-authorized effect action. The UI provides selections; legality remains here. */
export function applyEffectAction(state:MatchEffectState,actor:PlayerId,action:EffectAction,selection:EffectSelection={}):EffectStepResult{
 if(selection.cardIds&&new Set(selection.cardIds).size!==selection.cardIds.length)return {state,error:'Each selected card must be unique.'};
 if(action.selection){
  if(!['ko','rest','cost'].includes(action.kind))return {state,error:'Target-count metadata is unsupported for this action.'};
  const single={...action,selection:undefined};
  const candidates=state.cards.filter(card=>{const result=applyEffectAction(state,actor,single,{targetId:card.id});return !result.error&&!result.requiresSelection;});
  const all=action.selection.max==='all';
  const ids=all?candidates.map(card=>card.id):selection.cardIds??(selection.targetId?[selection.targetId]:undefined);
  if(!candidates.length)return ids?.length?{state,error:'No selected target is eligible.'}:{state};
  if(!ids)return {state,requiresSelection:`Choose ${action.selection.min===0?'up to ':''}${action.selection.max} target${action.selection.max===1?'':'s'}.`};
  const minimum=Math.min(action.selection.min,candidates.length);
  if(ids.length<minimum||(!all&&ids.length>(action.selection.max as number)))return {state,error:'The number of targets does not match the printed effect.'};
  if(ids.some(id=>!candidates.some(card=>card.id===id)))return {state,error:'A selected card is outside the printed effect target.'};
  let next=state;
  for(const id of ids){const result=applyEffectAction(next,actor,single,{targetId:id});if(result.error||result.requiresSelection)return {state,error:result.error??result.requiresSelection};next=result.state;}
  return {state:next};
 }
 const opponent=other(actor);const target=selected(state,selection);const targets=selectedCards(state,selection);
 const targetResult=(message:string)=>requireTarget(state,selection,message);
 const targetCards=()=>targets.length?targets:(target?[target]:[]);
 switch(action.kind){
  case 'draw':{const cards=cardsFor(state,actor,'deck').slice(0,action.amount);return {state:{...state,cards:state.cards.map(card=>cards.some(item=>item.id===card.id)?{...card,zone:'hand'}:card)}};}
  case 'rest':{if(action.scope==='self'){const found=targetResult('Select the card to rest.');if('result'in found)return found.result;if(!legalOwner(found.card,actor))return {state,error:'Selected card is not yours.'};return {state:update(state,found.card.id,{rested:true})};}const found=targetResult('Select an opponent card.');if('result'in found)return found.result;if(!legalOwner(found.card,opponent))return {state,error:'Selected card is not an opponent card.'};const legalZone=action.scope==='opponent-leader'?found.card.zone==='leader':action.scope==='opponent-character'?found.card.zone==='character':action.scope==='opponent-don'?found.card.zone==='cost-area'&&found.card.type==='DON!!'&&!found.card.attachedTo:['leader','character'].includes(found.card.zone);if(!legalZone)return {state,error:'Selected card is outside the printed rest target.'};if(action.maxCost!==undefined&&Math.max(0,(found.card.cost??Infinity)+(found.card.costModifier??0))>action.maxCost)return {state,error:'Selected card exceeds the printed cost limit.'};return {state:update(state,found.card.id,{rested:true})};}
  case 'ready':{
   const cards=targetCards();if(!selection.cardIds&&!selection.targetId)return {state,requiresSelection:'Select cards to set active.'};
   if(cards.length!==(selection.cardIds?.length??1)||cards.length>(action.amount??1))return {state,error:'Invalid number of cards selected.'};
   if(cards.some(card=>!legalOwner(card,actor)||(action.scope==='own-character'?card.zone!=='character':action.scope==='own-don'?card.zone!=='cost-area'||card.type!=='DON!!'||Boolean(card.attachedTo):!['leader','character','stage'].includes(card.zone))))return {state,error:'Selected card is outside the printed ready target.'};
   return {state:cards.reduce((next,card)=>card.cannotReady?next:update(next,card.id,{rested:false}),state)};
  }
  case 'ko':{const found=targetResult('Select an opponent Character.');if('result'in found)return found.result;const card=found.card;if(!legalOwner(card,opponent)||card.zone!=='character')return {state,error:'Selected card is not an opponent Character.'};if(card.preventKo==='effect'||card.preventKo==='any')return {state,error:'This Character cannot be K.O.’d by effects.'};if(action.maxCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))>action.maxCost)return {state,error:'Selected Character exceeds the printed cost limit.'};if(action.maxPower!==undefined&&((card.power??Infinity)+(card.powerModifier??0))>action.maxPower)return {state,error:'Selected Character exceeds the printed power limit.'};if(action.restedOnly&&!card.rested)return {state,error:'Selected Character must be rested.'};return {state:move(state,card.id,'trash')};}
  case 'return-to-hand':case 'return-to-deck':case 'bottom-deck':{const found=targetResult('Select a legal card.');if('result'in found)return found.result;const card=found.card;const expected=action.scope==='own-character'||action.scope==='trash'?actor:opponent;const zoneForScope=action.scope==='trash'?'trash':action.scope==='opponent-hand'?'hand':'character';if((action.scope!=='any-character'&&!legalOwner(card,expected))||card.zone!==zoneForScope)return {state,error:'Selected card is outside the printed effect target.'};if('maxCost'in action&&action.maxCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))>action.maxCost)return {state,error:'Selected card exceeds the printed cost limit.'};return {state:action.kind==='return-to-hand'?move(state,card.id,'hand'):moveToDeck(state,[card.id],action.kind==='return-to-deck'?action.position:'bottom')};}
  case 'trash':{const zone=action.scope==='hand'?'hand':action.scope==='deck'?'deck':action.scope==='opponent-hand'?'hand':undefined;const owner=action.scope==='opponent-hand'?opponent:actor;if(action.scope==='self'){const found=targetResult('Select this card.');if('result'in found)return found.result;if(!legalOwner(found.card,actor))return {state,error:'Selected card is not yours.'};return {state:move(state,found.card.id,'trash')};}const candidates=cardsFor(state,owner,zone).filter(card=>(!action.requiresTrigger||hasTrigger(card))&&(!action.color||card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))&&(!action.trait||card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))&&(!action.cardType||card.type===action.cardType)&&(action.maxCost===undefined||(card.cost??Infinity)<=action.maxCost));const required=Math.min(action.amount,candidates.length);if(action.scope==='deck')return {state:candidates.slice(0,required).reduce((next,card)=>move(next,card.id,'trash'),state)};if(required===0)return {state};const ids=selection.cardIds;if(!ids)return {state,requiresSelection:`Select ${required} card${required===1?'':'s'}.`};if(ids.length!==required)return {state,error:`Select exactly ${required} card${required===1?'':'s'}.`};if(ids.some(id=>!candidates.some(card=>card.id===id)))return {state,error:'A selected card is outside the legal zone.'};return {state:{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,zone:'trash'}:card)}};}
  case 'power':case 'cost':case 'set-power':case 'set-cost':case 'base-power':case 'copy-base-power':case 'swap-power':case 'negate-effect':{const found=targetResult('Select the card affected by this effect.');if('result'in found)return found.result;const card=found.card;const expected=('target' in action&&String(action.target).startsWith('opponent'))?opponent:actor;if(!legalOwner(card,expected)||!['leader','character'].includes(card.zone)||('target'in action&&action.target.endsWith('character')&&card.zone!=='character')||('target'in action&&action.target.endsWith('leader')&&card.zone!=='leader'))return {state,error:'Selected card is outside the printed effect target.'};if(action.kind==='power')return {state:effect(update(state,card.id,{powerModifier:(card.powerModifier??0)+action.amount}),'power',card.id,action.amount,undefined,action.until)};if(action.kind==='cost')return {state:effect(update(state,card.id,{costModifier:(card.costModifier??0)+action.amount}),'cost',card.id,action.amount,undefined,'turn-end')};if(action.kind==='set-power'||action.kind==='base-power')return {state:effect(update(state,card.id,{power:action.amount,powerModifier:0}),action.kind,card.id,action.amount)};if(action.kind==='set-cost')return {state:effect(update(state,card.id,{cost:action.amount,costModifier:0}),'set-cost',card.id,action.amount)};if(action.kind==='negate-effect')return {state:effect(update(state,card.id,{effectNegated:true}),'negate-effect',card.id,action.amount)};if(action.kind==='copy-base-power'){const source=selection.cardIds?.map(id=>state.cards.find(item=>item.id===id)).find((item):item is MatchCard=>Boolean(item));if(!source||!legalOwner(source,opponent)||source.zone!=='character')return {state,requiresSelection:'Select an opponent Character whose base power will be copied.'};return {state:effect(update(state,card.id,{power:source.power,powerModifier:0}),'copy-base-power',card.id,source.power)};}const otherCard=selection.cardIds?.map(id=>state.cards.find(item=>item.id===id)).find((item):item is MatchCard=>Boolean(item));if(!otherCard||!['leader','character'].includes(otherCard.zone)||otherCard.id===card.id)return {state,requiresSelection:'Select the other Leader or Character whose power will be swapped.'};return {state:effect({...state,cards:state.cards.map(item=>item.id===card.id?{...item,power:otherCard.power,powerModifier:0}:item.id===otherCard.id?{...item,power:card.power,powerModifier:0}:item)},'swap-power',card.id,otherCard.power)};}
  case 'grant-keyword':{const found=targetResult('Select the Leader or Character that gains this keyword.');if('result'in found)return found.result;const card=found.card;if(!legalOwner(card,actor)||!['leader','character'].includes(card.zone))return {state,error:'Select your Leader or Character.'};const temporaryKeywords=[...new Set([...(card.temporaryKeywords??[]),action.keyword])];return {state:effect(update(state,card.id,{temporaryKeywords}),'grant-keyword',card.id,undefined,action.keyword,action.until)};}
  case 'prevent-ko':{const found=targetResult('Select the Character protected from K.O.');if('result'in found)return found.result;const card=found.card;if(!legalOwner(card,actor)||card.zone!=='character')return {state,error:'Select one of your Characters.'};return {state:effect(update(state,card.id,{preventKo:action.by}),'prevent-ko',card.id)};}
  case 'attack-restriction':case 'prevent-rest':case 'prevent-ready':{const found=targetResult('Select the card affected by this restriction.');if('result'in found)return found.result;const card=found.card;if(!legalOwner(card,opponent)||!['leader','character','cost-area'].includes(card.zone))return {state,error:'Select an opponent card affected by this restriction.'};const patch=action.kind==='attack-restriction'?{cannotAttack:true}:action.kind==='prevent-ready'?{cannotReady:true}:{rested:true};return {state:effect(update(state,card.id,patch),action.kind,card.id)};}
  case 'don-power':return {state:effect(state,'don-power',undefined,action.amount)};
  case 'reorder-deck':{
   const top=cardsFor(state,actor,'deck').slice(0,action.amount);
   if(!selection.cardIds)return {state,requiresSelection:'Choose the order of the inspected cards.'};
   const ids=selection.cardIds;
   if(ids.length!==top.length||new Set(ids).size!==ids.length||ids.some(id=>!top.some(card=>card.id===id)))return {state,error:'Order each inspected card exactly once.'};
   const ordered=ids.map(id=>top.find(card=>card.id===id)!);
   const rest=state.cards.filter(card=>!ids.includes(card.id));
   return {state:{...state,cards:action.position==='top'?[...ordered,...rest]:[...rest,...ordered]}};
  }
  case 'search':{
   const revealed=cardsFor(state,actor,'deck').slice(0,action.amount);
   if(!selection.cardIds)return {state,requiresSelection:'Choose eligible cards, or explicitly choose none.'};
   if(new Set(selection.cardIds).size!==selection.cardIds.length)return {state,error:'Duplicate selection.'};
   const cards=targetCards();
   if(cards.length!==selection.cardIds.length||cards.length>action.choose)return {state,error:'Invalid number of cards selected.'};
   if(cards.some(card=>!revealed.some(item=>item.id===card.id)||!matchesSearch(card,action)))return {state,error:'Selected card does not satisfy the printed search restriction.'};
   const remainder=revealed.filter(card=>!cards.some(item=>item.id===card.id));
   const untouched=state.cards.filter(card=>!revealed.some(item=>item.id===card.id));
   return {state:{...state,cards:[...untouched,...cards.map(card=>({...card,zone:'hand' as const})),...remainder.map(card=>({...card,zone:action.destination==='trash'?'trash' as const:'deck' as const}))]}};
  }
  case 'play':{const cards=targetCards();if(!cards.length)return {state,requiresSelection:'Select a card to play.'};if(cards.length>(action.amount??1))return {state,error:'Too many cards selected.'};const legal=cards.every(card=>legalOwner(card,actor)&&card.zone===action.source&&(action.maxCost===undefined||(card.cost??Infinity)<=action.maxCost)&&(!action.trait||card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))&&(!action.color||card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))&&(!action.excludeName||card.name?.toLowerCase()!==action.excludeName.toLowerCase()));if(!legal)return {state,error:'Selected card does not satisfy the printed play restriction.'};return {state:{...state,cards:state.cards.map(card=>cards.some(item=>item.id===card.id)?{...card,zone:card.type==='Stage'?'stage':'character',rested:Boolean(action.rested)}:card)}};}
  case 'life':{const life=cardsFor(state,actor,'life').slice(0,action.amount);if(action.operation==='add-to-hand')return {state:{...state,cards:state.cards.map(card=>life.some(item=>item.id===card.id)?{...card,zone:'hand'}:card)}};if(action.operation==='trash')return {state:{...state,cards:state.cards.map(card=>life.some(item=>item.id===card.id)?{...card,zone:'trash'}:card)}};return {state:effect(state,'life',undefined,action.amount)};}
  case 'trash-life':{const owners=action.scope==='both'?[actor,opponent]:[action.scope==='own'?actor:opponent];const ids=owners.flatMap(owner=>cardsFor(state,owner,'life').slice(0,action.amount).map(card=>card.id));return {state:{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,zone:'trash'}:card)}};}
  case 'move-to-life':{const owner=action.scope==='own'?actor:opponent;const cards=targetCards();if(cards.length>action.amount)return {state,error:'Too many cards selected.'};if(cards.some(card=>!legalOwner(card,owner)||!['hand','character','trash'].includes(card.zone)))return {state,error:'Selected card cannot be placed in Life.'};return {state:{...state,cards:state.cards.map(card=>cards.some(item=>item.id===card.id)?{...card,zone:'life',faceUp:Boolean(action.faceUp),rested:false}:card)}};}
  case 'recover':{const cards=targetCards();if(cards.length>action.amount)return {state,error:'Too many cards selected.'};if(cards.some(card=>!legalOwner(card,actor)||card.zone!=='trash'||(action.maxCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))>action.maxCost)||(action.trait&&!card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))||(action.color&&card.color?.toLowerCase()!==action.color.toLowerCase())||(action.excludeName&&card.name?.toLowerCase()===action.excludeName.toLowerCase())))return {state,error:'Selected card does not satisfy the printed recovery restriction.'};return {state:{...state,cards:state.cards.map(card=>cards.some(item=>item.id===card.id)?{...card,zone:'hand'}:card)}};}
  case 'return-trash-to-deck-bottom':{const cards=targetCards();if(cards.length!==action.amount)return {state,requiresSelection:`Select ${action.amount} card${action.amount===1?'':'s'} from Trash.`};if(cards.some(card=>!legalOwner(card,actor)||card.zone!=='trash'))return {state,error:'Selected card is not in your Trash.'};return {state:moveToDeck(state,cards.map(card=>card.id),'bottom')};}
  case 'bottom-deck-hand':{return {state:moveToDeck(state,cardsFor(state,actor,'hand').map(card=>card.id),'bottom')};}
  case 'hand-reset':{const owner=action.scope==='self'?actor:opponent;const hand=cardsFor(state,owner,'hand');const deck=cardsFor(state,owner,'deck');const combined=[...deck,...hand];const drawn=combined.slice(0,action.draw??hand.length).map(card=>card.id);return {state:{...state,cards:state.cards.map(card=>card.owner===owner&&card.zone==='hand'?{...card,zone:drawn.includes(card.id)?'hand':'deck'}:drawn.includes(card.id)?{...card,zone:'hand'}:card)}};}
  case 'reorder-life':case 'reveal':return {state:effect(state,action.kind,target?.id,'amount'in action&&typeof action.amount==='number'?action.amount:undefined)};
  case 'add-don':{const cards=cardsFor(state,actor,'don-deck').slice(0,action.amount);return {state:{...state,cards:state.cards.map(card=>cards.some(item=>item.id===card.id)?{...card,zone:'cost-area',rested:Boolean(action.rested)}:card)}};}
  case 'return-don':{const cards=targetCards();if(cards.length!==action.amount)return {state,requiresSelection:`Select ${action.amount} DON!! card${action.amount===1?'':'s'} to return.`};if(cards.some(card=>!legalOwner(card,actor)||card.type!=='DON!!'||card.zone!=='cost-area'))return {state,error:'A selected card is not your DON!!.'};return {state:{...state,cards:state.cards.map(card=>cards.some(item=>item.id===card.id)?{...card,zone:'don-deck',rested:false,attachedTo:undefined}:card)}};}
  case 'attach-don':{const found=targetResult('Select your Leader or Character.');if('result'in found)return found.result;const recipient=found.card;if(!legalOwner(recipient,actor)||!['leader','character'].includes(recipient.zone))return {state,error:'Select your Leader or Character to receive DON!!.'};const dons=selectedCards(state,selection);if(!selection.cardIds)return {state,requiresSelection:`Select up to ${action.amount} DON!! card${action.amount===1?'':'s'} to attach.`};if(dons.length>action.amount)return {state,error:'Too many DON!! cards selected.'};const legalDons=dons.every(card=>legalOwner(card,actor)&&card.type==='DON!!'&&(action.source==='attached'?Boolean(card.attachedTo):card.zone==='cost-area'&&!card.attachedTo&&(action.rested?Boolean(card.rested):!card.rested)));if(!legalDons)return {state,error:'Selected DON!! do not match the printed source or rested state.'};return {state:{...state,cards:state.cards.map(card=>dons.some(don=>don.id===card.id)?{...card,zone:'cost-area',attachedTo:recipient.id}:card)}};}
  case 'attach-don-required':return {state:effect(state,action.kind,target?.id,action.amount)};
  case 'return-trash-to-deck-bottom':case 'recover':case 'hand-reset':case 'shuffle':case 'bottom-deck-hand':case 'reveal-hand':case 'hand-limit':case 'play-or-life':case 'activate-referenced-effect':case 'activate-main-effect':case 'blocker':case 'counter':case 'rush':case 'double-attack':case 'banish':case 'on-ko':case 'on-block':case 'attack-permission':case 'attack-restriction':case 'prevent-ready':case 'prevent-rest':case 'prevent-ko':case 'grant-keyword':case 'replacement':case 'custom-resolver':case 'draw-by':return {state:effect(state,action.kind,target?.id,'amount'in action&&typeof action.amount==='number'?action.amount:undefined)};
  default:return {state,error:'Unhandled effect action.'};
 }
}

export function payEffectCost(state:MatchEffectState,actor:PlayerId,cost:EffectCost,selection:EffectSelection={}):EffectStepResult{
 if(cost.kind==='rest'&&cost.scope==='don'){const ids=selection.cardIds??[];if(new Set(ids).size!==ids.length)return {state,error:'Each payment card must be unique.'};const dons=cardsFor(state,actor,'cost-area').filter(card=>card.type==='DON!!'&&!card.rested);if(ids.length!==cost.amount)return {state,requiresSelection:`Select ${cost.amount} active DON!! card${cost.amount===1?'':'s'}.`};if(ids.some(id=>!dons.some(card=>card.id===id)))return {state,error:'A selected DON!! cannot pay this cost.'};return {state:{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,rested:true}:card)}};}
 if(cost.kind==='trash'&&cost.scope==='hand'){if(!selection.cardIds)return {state,requiresSelection:`Select ${cost.amount} card${cost.amount===1?'':'s'} to pay the cost.`};if(selection.cardIds.length!==cost.amount)return {state,error:`The cost requires exactly ${cost.amount} cards.`};const payment=selectedCards(state,selection);if(payment.length!==cost.amount||payment.some(card=>card.owner!==actor||card.zone!=='hand'||(cost.requiresTrigger&&!hasTrigger(card))||(cost.color&&!card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===cost.color!.toLowerCase()))||(cost.trait&&!card.traits?.some(trait=>trait.toLowerCase()===cost.trait!.toLowerCase()))||(cost.cardType&&card.type!==cost.cardType)||(cost.maxCost!==undefined&&(card.cost??Infinity)>cost.maxCost)))return {state,error:'Selected cards cannot pay this cost.'};return applyEffectAction(state,actor,{kind:'trash',scope:'hand',amount:cost.amount,requiresTrigger:cost.requiresTrigger,color:cost.color,trait:cost.trait,cardType:cost.cardType,maxCost:cost.maxCost},selection);}
 if(cost.kind==='return-don')return applyEffectAction(state,actor,{kind:'return-don',amount:cost.amount},selection);
 if(cost.kind==='rest'&&cost.scope==='self'){if(!selection.targetId)return {state,requiresSelection:'Select this card.'};const card=state.cards.find(item=>item.id===selection.targetId);if(!card||!legalOwner(card,actor))return {state,error:'Selected card is not yours.'};if(card.rested)return {state,error:'A rested card cannot pay a rest cost.'};return {state:update(state,selection.targetId,{rested:true})};}
 return {state,error:'Unsupported cost.'};
}

export type BattleResolution={
 state:MatchEffectState;
 winner:'attacker'|'defender'|'none';
 defeatedCharacterId?:string;
 leaderDamaged?:PlayerId;
 lifeCardId?:string;
 lifeCardIds?:string[];
 triggerAvailable?:boolean;
 gameOver?:PlayerId;
 error?:string;
};

/** A Blocker must be an active Character with the keyword; declaring it rests it and retargets the attack. */
export function declareBlock(state:MatchEffectState,defender:PlayerId,blockerId:string):BattleResolution{
 const blocker=state.cards.find(card=>card.id===blockerId);
 if(!blocker||blocker.owner!==defender||blocker.zone!=='character')return {state,winner:'none',error:'Selected card is not a defending Character.'};
 if(blocker.rested)return {state,winner:'none',error:'A rested Character cannot activate Blocker.'};
 if(!blocker.keywords?.includes('blocker')&&!blocker.temporaryKeywords?.includes('blocker'))return {state,winner:'none',error:'Selected Character does not have Blocker.'};
 return {state:update(state,blockerId,{rested:true}),winner:'none'};
}

/** Resolves a battle after Block and Counter choices. Equal power defeats a Character or damages a Leader. */
export function resolveBattle(state:MatchEffectState,attackerId:string,defenderId:string,attackingPower:number,defendingPower:number):BattleResolution{
 const attacker=state.cards.find(card=>card.id===attackerId),defender=state.cards.find(card=>card.id===defenderId);
 if(!attacker||!defender)return {state,winner:'none',error:'Attacker or defender is missing.'};
 if(defender.zone==='leader'){
  if(attackingPower<defendingPower)return {state,winner:'defender'};
  const doubleAttack=attacker.keywords?.includes('double-attack')||attacker.temporaryKeywords?.includes('double-attack');
  const banish=attacker.keywords?.includes('banish')||attacker.temporaryKeywords?.includes('banish');
  const lifeCards=cardsFor(state,defender.owner,'life').slice(0,doubleAttack?2:1);
  if(!lifeCards.length)return {state,winner:'attacker',leaderDamaged:defender.owner,gameOver:defender.owner};
  const next=lifeCards.reduce((current,life)=>move(current,life.id,banish?'trash':'hand'),state);
  return {state:next,winner:'attacker',leaderDamaged:defender.owner,lifeCardId:lifeCards[0].id,lifeCardIds:lifeCards.map(card=>card.id),triggerAvailable:!banish&&lifeCards.some(hasTrigger),...(lifeCards.length<(doubleAttack?2:1)?{gameOver:defender.owner}:{})};
 }
 if(defender.zone!=='character')return {state,winner:'none',error:'Defender is not on the field.'};
 if(attackingPower<defendingPower)return {state,winner:'defender'};
 const protectedFromBattle=defender.keywords?.includes('prevent-ko-battle')||defender.preventKo==='battle'||defender.preventKo==='any';
 if(protectedFromBattle)return {state,winner:'attacker'};
 return {state:move(state,defender.id,'trash'),winner:'attacker',defeatedCharacterId:defender.id};
}
