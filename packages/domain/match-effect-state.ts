import {evaluateEffectCondition} from './effect-conditions';
import {matchesSearch,matchesSearchSelection} from './search-eligibility';
import {compileEffectDocument,type EffectAction,type EffectCost,type EffectTrigger,type EffectDocument} from './effect-rules';
import {resolveCardEffect,type EffectCommand} from './effect-runtime';
import type {Card} from '../card-data/catalog';

export type PlayerId='player'|'opponent';
export type CardZone='deck'|'hand'|'life'|'trash'|'character'|'leader'|'stage'|'cost-area'|'don-deck';
export type MatchCard={id:string;owner:PlayerId;zone:CardZone;type?:'Character'|'Leader'|'Stage'|'Event'|'DON!!';cost?:number;power?:number;counter?:number;name?:string;color?:string;traits?:string[];attributes?:string[];rested?:boolean;attachedTo?:string;faceUp?:boolean;keywords?:string[];powerModifier?:number;costModifier?:number;temporaryKeywords?:string[];cannotAttack?:boolean;cannotReady?:boolean;effectNegated?:boolean;preventKo?:'battle'|'effect'|'any';effectText?:string;effectSchema?:EffectDocument;code?:string};
export type TurnPhase='refresh'|'draw'|'don'|'main'|'end';
export type MatchEffectState={cards:MatchCard[];turn:PlayerId;turnEffects:Array<{kind:string;target?:string;amount?:number;detail?:string;expires?:'battle'|'turn-end'|'opponent-next-turn'}>;restrictions:string[];delayed:Array<{when:'next-main-phase'|'end-turn'|'replacement';instruction:string}>;phase?:TurnPhase;turnNumber?:number;firstPlayer?:PlayerId;playedThisTurn?:string[]};
export type EffectSelection={replacementIds?:string[];owner?:PlayerId;position?:'top'|'bottom';cardIds?:string[];targetId?:string;sourceCardId?:string;choice?:string};
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
const effect=(state:MatchEffectState,kind:string,target?:string,amount?:number,detail?:string,expires?:'battle'|'turn-end'|'opponent-next-turn'):MatchEffectState=>({...state,turnEffects:[...state.turnEffects,{kind,target,amount,detail,expires}]});
const requireTarget=(state:MatchEffectState,selection:EffectSelection,message:string):{card:MatchCard}|{result:EffectStepResult}=>{const card=selected(state,selection);return card?{card}:{result:{state,requiresSelection:message}};};
const legalOwner=(card:MatchCard|undefined,owner:PlayerId)=>Boolean(card&&card.owner===owner);
function protectedFromEffect(state:MatchEffectState,target:MatchCard,sourceCardId?:string):boolean{
 if(target.preventKo==='effect'||target.preventKo==='any')return true;
 const source=sourceCardId?state.cards.find(card=>card.id===sourceCardId):undefined;
 const attachedDonCount=state.cards.filter(card=>card.owner===target.owner&&card.type==='DON!!'&&card.attachedTo===target.id).length;
 return state.cards.some(protector=>(protector.zone==='character'||protector.zone==='leader')&&!protector.effectNegated&&Boolean(protector.effectSchema?.ast.some(ability=>protectionConditionsMet(state,protector,ability)&&ability.actions.some(action=>action.kind==='prevent-ko'&&action.by==='effect'
  &&(protector.id===target.id||action.protects==='own-characters'&&protector.owner===target.owner||action.protects==='characters')
  &&(action.protectedMaxCost===undefined||(target.cost??Infinity)<=action.protectedMaxCost)
  &&(action.protectedExactCost===undefined||target.cost===action.protectedExactCost)
  &&(!action.protectedTrait||target.traits?.some(trait=>trait.toLowerCase()===action.protectedTrait!.toLowerCase()))
  &&(!action.protectedExcludeName||action.protectedExcludeOwnerOnly&&protector.owner!==target.owner||target.name?.toLowerCase()!==action.protectedExcludeName.toLowerCase())
  &&(!action.protectedMustBeActive||!target.rested)
  &&(action.requiresAttachedDon===undefined||attachedDonCount>=action.requiresAttachedDon)
  &&(!action.byCardType||(action.byCardType==='Leader or Character'?Boolean(source&&['Leader','Character'].includes(source.type??'')):source?.type===action.byCardType))
  &&(action.sourceMaxPower===undefined||(source?.power??Infinity)<=action.sourceMaxPower)
  &&(!action.attribute||source?.attributes?.some(attribute=>attribute.toLowerCase()===action.attribute!.toLowerCase()))
  &&(!action.excludeAttribute||(source?.type==='Character'&&!source.attributes?.some(attribute=>attribute.toLowerCase()===action.excludeAttribute!.toLowerCase())))))));
}
function protectionConditionsMet(state:MatchEffectState,protectedCard:MatchCard,ability:EffectDocument['ast'][number]):boolean{
 return ability.conditions.every(condition=>{
  if(/^this Character is active$/i.test(condition.text))return !protectedCard.rested;
  if(/^this Character is rested$/i.test(condition.text))return Boolean(protectedCard.rested);
  return evaluateEffectCondition(condition.text,state,protectedCard.owner,protectedCard.id)===true;
 });
}



/** Returns the executable commands for any printed timing window on a card in the match. */
export function commandsForTiming(state:MatchEffectState,cardId:string,timing:EffectTrigger):EffectCommand[]{
 const card=state.cards.find(item=>item.id===cardId);
 if(!card?.effectText||card.effectNegated)return [];
 const source={id:card.id,code:card.code??card.id,name:card.name??card.id,color:card.color??'',type:card.type??'Character',cost:card.cost??0,power:card.power??0,counter:card.counter??0,rarity:'',art:0,effect:card.effectText} as Card;
 return resolveCardEffect(card.effectSchema??compileEffectDocument(source),timing).commands;
}

export function expireEffectModifiers(state:MatchEffectState,window:'battle'|'turn-end'|'opponent-next-turn',owner?:PlayerId):MatchEffectState{
 const expired=state.turnEffects.filter(effect=>effect.expires===window&&(window!=='opponent-next-turn'||Boolean(owner&&state.cards.find(card=>card.id===effect.target)?.owner===owner))||(window==='turn-end'&&effect.expires==='battle'));
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

export function shuffleDeck(state:MatchEffectState,owner:PlayerId,random:()=>number=Math.random):MatchEffectState{
 const deck=cardsFor(state,owner,'deck').slice();
 for(let index=deck.length-1;index>0;index--){const sample=random();if(sample<0||sample>=1||!Number.isFinite(sample))throw new Error('Shuffle random values must be in [0, 1).');const otherIndex=Math.floor(sample*(index+1));[deck[index],deck[otherIndex]]=[deck[otherIndex],deck[index]];}
 let index=0;
 return {...state,cards:state.cards.map(card=>card.owner===owner&&card.zone==='deck'?deck[index++]:card)};
}

export type TurnStartResult={state:MatchEffectState;drawnCardId?:string;addedDonIds:string[];gameOver?:PlayerId};
export type CardPlayResult={state:MatchEffectState;playedCardId?:string;requiresSelection?:string;error?:string};
export type AttackDeclaration={state:MatchEffectState;error?:string};
export type CounterResult={state:MatchEffectState;total:number;error?:string};

/** Runs Refresh, Draw, and DON!! in the order mandated by the official turn flow. */
export function beginTurn(state:MatchEffectState,actor:PlayerId,turnNumber=(state.turnNumber??0)+1):TurnStartResult{
 state=expireEffectModifiers(state,'turn-end');
 state=expireEffectModifiers(state,'opponent-next-turn',actor);
 const skippedReadyIds=new Set(state.turnEffects.filter(effect=>effect.kind==='skip-next-refresh'&&state.cards.some(card=>card.id===effect.target&&card.owner===actor)).map(effect=>effect.target));
 const firstTurn=turnNumber===1&&state.firstPlayer===actor;
 const returned=state.cards.map(card=>card.owner===actor&&card.type==='DON!!'&&card.attachedTo?{...card,zone:'cost-area' as CardZone,attachedTo:undefined,rested:true}:card);
 const refreshed=returned.map(card=>card.owner===actor&&['leader','character','stage','cost-area'].includes(card.zone)?{...card,rested:skippedReadyIds.has(card.id)?true:false,powerModifier:undefined,costModifier:undefined,temporaryKeywords:undefined,cannotAttack:undefined,cannotReady:undefined,effectNegated:undefined,preventKo:undefined}:card);
 const deck=refreshed.filter(card=>card.owner===actor&&card.zone==='deck');
 if(!firstTurn&&!deck.length)return {state:{...state,cards:refreshed,turn:actor,turnNumber,phase:'draw'},addedDonIds:[],gameOver:actor};
 const drawn=firstTurn?undefined:deck[0];
 const afterDraw=drawn?refreshed.map(card=>card.id===drawn.id?{...card,zone:'hand' as CardZone}:card):refreshed;
 const donCount=firstTurn?1:2;
 const dons=afterDraw.filter(card=>card.owner===actor&&card.zone==='don-deck').slice(0,donCount);
 const nextState={...state,turnEffects:state.turnEffects.filter(effect=>!skippedReadyIds.has(effect.target)),cards:afterDraw.map(card=>dons.some(don=>don.id===card.id)?{...card,zone:'cost-area' as CardZone,rested:false}:card),turn:actor,turnNumber,phase:'main' as TurnPhase,playedThisTurn:[]};
 return {state:nextState,drawnCardId:drawn?.id,addedDonIds:dons.map(card=>card.id),gameOver:!firstTurn&&deck.length===1?actor:undefined};
}

function replaceCharactersForPlay(state:MatchEffectState,actor:PlayerId,incoming:number,ids?:string[]):EffectStepResult{
 const field=cardsFor(state,actor,'character');
 const required=Math.max(0,field.length+incoming-5);
 if(!required)return ids?.length?{state,error:'No Character replacement is needed.'}:{state};
 if(!ids)return {state,requiresSelection:`Choose ${required} existing Character${required===1?'':'s'} to trash before playing.`};
 if(ids.length!==required||new Set(ids).size!==ids.length||ids.some(id=>!field.some(card=>card.id===id)))return {state,error:'Choose the required number of different Characters from your Character area.'};
 return {state:ids.reduce((next,id)=>move(next,id,'trash'),state)};
}

/** Pays a normal card cost with active DON!! and applies the ordinary play destination. */
export function playCard(state:MatchEffectState,actor:PlayerId,cardId:string,replacementIds?:string[]):CardPlayResult{
 if(state.phase&&state.phase!=='main')return {state,error:'Cards can only be played during the Main Phase.'};
 const card=state.cards.find(item=>item.id===cardId);
 if(!card||card.owner!==actor||card.zone!=='hand'||!['Character','Stage','Event'].includes(card.type??''))return {state,error:'Select a Character, Stage, or Event from your hand.'};
 if(card.type==='Event'&&!card.keywords?.includes('main'))return {state,error:'Only an Event with [Main] can be activated during the Main Phase.'};
 const cost=card.cost??0;const donors=cardsFor(state,actor,'cost-area').filter(item=>item.type==='DON!!'&&!item.rested&&!item.attachedTo).slice(0,cost);
 if(donors.length!==cost)return {state,error:'There are not enough active DON!! cards to pay this cost.'};
 const capacity=replaceCharactersForPlay(state,actor,card.type==='Character'?1:0,replacementIds);
 if(capacity.error||capacity.requiresSelection)return capacity;
 const next=capacity.state.cards.map(item=>donors.some(don=>don.id===item.id)?{...item,rested:true}:item).map(item=>{
  if(item.id!==cardId)return item;
  if(item.type==='Event')return {...item,zone:'trash' as CardZone,rested:false};
  return {...item,zone:(item.type==='Stage'?'stage':'character') as CardZone,rested:false};
 });
 const withStageReplacement=card.type==='Stage'?next.map(item=>item.owner===actor&&item.zone==='stage'&&item.id!==cardId?{...item,zone:'trash' as CardZone,rested:false}:item):next;
 return {state:{...capacity.state,cards:withStageReplacement,playedThisTurn:[...(state.playedThisTurn??[]),cardId]},playedCardId:cardId};
}

/** An attack rests its active attacker; new Characters need Rush and the first player cannot attack on turn one. */
export function hasCardKeyword(card:MatchCard,keyword:string,state?:MatchEffectState):boolean{
 if(card.temporaryKeywords?.includes(keyword))return true;
 if(card.effectNegated)return false;
 if(card.keywords?.includes(keyword))return true;
 return Boolean(card.effectSchema?.ast.some(ability=>{
  const requiredDon=ability.actions.find(action=>action.kind==='attach-don-required')?.amount??0;
  const hasRequiredDon=requiredDon===0||Boolean(state&&state.cards.filter(don=>don.owner===card.owner&&don.type==='DON!!'&&don.attachedTo===card.id).length>=requiredDon);
  return ability.actions.some(action=>action.kind===keyword||action.kind==='grant-keyword'&&action.keyword===keyword&&hasRequiredDon&&(!action.continuous||Boolean(state&&protectionConditionsMet(state,card,ability))));
 }));
}

export function declareAttack(state:MatchEffectState,actor:PlayerId,attackerId:string,targetId:string):AttackDeclaration{
 if(state.phase&&state.phase!=='main')return {state,error:'Attacks can only be declared during the Main Phase.'};
 if(state.turn!==actor)return {state,error:'Only the turn player can attack.'};
 if(state.turnNumber===1&&state.firstPlayer===actor)return {state,error:'The first player cannot attack on their first turn.'};
 const attacker=state.cards.find(card=>card.id===attackerId),target=state.cards.find(card=>card.id===targetId);
 if(!attacker||attacker.owner!==actor||!['leader','character'].includes(attacker.zone)||attacker.rested)return {state,error:'Select an active Leader or Character to attack.'};
 if(attacker.cannotAttack)return {state,error:'This card cannot attack for the duration of the printed restriction.'};
 if(attacker.effectSchema?.ast.some(ability=>ability.actions.some(action=>action.kind==='attack-prohibition'&&(action.scope==='own-leader'?attacker.zone==='leader':attacker.zone==='character'))))return {state,error:'This Leader cannot attack.'};
 if(attacker.zone==='character'&&(state.playedThisTurn??[]).includes(attackerId)&&!hasCardKeyword(attacker,'rush',state))return {state,error:'A Character cannot attack on the turn it was played without Rush.'};
 if(!target||target.owner!==other(actor)||!['leader','character'].includes(target.zone))return {state,error:'Select the opponent Leader or Character as the attack target.'};
 if(target.zone==='character'&&!target.rested){const permission=state.turnEffects.some(effect=>effect.kind==='attack-permission'&&effect.target===attackerId&&effect.amount===1)||attacker.effectSchema?.ast.some(ability=>ability.actions.some(action=>action.kind==='attack-permission'&&action.activeTargets&&!action.until));if(!permission)return {state,error:'Characters must be rested to be chosen as an attack target.'};}
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
 if(action.kind==='add-don'&&action.selection){const available=cardsFor(state,actor,'don-deck').filter(card=>card.type==='DON!!');if(!available.length)return {state};if(!selection.cardIds)return {state,requiresSelection:`Choose up to ${Math.min(action.amount,available.length)} DON!! to add.`};const ids=selection.cardIds;if(ids.length>action.amount||ids.some(id=>!available.some(card=>card.id===id)))return {state,error:'Choose only available DON!! cards up to the printed amount.'};return {state:{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,zone:'cost-area',rested:Boolean(action.rested)}:card)}};}
 if(action.kind==='trash-life'&&action.selection){const available=action.scope==='both'?[actor,other(actor)].flatMap(owner=>cardsFor(state,owner,'life').slice(0,action.amount)):cardsFor(state,action.scope==='own'?actor:other(actor),'life').slice(0,action.amount);if(!available.length)return {state};if(selection.choice===undefined)return {state,requiresSelection:`Choose how many top Life cards to trash (up to ${Math.min(action.amount,available.length)}).`};const count=Number(selection.choice);if(!Number.isInteger(count)||count<0||count>Math.min(action.amount,available.length))return {state,error:'Choose a valid number of top Life cards to trash.'};if(count===0)return {state};return {state:available.slice(0,count).reduce((next,card)=>move(next,card.id,'trash',{faceUp:undefined}),state)};}
 if(action.kind==='attach-don'&&action.selection){const recipient=selected(state,selection);if(!recipient||!legalOwner(recipient,actor)||!['leader','character'].includes(recipient.zone))return {state,error:'Select your Character receiving the DON!!.'};if(!selection.cardIds)return {state,requiresSelection:`Choose up to ${action.amount} rested DON!! to attach.`};const ids=selection.cardIds;if(ids.length>action.amount)return {state,error:'Too many DON!! cards selected.'};const donors=ids.map(id=>state.cards.find(card=>card.id===id));if(donors.some(card=>!card||card.owner!==actor||card.type!=='DON!!'||card.zone!=='cost-area'||card.attachedTo||Boolean(card.rested)!==Boolean(action.rested)))return {state,error:'Selected DON!! do not match the printed source or rested state.'};return {state:{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,attachedTo:recipient.id}:card)}};}
 if(action.selection){
  if(!['ko','rest','cost','power','return-to-hand','bottom-deck','ready','move-to-life','life','play','grant-keyword','prevent-ready'].includes(action.kind))return {state,error:'Target-count metadata is unsupported for this action.'};
  const single={...action,selection:undefined};
  const candidates=state.cards.filter(card=>{const result=applyEffectAction(state,actor,single,{targetId:card.id,sourceCardId:selection.sourceCardId});return !result.error&&!result.requiresSelection;});
  const all=action.selection.max==='all';
  const ids=all?candidates.map(card=>card.id):selection.cardIds??(selection.targetId?[selection.targetId]:undefined);
  if(!candidates.length)return ids?.length?{state,error:'No selected target is eligible.'}:{state};
  if(!ids)return {state,requiresSelection:`Choose ${action.selection.min===0?'up to ':''}${action.selection.max} target${action.selection.max===1?'':'s'}.`};
  const minimum=Math.min(action.selection.min,candidates.length);
  if(ids.length<minimum||(!all&&ids.length>(action.selection.max as number)))return {state,error:'The number of targets does not match the printed effect.'};
  if(ids.some(id=>!candidates.some(card=>card.id===id)))return {state,error:'A selected card is outside the printed effect target.'};
  let next=state;
  for(const id of ids){const result=applyEffectAction(next,actor,single,{targetId:id,sourceCardId:selection.sourceCardId});if(result.error||result.requiresSelection)return {state,error:result.error??result.requiresSelection};next=result.state;}
  return {state:next};
 }
 const opponent=other(actor);const target=selected(state,selection);const targets=selectedCards(state,selection);
 const targetResult=(message:string)=>requireTarget(state,selection,message);
 const targetCards=()=>targets.length?targets:(target?[target]:[]);
 switch(action.kind){
  case 'draw':{const cards=cardsFor(state,actor,'deck').slice(0,action.amount);return {state:{...state,cards:state.cards.map(card=>cards.some(item=>item.id===card.id)?{...card,zone:'hand'}:card)}};}
  case 'rest':{if(action.scope==='self'||action.scope==='own-leader'){const found=targetResult('Select your Leader or this card to rest.');if('result'in found)return found.result;if(!legalOwner(found.card,actor)||(action.scope==='own-leader'?found.card.zone!=='leader':!['character','stage'].includes(found.card.zone))||found.card.rested)return {state,error:'Selected card cannot pay this rest cost.'};return {state:update(state,found.card.id,{rested:true})};}const found=targetResult('Select an opponent card.');if('result'in found)return found.result;if(!legalOwner(found.card,opponent))return {state,error:'Selected card is not an opponent card.'};const legalZone=action.scope==='opponent-leader'?found.card.zone==='leader':action.scope==='opponent-character'?found.card.zone==='character':action.scope==='opponent-don'?found.card.zone==='cost-area'&&found.card.type==='DON!!'&&!found.card.attachedTo:['leader','character'].includes(found.card.zone);if(!legalZone)return {state,error:'Selected card is outside the printed rest target.'};if(action.maxCost!==undefined&&Math.max(0,(found.card.cost??Infinity)+(found.card.costModifier??0))>action.maxCost)return {state,error:'Selected card exceeds the printed cost limit.'};if(action.minAttachedDon!==undefined&&state.cards.filter(card=>card.owner===found.card.owner&&card.type==='DON!!'&&card.attachedTo===found.card.id).length<action.minAttachedDon)return {state,error:'Selected Character does not have enough DON!! attached.'};return {state:update(state,found.card.id,{rested:true})};}
  case 'ready':{
   const cards=targetCards();if(!selection.cardIds&&!selection.targetId)return {state,requiresSelection:'Select cards to set active.'};
   if(cards.length!==(selection.cardIds?.length??1)||cards.length>(action.amount??1))return {state,error:'Invalid number of cards selected.'};
   if(cards.some(card=>!legalOwner(card,actor)||(action.scope==='own-character'?card.zone!=='character':action.scope==='own-don'?card.zone!=='cost-area'||card.type!=='DON!!'||Boolean(card.attachedTo)||!card.rested:!['leader','character','stage'].includes(card.zone))||(action.restedOnly&&!card.rested)||((action.trait||action.traits?.length)&&!card.traits?.some(trait=>(action.trait?[action.trait]:action.traits!).some(expected=>trait.toLowerCase()===expected.toLowerCase())))||(action.attribute&&!card.attributes?.some(attribute=>attribute.toLowerCase()===action.attribute!.toLowerCase()))||(action.name&&card.name?.toLowerCase()!==action.name.toLowerCase())||(action.color&&!card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))||(action.minCost!==undefined&&(card.cost??-Infinity)<action.minCost)||(action.maxCost!==undefined&&(card.cost??Infinity)>action.maxCost)))return {state,error:'Selected card is outside the printed ready target.'};
   return {state:cards.reduce((next,card)=>card.cannotReady?next:update(next,card.id,{rested:false}),state)};
  }
  case 'ko':{const found=targetResult('Select an opponent Character.');if('result'in found)return found.result;const card=found.card;if(!legalOwner(card,opponent)||card.zone!=='character')return {state,error:'Selected card is not an opponent Character.'};if(protectedFromEffect(state,card,selection.sourceCardId))return {state,error:'This Character cannot be K.O.’d by effects.'};let maxCost=action.maxCost;if(action.maxCostFromLife)maxCost=cardsFor(state,action.maxCostFromLife==='own'?actor:opponent,'life').length;if(action.conditionalMaxCost){const condition=evaluateEffectCondition(action.conditionalMaxCost.condition,state,actor);if(condition===undefined)return {state,error:'Unsupported conditional K.O. cost limit.'};if(condition)maxCost=action.conditionalMaxCost.amount;}if(maxCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))>maxCost)return {state,error:'Selected Character exceeds the printed cost limit.'};if(action.maxPower!==undefined&&((card.power??Infinity)+(card.powerModifier??0))>action.maxPower)return {state,error:'Selected Character exceeds the printed power limit.'};if(action.maxBasePower!==undefined&&(card.power??Infinity)>action.maxBasePower)return {state,error:'Selected Character exceeds the printed base-power limit.'};if(action.restedOnly&&!card.rested)return {state,error:'Selected Character must be rested.'};
   const replacementSource=cardsFor(state,opponent,'character').find(source=>!source.effectNegated&&source.effectSchema?.ast.some(ability=>ability.trigger==='continuous'&&ability.actions.some(candidate=>candidate.kind==='replacement'&&candidate.event==='ko-by-effect'&&candidate.cost.kind==='bottom-deck-trash'&&(!candidate.eligibility?.color||card.color?.toLowerCase().includes(candidate.eligibility.color.toLowerCase()))&&(!candidate.eligibility?.cardType||card.type===candidate.eligibility.cardType)&&(candidate.eligibility?.maxBaseCost===undefined||(card.cost??Infinity)<=candidate.eligibility.maxBaseCost)&&(!candidate.oncePerTurn||!state.turnEffects.some(effect=>effect.kind==='replacement-used'&&effect.target===source.id)))));
   const replacement=replacementSource?.effectSchema?.ast.flatMap(ability=>ability.actions).find((candidate):candidate is Extract<EffectAction,{kind:'replacement'}>=>candidate.kind==='replacement'&&candidate.event==='ko-by-effect'&&candidate.cost.kind==='bottom-deck-trash');
   if(replacementSource&&replacement){const count=replacement.cost.kind==='bottom-deck-trash'?(replacement.cost.amount??0):0;const trash=cardsFor(state,opponent,'trash');if(selection.choice==='accept'){
     if(!count||!selection.cardIds)return {state,requiresSelection:`Choose exactly ${count} cards from your Trash to place at the bottom of your deck.`};
     if(selection.cardIds.length!==count||new Set(selection.cardIds).size!==count||selection.cardIds.some(id=>!trash.some(item=>item.id===id)))return {state,error:`Choose exactly ${count} different cards from your Trash.`};
     const decked=moveToDeck(state,selection.cardIds,'bottom');const marked=replacement.oncePerTurn?effect(decked,'replacement-used',replacementSource.id,undefined,'ko-by-effect','turn-end'):decked;return {state:marked};
    }
    if(selection.choice!=='decline'&&trash.length>=count&&count>0)return {state,requiresSelection:`${replacementSource.name??'A Character'}: you may place ${count} cards from your Trash at the bottom of your deck instead of this K.O.`,};
   }
   return {state:move(state,card.id,'trash')};}
  case 'return-to-hand':case 'return-to-deck':case 'bottom-deck':{const found=targetResult('Select a legal card.');if('result'in found)return found.result;const card=found.card;const anyOwner=action.scope==='any-character'||action.scope==='any-card';const expected=action.scope==='own-character'||action.scope==='trash'?actor:opponent;const zoneForScope=action.scope==='trash'?'trash':action.scope==='opponent-hand'?'hand':action.scope==='any-card'?['leader','character','stage'].includes(card.zone)?card.zone:'': 'character';if((!anyOwner&&!legalOwner(card,expected))||card.zone!==zoneForScope||(action.kind==='return-to-hand'&&action.activeOnly&&card.rested))return {state,error:'Selected card is outside the printed effect target.'};if('maxCost'in action&&action.maxCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))>action.maxCost)return {state,error:'Selected card exceeds the printed cost limit.'};if(action.kind==='return-to-hand'&&action.maxPower!==undefined&&((card.power??Infinity)+(card.powerModifier??0))>action.maxPower)return {state,error:'Selected card exceeds the printed power limit.'};if(action.kind==='return-to-hand'&&action.maxBasePower!==undefined&&(card.power??Infinity)>action.maxBasePower)return {state,error:'Selected card exceeds the printed base-power limit.'};return {state:action.kind==='return-to-hand'?move(state,card.id,'hand'):moveToDeck(state,[card.id],action.kind==='return-to-deck'?action.position:'bottom')};}
  case 'trash':{const zone=action.scope==='hand'?'hand':action.scope==='deck'?'deck':action.scope==='opponent-hand'?'hand':undefined;const owner=action.scope==='opponent-hand'?opponent:actor;if(action.scope==='self'){const found=targetResult('Select this card.');if('result'in found)return found.result;if(!legalOwner(found.card,actor))return {state,error:'Selected card is not yours.'};return {state:move(state,found.card.id,'trash')};}const candidates=cardsFor(state,owner,zone).filter(card=>(!action.requiresTrigger||hasTrigger(card))&&(!action.color||card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))&&(!action.trait||card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))&&(!action.cardType||card.type===action.cardType)&&(action.maxCost===undefined||(card.cost??Infinity)<=action.maxCost));const required=Math.min(action.amount,candidates.length);if(action.scope==='deck')return {state:candidates.slice(0,required).reduce((next,card)=>move(next,card.id,'trash'),state)};if(required===0)return {state};const ids=selection.cardIds;if(!ids)return {state,requiresSelection:`Select ${required} card${required===1?'':'s'}.`};if(ids.length!==required)return {state,error:`Select exactly ${required} card${required===1?'':'s'}.`};if(ids.some(id=>!candidates.some(card=>card.id===id)))return {state,error:'A selected card is outside the legal zone.'};return {state:{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,zone:'trash'}:card)}};}
  case 'prevent-keyword-activation':{const candidates=cardsFor(state,opponent,'character').filter(card=>hasCardKeyword(card,action.keyword,state)&&effectiveCardPower(state,card.id)<=action.maxPower);if(!candidates.length)return {state};return {state:candidates.reduce((next,card)=>effect(next,'prevent-keyword-activation',card.id,action.maxPower,action.keyword,action.until),state)};}
  case 'power':case 'cost':case 'set-power':case 'set-cost':case 'base-power':case 'copy-base-power':case 'swap-power':case 'negate-effect':{const found=targetResult('Select the card affected by this effect.');if('result'in found)return found.result;const card=found.card;const expected=('target' in action&&String(action.target).startsWith('opponent'))?opponent:actor;if(!legalOwner(card,expected)||!['leader','character'].includes(card.zone)||('target'in action&&action.target.endsWith('character')&&card.zone!=='character')||('target'in action&&action.target.endsWith('leader')&&card.zone!=='leader'))return {state,error:'Selected card is outside the printed effect target.'};if(action.kind==='power'){if(action.trait&&!card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))return {state,error:'Selected card does not have the printed trait.'};if(action.name&&card.name?.toLowerCase()!==action.name.toLowerCase())return {state,error:'Selected card does not match the printed name.'};const bonus=action.bonus?evaluateEffectCondition(action.bonus.condition,state,actor):false;if(bonus===undefined)return {state,error:'Unsupported conditional power bonus.'};const amount=action.amount+(bonus?action.bonus!.amount:0);return {state:effect(update(state,card.id,{powerModifier:(card.powerModifier??0)+amount}),'power',card.id,amount,undefined,action.until)};}if(action.kind==='cost')return {state:effect(update(state,card.id,{costModifier:(card.costModifier??0)+action.amount}),'cost',card.id,action.amount,undefined,'turn-end')};if(action.kind==='set-power'||action.kind==='base-power')return {state:effect(update(state,card.id,{power:action.amount,powerModifier:0}),action.kind,card.id,action.amount)};if(action.kind==='set-cost')return {state:effect(update(state,card.id,{cost:action.amount,costModifier:0}),'set-cost',card.id,action.amount)};if(action.kind==='negate-effect')return {state:effect(update(state,card.id,{effectNegated:true}),'negate-effect',card.id,action.amount)};if(action.kind==='copy-base-power'){const source=selection.cardIds?.map(id=>state.cards.find(item=>item.id===id)).find((item):item is MatchCard=>Boolean(item));if(!source||!legalOwner(source,opponent)||source.zone!=='character')return {state,requiresSelection:'Select an opponent Character whose base power will be copied.'};return {state:effect(update(state,card.id,{power:source.power,powerModifier:0}),'copy-base-power',card.id,source.power)};}const otherCard=selection.cardIds?.map(id=>state.cards.find(item=>item.id===id)).find((item):item is MatchCard=>Boolean(item));if(!otherCard||!['leader','character'].includes(otherCard.zone)||otherCard.id===card.id)return {state,requiresSelection:'Select the other Leader or Character whose power will be swapped.'};return {state:effect({...state,cards:state.cards.map(item=>item.id===card.id?{...item,power:otherCard.power,powerModifier:0}:item.id===otherCard.id?{...item,power:card.power,powerModifier:0}:item)},'swap-power',card.id,otherCard.power)};}
  case 'grant-keyword':{const found=targetResult('Select a legal card that gains this keyword.');if('result'in found)return found.result;const card=found.card;const expectedZone=action.scope==='own-leader'?'leader':'character';if(!legalOwner(card,actor)||!(action.scope==='own-card'?['leader','character'].includes(card.zone):action.scope==='self'?['leader','character'].includes(card.zone)&&(!selection.sourceCardId||card.id===selection.sourceCardId):card.zone===expectedZone))return {state,error:'Selected card is outside the printed keyword target.'};if(action.trait&&!card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))return {state,error:'Selected card does not have the printed trait.'};if(action.name&&card.name?.toLowerCase()!==action.name.toLowerCase())return {state,error:'Selected card does not match the printed name.'};if(action.color&&!card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))return {state,error:'Selected card does not have the printed color.'};if(action.maxCost!==undefined&&(card.cost??Infinity)>action.maxCost)return {state,error:'Selected card exceeds the printed cost limit.'};if(action.withoutOnPlay&&/\[On Play\]/i.test(card.effectText??card.effectSchema?.rawEffectText??''))return {state,error:'Selected Character has an On Play effect.'};const temporaryKeywords=[...new Set([...(card.temporaryKeywords??[]),action.keyword])];return {state:effect(update(state,card.id,{temporaryKeywords}),'grant-keyword',card.id,undefined,action.keyword,action.until)};}
  case 'prevent-ko':{const found=targetResult('Select the Character protected from K.O.');if('result'in found)return found.result;const card=found.card;if(!legalOwner(card,actor)||card.zone!=='character')return {state,error:'Select one of your Characters.'};return {state:effect(update(state,card.id,{preventKo:action.by}),'prevent-ko',card.id)};}
  case 'attack-permission':{const found=targetResult('Select your Character receiving attack permission.');if('result'in found)return found.result;if(!legalOwner(found.card,actor)||found.card.zone!=='character')return {state,error:'Select one of your Characters.'};return {state:effect(state,'attack-permission',found.card.id,action.activeTargets?1:0,undefined,action.until)};}
  case 'skip-next-refresh':{const found=targetResult('Select this Character.');if('result'in found)return found.result;if(!legalOwner(found.card,actor)||found.card.zone!=='character')return {state,error:'Select this Character in your Character area.'};return {state:effect(state,'skip-next-refresh',found.card.id)};}
  case 'attack-restriction':case 'prevent-rest':case 'prevent-ready':{
   const found=targetResult('Select the card affected by this restriction.');if('result'in found)return found.result;
   const card=found.card;if(!legalOwner(card,opponent)||!['leader','character','cost-area'].includes(card.zone))return {state,error:'Select an opponent card affected by this restriction.'};
   if(action.kind==='prevent-ready'){
    const attachedDonCount=state.cards.filter(don=>don.owner===card.owner&&don.type==='DON!!'&&don.attachedTo===card.id).length;const legalTarget=action.scope==='opponent-character'
     ?card.zone==='character'&&(!action.restedOnly||card.rested)&&(action.maxCost===undefined||Math.max(0,(card.cost??Infinity)+(card.costModifier??0))<=action.maxCost)&&(action.minAttachedDon===undefined||attachedDonCount>=action.minAttachedDon)
     :action.scope==='opponent-don'?card.zone==='cost-area'&&card.type==='DON!!'&&(!action.restedOnly||card.rested)&&(action.maxCost===undefined||Math.max(0,(card.cost??Infinity)+(card.costModifier??0))<=action.maxCost):(['leader','character','stage'].includes(card.zone)||card.zone==='cost-area'&&card.type==='DON!!')&&(!action.restedOnly||card.rested)&&(action.maxCost===undefined||Math.max(0,(card.cost??Infinity)+(card.costModifier??0))<=action.maxCost);
    if(!legalTarget)return {state,error:'Selected card is outside the printed no-ready target.'};
   }
   const patch=action.kind==='attack-restriction'?{cannotAttack:true}:action.kind==='prevent-ready'?{cannotReady:true}:{rested:true};
   return {state:effect(update(state,card.id,patch),action.kind,card.id)};
  }
  case 'don-power':return {state:effect(state,'don-power',undefined,action.amount)};
  case 'reorder-deck':{
   const top=cardsFor(state,actor,'deck').slice(0,action.amount);
   if(!selection.cardIds)return {state,requiresSelection:'Choose the order of the inspected cards.'};
   const ids=selection.cardIds;
   if(ids.length!==top.length||new Set(ids).size!==ids.length||ids.some(id=>!top.some(card=>card.id===id)))return {state,error:'Order each inspected card exactly once.'};
   const position=action.position==='choice'?selection.position:action.position;
   if(!position)return {state,requiresSelection:'Choose whether to place the ordered cards on top or bottom of your deck.'};
   const ordered=ids.map(id=>top.find(card=>card.id===id)!);
   const rest=state.cards.filter(card=>!ids.includes(card.id));
   return {state:{...state,cards:position==='top'?[...ordered,...rest]:[...rest,...ordered]}};
  }
  case 'search':{
   const revealed=cardsFor(state,actor,'deck').slice(0,action.amount);
   if(!selection.cardIds)return {state,requiresSelection:'Choose eligible cards, or explicitly choose none.'};
   if(new Set(selection.cardIds).size!==selection.cardIds.length)return {state,error:'Duplicate selection.'};
   const cards=targetCards();
   if(cards.length!==selection.cardIds.length||cards.length>action.choose)return {state,error:'Invalid number of cards selected.'};
   if(cards.some(card=>!revealed.some(item=>item.id===card.id))||!matchesSearchSelection(cards,action))return {state,error:'Selected card does not satisfy the printed search restriction.'};
   const remainder=revealed.filter(card=>!cards.some(item=>item.id===card.id));
   const untouched=state.cards.filter(card=>!revealed.some(item=>item.id===card.id));
   return {state:{...state,cards:[...untouched,...cards.map(card=>({...card,zone:'hand' as const})),...remainder.map(card=>({...card,zone:action.destination==='trash'?'trash' as const:'deck' as const}))]}};
  }
  case 'play':{
   if(selection.cardIds?.length===0)return {state};
   const cards=targetCards();if(!cards.length)return {state,requiresSelection:'Select a card to play.'};
   if(cards.length!==(selection.cardIds?.length??1))return {state,error:'A selected play card does not exist.'};
   if(cards.length>(action.amount??1))return {state,error:'Too many cards selected.'};
   const donField=cardsFor(state,actor).filter(card=>card.type==='DON!!'&&(card.zone==='cost-area'||Boolean(card.attachedTo))).length;
   const matchesAlternative=(card:MatchCard)=>!action.alternatives?.length||action.alternatives.some(alternative=>(!alternative.cardType||card.type===alternative.cardType)&&(!alternative.name||card.name?.toLowerCase()===alternative.name.toLowerCase())&&(!alternative.trait||card.traits?.some(trait=>trait.toLowerCase()===alternative.trait!.toLowerCase()))&&(!alternative.color||card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===alternative.color!.toLowerCase()))&&(!alternative.attribute||card.attributes?.some(attribute=>attribute.toLowerCase()===alternative.attribute!.toLowerCase())));
   const legal=cards.every(card=>['Character','Stage'].includes(card.type??'')&&legalOwner(card,actor)&&card.zone===action.source&&(!action.topOnly||card.id===cardsFor(state,actor,'deck')[0]?.id)&&(action.maxCost===undefined||(card.cost??Infinity)<=action.maxCost)&&(action.minCost===undefined||(card.cost??-Infinity)>=action.minCost)&&(action.exactCost===undefined||card.cost===action.exactCost)&&(action.maxPower===undefined||(card.power??Infinity)<=action.maxPower)&&(action.minPower===undefined||(card.power??-Infinity)>=action.minPower)&&(action.exactPower===undefined||card.power===action.exactPower)&&(!action.costAtMostDonField||(card.cost??Infinity)<=donField)&&(!action.cardType||card.type===action.cardType)&&(!action.trait||card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))&&(!action.color||card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))&&(!action.attribute||card.attributes?.some(attribute=>attribute.toLowerCase()===action.attribute!.toLowerCase()))&&(!action.name||card.name?.toLowerCase()===action.name.toLowerCase())&&(!action.noBaseEffect||typeof card.effectText==='string'&&!card.effectText.trim())&&matchesAlternative(card)&&(!action.excludeName||card.name?.toLowerCase()!==action.excludeName.toLowerCase()));
   if(!legal)return {state,error:'Selected card does not satisfy the printed play restriction.'};
   const characters=cards.filter(card=>card.type==='Character');const capacity=replaceCharactersForPlay(state,actor,characters.length,selection.replacementIds);if(capacity.error||capacity.requiresSelection)return capacity;
   if(cards.filter(card=>card.type==='Stage').length>1)return {state,error:'Only one Stage can be played at a time.'};let next=capacity.state;
   if(cards.some(card=>card.type==='Stage'))for(const stage of cardsFor(state,actor,'stage'))next=move(next,stage.id,'trash');
   for(const card of cards)next=move(next,card.id,card.type==='Stage'?'stage':'character',{rested:Boolean(action.rested),faceUp:undefined});
   if(action.source==='trash')for(const played of characters){const listeners=next.cards.filter(source=>source.owner===actor&&['character','leader','stage'].includes(source.zone)&&!source.effectNegated&&source.effectSchema?.ast.some(ability=>ability.trigger==='character-played-from-trash'));for(const source of listeners){const grants=source.effectSchema?.ast.filter(ability=>ability.trigger==='character-played-from-trash').flatMap(ability=>ability.actions).filter((candidate):candidate is Extract<EffectAction,{kind:'grant-keyword'}>=>candidate.kind==='grant-keyword'&&candidate.scope==='previous-played'&&(!candidate.trait||Boolean(played.traits?.some(trait=>trait.toLowerCase()===candidate.trait!.toLowerCase())))&&(!candidate.name||played.name?.toLowerCase()===candidate.name.toLowerCase())&&(candidate.maxCost===undefined||(played.cost??Infinity)<=candidate.maxCost))??[];for(const grant of grants){const granted=applyEffectAction(next,actor,grant,{targetId:played.id,sourceCardId:source.id});if(!granted.error&&!granted.requiresSelection)next=granted.state;}}}
   return {state:{...next,playedThisTurn:[...new Set([...(next.playedThisTurn??[]),...characters.map(card=>card.id)])]}};
  }
  case 'life':{
   if(action.operation==='add-to-life')return {state,error:'Adding Life requires an explicit source and placement instruction.'};
   if(action.operation==='opponent-top-to-owner-hand'){const top=cardsFor(state,opponent,'life').slice(0,action.amount);if(!selection.cardIds&&!selection.targetId)return {state,requiresSelection:`Choose up to ${action.amount} card${action.amount===1?'':'s'} from the top of your opponent's Life.`};const ids=selection.cardIds??(selection.targetId?[selection.targetId]:[]);if(ids.length>action.amount||ids.some((id,index)=>top[index]?.id!==id))return {state,error:'Choose only the top opponent Life cards, in order.'};return {state:ids.reduce((next,id)=>move(next,id,'hand',{faceUp:undefined}),state)};}
   const life=cardsFor(state,actor,'life').slice(0,action.amount);
   return {state:life.reduce((next,card)=>move(next,card.id,action.operation==='trash'?'trash':'hand',{faceUp:undefined}),state)};
  }
  case 'trash-life':{
   const owners=action.scope==='both'?[actor,opponent]:[action.scope==='own'?actor:opponent];
   const ids=owners.flatMap(owner=>cardsFor(state,owner,'life').slice(0,action.amount).map(card=>card.id));
   return {state:ids.reduce((next,id)=>move(next,id,'trash',{faceUp:undefined}),state)};
  }
  case 'move-to-life':{
   const owner=action.scope==='own'?actor:opponent;
   if(!selection.cardIds&&!selection.targetId)return {state,requiresSelection:`Choose up to ${action.amount} cards to place in Life.`};
   const ids=selection.cardIds??[selection.targetId!],cards=ids.map(id=>state.cards.find(card=>card.id===id));
   if(cards.length>action.amount)return {state,error:'Too many cards selected.'};
   if(action.source==='deck-top'){
    const top=cardsFor(state,actor,'deck').slice(0,action.amount);
    if(cards.some((card,index)=>!card||top[index]?.id!==card.id))return {state,error:'Select only the top cards of your deck, in order.'};
   }else if(cards.some(card=>!card||!legalOwner(card,owner)||!(action.source?[action.source]:['hand','character','trash']).includes(card.zone)))return {state,error:'Selected card cannot be placed in Life.'};
   if(!ids.length)return {state};
   const position=action.position==='choice'?selection.position:action.position;
   if(!position)return {state,requiresSelection:'Choose the top or bottom of Life.'};
   let next=state;
   for(const id of ids)next=move(next,id,'life',{faceUp:Boolean(action.faceUp)});
   const moved=ids.map(id=>next.cards.find(card=>card.id===id)!);
   const remaining=next.cards.filter(card=>!ids.includes(card.id));
   return {state:{...next,cards:position==='top'?[...moved,...remaining]:[...remaining,...moved]}};
  }
  case 'recover':{if(!selection.cardIds&&!selection.targetId)return {state,requiresSelection:`Choose up to ${action.amount} cards from Trash.`};const cards=targetCards();if(cards.length!==(selection.cardIds?.length??1))return {state,error:'A selected recovery card does not exist.'};if(cards.length>action.amount)return {state,error:'Too many cards selected.'};if(cards.some(card=>!legalOwner(card,actor)||card.zone!=='trash'||(action.maxCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))>action.maxCost)||(action.minCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))<action.minCost)||(action.exactCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))!==action.exactCost)||(action.cardType&&card.type!==action.cardType)||(action.name&&card.name?.toLowerCase()!==action.name.toLowerCase())||(action.trait&&!card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))||(action.color&&!card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))||(action.excludeName&&card.name?.toLowerCase()===action.excludeName.toLowerCase())))return {state,error:'Selected card does not satisfy the printed recovery restriction.'};return {state:{...state,cards:state.cards.map(card=>cards.some(item=>item.id===card.id)?{...card,zone:'hand'}:card)}};}
  case 'return-trash-to-deck-bottom':{const cards=targetCards();if(cards.length!==action.amount)return {state,requiresSelection:`Select ${action.amount} card${action.amount===1?'':'s'} from Trash.`};if(cards.some(card=>!legalOwner(card,actor)||card.zone!=='trash'))return {state,error:'Selected card is not in your Trash.'};return {state:moveToDeck(state,cards.map(card=>card.id),'bottom')};}
  case 'bottom-deck-hand':{return {state:moveToDeck(state,cardsFor(state,actor,'hand').map(card=>card.id),'bottom')};}
  case 'hand-reset':{
   const owner=action.scope==='self'?actor:opponent,hand=cardsFor(state,owner,'hand');
   let next=moveToDeck(state,hand.map(card=>card.id),'bottom');
   if(action.shuffle)next=shuffleDeck(next,owner);
   const draw=cardsFor(next,owner,'deck').slice(0,action.draw??hand.length);
   return {state:draw.reduce((current,card)=>move(current,card.id,'hand'),next)};
  }
  case 'shuffle':return {state:shuffleDeck(state,action.scope==='self'?actor:opponent)};
  case 'reorder-life':{
   const owner=action.scope==='own'?actor:selection.owner;
   if(!owner)return {state,requiresSelection:'Choose which player’s Life to inspect.'};
   if(action.addSelfToHand)return {state,error:'This Life reorder also requires a source-card movement that is not implemented.'};
   const inspected=cardsFor(state,owner,'life').slice(0,action.amount);
   if(!inspected.length)return {state};
   const ids=selection.cardIds;
   if(!ids)return {state,requiresSelection:'Choose the order of the inspected Life cards.'};
   if(ids.length!==inspected.length||ids.some(id=>!inspected.some(card=>card.id===id)))return {state,error:'Order every inspected Life card exactly once.'};
   const ordered=ids.map(id=>inspected.find(card=>card.id===id)!);
   return {state:{...state,cards:[...ordered,...state.cards.filter(card=>!ids.includes(card.id))]}};
  }
  case 'reveal':return {state:effect(state,action.kind,target?.id,action.amount)};
  case 'add-don':{const available=cardsFor(state,actor,'don-deck').filter(card=>card.type==='DON!!');if(!available.length)return {state};const requested=action.selection?selection.cardIds:undefined;if(action.selection&&!requested)return {state,requiresSelection:`Choose up to ${Math.min(action.amount,available.length)} DON!! to add.`};const ids=requested??available.slice(0,action.amount).map(card=>card.id);if(ids.length>action.amount||new Set(ids).size!==ids.length||ids.some(id=>!available.some(card=>card.id===id)))return {state,error:'Choose only available DON!! cards up to the printed amount.'};return {state:{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,zone:'cost-area',rested:Boolean(action.rested)}:card)}};}
  case 'return-don':{const cards=targetCards(),owner=action.owner==='opponent'?opponent:actor;if(cards.length!==action.amount)return {state,requiresSelection:`Select ${action.amount} DON!! card${action.amount===1?'':'s'} to return.`};if(cards.some(card=>!legalOwner(card,owner)||card.type!=='DON!!'||card.zone!=='cost-area'))return {state,error:`A selected card is not the ${action.owner==='opponent'?'opponent’s':'your'} DON!!.`};return {state:{...state,cards:state.cards.map(card=>cards.some(item=>item.id===card.id)?{...card,zone:'don-deck',rested:false,attachedTo:undefined}:card)}};}
  case 'attach-don':{const found=targetResult('Select your Leader or Character.');if('result'in found)return found.result;const recipient=found.card;if(!legalOwner(recipient,actor)||!['leader','character'].includes(recipient.zone))return {state,error:'Select your Leader or Character to receive DON!!.'};const dons=selectedCards(state,selection);if(!selection.cardIds)return {state,requiresSelection:`Select up to ${action.amount} DON!! card${action.amount===1?'':'s'} to attach.`};if(dons.length>action.amount)return {state,error:'Too many DON!! cards selected.'};const legalDons=dons.every(card=>legalOwner(card,actor)&&card.type==='DON!!'&&(action.source==='attached'?Boolean(card.attachedTo):card.zone==='cost-area'&&!card.attachedTo&&(action.rested?Boolean(card.rested):!card.rested)));if(!legalDons)return {state,error:'Selected DON!! do not match the printed source or rested state.'};return {state:{...state,cards:state.cards.map(card=>dons.some(don=>don.id===card.id)?{...card,zone:'cost-area',attachedTo:recipient.id}:card)}};}
  case 'attach-don-required':return {state:effect(state,action.kind,target?.id,action.amount)};
  case 'return-trash-to-deck-bottom':case 'recover':case 'hand-reset':case 'shuffle':case 'bottom-deck-hand':case 'reveal-hand':case 'hand-limit':case 'play-or-life':case 'activate-referenced-effect':case 'activate-main-effect':case 'blocker':case 'counter':case 'rush':case 'double-attack':case 'banish':case 'on-ko':case 'on-block':case 'attack-permission':case 'attack-restriction':case 'prevent-ready':case 'prevent-rest':case 'prevent-ko':case 'grant-keyword':case 'replacement':case 'custom-resolver':case 'draw-by':return {state:effect(state,action.kind,target?.id,'amount'in action&&typeof action.amount==='number'?action.amount:undefined)};
  default:return {state,error:'Unhandled effect action.'};
 }
}

export function payEffectCost(state:MatchEffectState,actor:PlayerId,cost:EffectCost,selection:EffectSelection={}):EffectStepResult{
 if(cost.kind==='bottom-deck-trash'){if(!selection.cardIds)return {state,requiresSelection:`Choose exactly ${cost.amount} cards from your Trash to return to the bottom of your deck in any order.`};const cards=selectedCards(state,selection);if(cards.length!==cost.amount||new Set(selection.cardIds).size!==cost.amount||cards.some(card=>card.owner!==actor||card.zone!=='trash'))return {state,error:`Choose exactly ${cost.amount} different cards from your Trash.`};return {state:moveToDeck(state,selection.cardIds,'bottom')};}
 if(cost.kind==='turn-life'&&cost.scope==='own'){const life=cardsFor(state,actor,'life').slice(0,cost.amount);if(life.length!==cost.amount)return {state,error:'There are not enough Life cards to pay this cost.'};return {state:{...state,cards:state.cards.map(card=>life.some(item=>item.id===card.id)?{...card,faceUp:cost.faceUp}:card)}};}
 if(cost.kind==='rest'&&cost.scope==='don'){const ids=selection.cardIds??[];if(new Set(ids).size!==ids.length)return {state,error:'Each payment card must be unique.'};const dons=cardsFor(state,actor,'cost-area').filter(card=>card.type==='DON!!'&&!card.rested&&!card.attachedTo);if(ids.length!==cost.amount)return {state,requiresSelection:`Select ${cost.amount} active DON!! card${cost.amount===1?'':'s'}.`};if(ids.some(id=>!dons.some(card=>card.id===id)))return {state,error:'A selected DON!! cannot pay this cost.'};return {state:{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,rested:true}:card)}};}
 if(cost.kind==='trash'&&cost.scope==='hand'){if(!selection.cardIds)return {state,requiresSelection:`Select ${cost.amount} card${cost.amount===1?'':'s'} to pay the cost.`};if(selection.cardIds.length!==cost.amount)return {state,error:`The cost requires exactly ${cost.amount} cards.`};const payment=selectedCards(state,selection);if(payment.length!==cost.amount||payment.some(card=>card.owner!==actor||card.zone!=='hand'||(cost.requiresTrigger&&!hasTrigger(card))||(cost.color&&!card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===cost.color!.toLowerCase()))||(cost.trait&&!card.traits?.some(trait=>trait.toLowerCase()===cost.trait!.toLowerCase()))||(cost.cardType&&card.type!==cost.cardType)||(cost.maxCost!==undefined&&(card.cost??Infinity)>cost.maxCost)))return {state,error:'Selected cards cannot pay this cost.'};return applyEffectAction(state,actor,{kind:'trash',scope:'hand',amount:cost.amount,requiresTrigger:cost.requiresTrigger,color:cost.color,trait:cost.trait,cardType:cost.cardType,maxCost:cost.maxCost},selection);}
 if(cost.kind==='trash'&&cost.scope==='self'){
  const card=selected(state,selection);
  if(!card||card.owner!==actor||!['character','stage'].includes(card.zone))return {state,error:'The source card must be in play to pay its trash cost.'};
  return {state:move(state,card.id,'trash')};
 }
 if(cost.kind==='return-don')return applyEffectAction(state,actor,{kind:'return-don',amount:cost.amount},selection);
 if(cost.kind==='rest'&&cost.scope==='own-card'){
  const ids=selection.cardIds??[];if(new Set(ids).size!==ids.length)return {state,error:'Each rest-cost card must be unique.'};
  if(ids.length!==cost.amount)return {state,requiresSelection:`Select ${cost.amount} active card${cost.amount===1?'':'s'} you control to rest.`};
  const payable=cardsFor(state,actor).filter(card=>['leader','character','stage'].includes(card.zone)&&!card.rested);
  if(ids.some(id=>!payable.some(card=>card.id===id)))return {state,error:'Select active Leader, Character, or Stage cards you control to pay this cost.'};
  return {state:{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,rested:true}:card)}};
 }
 if(cost.kind==='rest'&&cost.scope==='self'){if(!selection.targetId)return {state,requiresSelection:'Select this card.'};const card=state.cards.find(item=>item.id===selection.targetId);if(!card||!legalOwner(card,actor)||!['leader','character','stage'].includes(card.zone))return {state,error:'The source card must be in play.'};if(card.rested)return {state,error:'A rested card cannot pay a rest cost.'};return {state:update(state,selection.targetId,{rested:true})};}
 if(cost.kind==='rest'&&cost.scope==='leader'){const id=selection.targetId??selection.cardIds?.[0];if(!id)return {state,requiresSelection:'Select your active Leader to rest.'};const card=state.cards.find(item=>item.id===id);if(!card||!legalOwner(card,actor)||card.zone!=='leader'||card.rested||(selection.cardIds?.length??1)!==1)return {state,error:'Select your active Leader to pay this cost.'};return {state:update(state,card.id,{rested:true})};}
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
 requiresSelection?:string;
 replacementResolved?:boolean;
 error?:string;
};

/** A Blocker must be an active Character with the keyword; declaring it rests it and retargets the attack. */
export function declareBlock(state:MatchEffectState,defender:PlayerId,blockerId:string):BattleResolution{
 const blocker=state.cards.find(card=>card.id===blockerId);
 if(!blocker||blocker.owner!==defender||blocker.zone!=='character')return {state,winner:'none',error:'Selected card is not a defending Character.'};
 if(blocker.rested)return {state,winner:'none',error:'A rested Character cannot activate Blocker.'};
 const printedBlockerText=/^\[Blocker\](?:\s*\([^)]*\))?(?:\s|\[|$)/i.test((blocker.effectText??blocker.effectSchema?.rawEffectText??'').trimStart());
 const printedBlocker=!blocker.effectNegated&&(blocker.keywords?.includes('blocker')||printedBlockerText||blocker.effectSchema?.ast.some(ability=>/^\[Blocker\](?:\s*\([^)]*\))?(?:\s|\[|$)/i.test(ability.rawText.trimStart())&&ability.actions.some(action=>action.kind==='blocker')));
 if(!printedBlocker&&!blocker.temporaryKeywords?.includes('blocker'))return {state,winner:'none',error:'Selected Character does not have Blocker.'};
 if(state.turnEffects.some(effect=>effect.kind==='prevent-keyword-activation'&&effect.target===blockerId&&effect.detail==='blocker'&&effect.expires==='battle'))return {state,winner:'none',error:'This Blocker cannot activate during this battle.'};
 const blocked=state.turnEffects.some(effect=>effect.kind==='prevent-keyword-activation'&&effect.detail==='blocker'&&effect.expires==='battle'&&effect.target===blocker.id);
 if(blocked)return {state,winner:'none',error:'This Blocker cannot activate during this battle.'};
 return {state:update(state,blockerId,{rested:true}),winner:'none'};
}

export function effectiveCardPower(state:MatchEffectState,cardId:string):number{
 const card=state.cards.find(item=>item.id===cardId);
 if(!card||!['leader','character'].includes(card.zone))return 0;
 const donPower=state.turn===card.owner?state.cards.filter(don=>don.type==='DON!!'&&don.owner===card.owner&&don.zone==='cost-area'&&don.attachedTo===cardId).reduce((sum,don)=>{
  const amount=don.effectSchema?don.effectSchema.ast.flatMap(ability=>ability.actions).find(action=>action.kind==='don-power')?.amount??0:1000;
  return sum+amount;
 },0):0;
 return Math.max(0,(card.power??0)+(card.powerModifier??0)+donPower);
}

/** Resolves a battle after Block and Counter choices. Equal power defeats a Character or damages a Leader. */
export function resolveBattle(state:MatchEffectState,attackerId:string,defenderId:string,attackingPower=effectiveCardPower(state,attackerId),defendingPower=effectiveCardPower(state,defenderId),replacementChoice?:{choice:'accept'|'decline';cardId?:string}):BattleResolution{
 const attacker=state.cards.find(card=>card.id===attackerId),defender=state.cards.find(card=>card.id===defenderId);
 if(!attacker||!defender)return {state,winner:'none',error:'Attacker or defender is missing.'};
 if(defender.zone==='leader'){
  if(attackingPower<defendingPower)return {state,winner:'defender'};
  const doubleAttack=hasCardKeyword(attacker,'double-attack',state);
  const banish=hasCardKeyword(attacker,'banish',state);
  const lifeCards=cardsFor(state,defender.owner,'life').slice(0,doubleAttack?2:1);
  if(!lifeCards.length)return {state,winner:'attacker',leaderDamaged:defender.owner,gameOver:defender.owner};
  const next=lifeCards.reduce((current,life)=>move(current,life.id,banish?'trash':'hand'),state);
  return {state:next,winner:'attacker',leaderDamaged:defender.owner,lifeCardId:lifeCards[0].id,lifeCardIds:lifeCards.map(card=>card.id),triggerAvailable:!banish&&lifeCards.some(hasTrigger)};
 }
 if(defender.zone!=='character')return {state,winner:'none',error:'Defender is not on the field.'};
 if(attackingPower<defendingPower)return {state,winner:'defender'};
 const attachedDonCount=state.cards.filter(card=>card.type==='DON!!'&&card.owner===defender.owner&&card.attachedTo===defender.id).length;
 const schemaProtection=state.cards.some(protector=>(protector.zone==='character'||protector.zone==='leader')&&!protector.effectNegated&&Boolean(protector.effectSchema?.ast.some(ability=>protectionConditionsMet(state,protector,ability)&&ability.actions.some(action=>action.kind==='prevent-ko'&&action.by==='battle'
  &&(protector.id===defender.id||action.protects==='own-characters'&&protector.owner===defender.owner||action.protects==='characters')
  &&(action.protectedMaxCost===undefined||(defender.cost??Infinity)<=action.protectedMaxCost)
  &&(action.protectedExactCost===undefined||defender.cost===action.protectedExactCost)
  &&(!action.protectedTrait||defender.traits?.some(trait=>trait.toLowerCase()===action.protectedTrait!.toLowerCase()))
  &&(!action.protectedExcludeName||action.protectedExcludeOwnerOnly&&protector.owner!==defender.owner||defender.name?.toLowerCase()!==action.protectedExcludeName.toLowerCase())
  &&(!action.protectedMustBeActive||!defender.rested)
  &&(!action.attribute||(action.attribute==='*'?Boolean(attacker.attributes?.length):attacker.attributes?.some(attribute=>attribute.toLowerCase()===action.attribute!.toLowerCase())))
  &&(!action.byCardType||(action.byCardType==='Leader or Character'?['Leader','Character'].includes(attacker.type??''):attacker.type===action.byCardType))
  &&(!action.excludeAttribute||!attacker.attributes?.some(attribute=>attribute.toLowerCase()===action.excludeAttribute!.toLowerCase()))
  &&(action.requiresAttachedDon===undefined||attachedDonCount>=action.requiresAttachedDon)))));
 const protectedFromBattle=defender.keywords?.includes('prevent-ko-battle')||defender.preventKo==='battle'||defender.preventKo==='any'||Boolean(schemaProtection);
 if(protectedFromBattle)return {state,winner:'attacker'};
 const replacement=defender.effectNegated?undefined:defender.effectSchema?.ast.flatMap(ability=>ability.actions).find((action):action is Extract<EffectAction,{kind:'replacement'}>=>action.kind==='replacement'&&action.event==='ko'&&action.cost.kind==='rest-leader-or-stage');
 if(replacement?.cost.kind==='rest-leader-or-stage'){
  const paymentTargets=state.cards.filter(card=>card.owner===defender.owner&&!card.rested&&(card.zone==='leader'||card.zone==='stage'&&card.name===replacement.cost.stageName));
  if(paymentTargets.length){
   if(!replacementChoice)return {state,winner:'attacker',requiresSelection:`You may rest your Leader or ${replacement.cost.stageName} instead of this K.O.`};
   if(replacementChoice.choice==='accept'){
    const payment=state.cards.find(card=>card.id===replacementChoice.cardId);
    if(!payment||!paymentTargets.some(card=>card.id===payment.id))return {state,winner:'none',error:`Choose an active Leader or ${replacement.cost.stageName} to rest.`};
    return {state:update(state,payment.id,{rested:true}),winner:'attacker',replacementResolved:true};
   }
  }
 }
 return {state:move(state,defender.id,'trash'),winner:'attacker',defeatedCharacterId:defender.id};
}
