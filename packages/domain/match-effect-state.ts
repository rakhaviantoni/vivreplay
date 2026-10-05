import {evaluateEffectCondition} from './effect-conditions';
import {matchesCardName,matchesSearch,matchesSearchSelection} from './search-eligibility';
import {compileEffectDocument,type EffectAction,type EffectCost,type EffectTrigger,type EffectDocument} from './effect-rules';
import {resolveCardEffect,type EffectCommand} from './effect-runtime';
import type {Card} from '../card-data/catalog';

export type PlayerId='player'|'opponent';
export type CardZone='deck'|'hand'|'life'|'trash'|'character'|'leader'|'stage'|'cost-area'|'don-deck';
export type MatchCard={id:string;owner:PlayerId;zone:CardZone;type?:'Character'|'Leader'|'Stage'|'Event'|'DON!!';cost?:number;power?:number;counter?:number;name?:string;color?:string;traits?:string[];attributes?:string[];temporaryAttributes?:string[];rested?:boolean;attachedTo?:string;faceUp?:boolean;keywords?:string[];powerModifier?:number;costModifier?:number;temporaryKeywords?:string[];cannotAttack?:boolean;cannotReady?:boolean;effectNegated?:boolean;preventKo?:'battle'|'effect'|'any';effectText?:string;effectSchema?:EffectDocument;code?:string};
export type TurnPhase='refresh'|'draw'|'don'|'main'|'end';
export type MatchEffectState={cards:MatchCard[];turn:PlayerId;turnEffects:Array<{kind:string;target?:string;amount?:number;detail?:string;owner?:PlayerId;expires?:'battle'|'turn-end'|'opponent-next-turn'|'next-own-turn';cardType?:Card['type'];trait?:string;minimumCost?:number;nextOnly?:boolean}>;restrictions:string[];delayed:Array<{when:'next-main-phase'|'end-turn'|'replacement';instruction:string}>;revealedCardIds?:string[];phase?:TurnPhase;turnNumber?:number;firstPlayer?:PlayerId;playedThisTurn?:string[]};
export type EffectSelection={replacementIds?:string[];owner?:PlayerId;position?:'top'|'bottom';cardIds?:string[];deckOrder?:string[];targetId?:string;sourceCardId?:string;choice?:string};
export type EffectStepResult={state:MatchEffectState;requiresSelection?:string;error?:string};

const other=(player:PlayerId):PlayerId=>player==='player'?'opponent':'player';
const cardsFor=(state:MatchEffectState,player:PlayerId,zone?:CardZone)=>state.cards.filter(card=>card.owner===player&&(!zone||card.zone===zone));
const update=(state:MatchEffectState,id:string,patch:Partial<MatchCard>):MatchEffectState=>({...state,cards:state.cards.map(card=>card.id===id?{...card,...patch}:card)});
const move=(state:MatchEffectState,id:string,zone:CardZone,patch:Partial<MatchCard>={}):MatchEffectState=>{
 const previous=state.cards.find(card=>card.id===id);
 const leavingField=previous&&['leader','character','stage'].includes(previous.zone)&&!['leader','character','stage'].includes(zone);
 const reset=leavingField?{powerModifier:undefined,costModifier:undefined,temporaryKeywords:undefined,temporaryAttributes:undefined,cannotAttack:undefined,cannotReady:undefined,effectNegated:undefined,preventKo:undefined}:{};
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
const effect=(state:MatchEffectState,kind:string,target?:string,amount?:number,detail?:string,expires?:'battle'|'turn-end'|'opponent-next-turn'|'next-own-turn',owner?:PlayerId):MatchEffectState=>({...state,turnEffects:[...state.turnEffects,{kind,target,amount,detail,expires,owner}]});
const requireTarget=(state:MatchEffectState,selection:EffectSelection,message:string):{card:MatchCard}|{result:EffectStepResult}=>{const card=selected(state,selection);return card?{card}:{result:{state,requiresSelection:message}};};
const legalOwner=(card:MatchCard|undefined,owner:PlayerId)=>Boolean(card&&card.owner===owner);
function protectedFromEffect(state:MatchEffectState,target:MatchCard,sourceCardId?:string,event:'ko'|'rest'='ko'):boolean{
 if(event==='ko'&&(target.preventKo==='effect'||target.preventKo==='any'))return true;
 const source=sourceCardId?state.cards.find(card=>card.id===sourceCardId):undefined;
 const attachedDonCount=state.cards.filter(card=>card.owner===target.owner&&card.type==='DON!!'&&card.attachedTo===target.id).length;
 return state.cards.some(protector=>(protector.zone==='character'||protector.zone==='leader')&&!protector.effectNegated&&Boolean(protector.effectSchema?.ast.some(ability=>protectionConditionsMet(state,protector,ability)&&ability.actions.some(action=>action.kind==='prevent-ko'&&action.by==='effect'&&(event==='ko'||action.preventRest)
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



function resolveHandTrashListeners(initial:MatchEffectState,handOwner:PlayerId,amount:number,effectSourceId?:string):MatchEffectState{
 if(amount<=0)return initial;
 const effectSource=effectSourceId?initial.cards.find(card=>card.id===effectSourceId):undefined;let state=initial;
 const listeners=state.cards.filter(card=>card.owner===handOwner&&!card.effectNegated&&['leader','character','stage'].includes(card.zone));
 for(const listener of listeners){
  const abilities=listener.effectSchema?.ast.filter(ability=>ability.trigger==='hand-trash')??[];
  for(const ability of abilities)for(const action of ability.actions){
   if(action.kind==='draw-trashed-cards'){
    if(action.sourceTrait&&(!effectSource||effectSource.owner!==handOwner||!effectSource.traits?.some(trait=>trait.toLowerCase()===action.sourceTrait!.toLowerCase())))continue;
    const cards=cardsFor(state,handOwner,'deck').slice(0,amount);state={...state,cards:state.cards.map(card=>cards.some(item=>item.id===card.id)?{...card,zone:'hand'}:card)};
   }else if(action.kind==='negate-source-effect'){
    const result=applyEffectAction(state,handOwner,action,{sourceCardId:listener.id});if(!result.error)state=result.state;
   }
  }
 }
 return state;
}

/** Returns the executable commands for any printed timing window on a card in the match. */
export function commandsForTiming(state:MatchEffectState,cardId:string,timing:EffectTrigger):EffectCommand[]{
 const card=state.cards.find(item=>item.id===cardId);
 if(!card?.effectText||card.effectNegated)return [];
 const source={id:card.id,code:card.code??card.id,name:card.name??card.id,color:card.color??'',type:card.type??'Character',cost:card.cost??0,power:card.power??0,counter:card.counter??0,rarity:'',art:0,effect:card.effectText} as Card;
 return resolveCardEffect(card.effectSchema??compileEffectDocument(source),timing).commands;
}

export function expireEffectModifiers(state:MatchEffectState,window:'battle'|'turn-end'|'opponent-next-turn'|'next-own-turn',owner?:PlayerId):MatchEffectState{
 const expired=state.turnEffects.filter(effect=>effect.expires===window&&(window==='opponent-next-turn'?Boolean(owner&&(effect.owner?effect.owner===owner:state.cards.find(card=>card.id===effect.target)?.owner===owner)):window==='next-own-turn'?Boolean(owner&&effect.owner===owner):true)||(window==='turn-end'&&effect.expires==='battle'));
 const remaining=state.turnEffects.filter(effect=>!expired.includes(effect));
 const cards=state.cards.map(card=>{
  const effects=expired.filter(effect=>effect.target===card.id);
  const readyByDelayedEffect=expired.some(effect=>effect.kind==='ready-all-characters-at-end'&&card.owner===effect.owner&&card.zone==='character'&&(!effect.trait||card.traits?.some(trait=>trait.toLowerCase()===effect.trait?.toLowerCase())));
  if(!effects.length&&!readyByDelayedEffect)return card;
  const copiedBasePower=effects.find(effect=>effect.kind==='copy-base-power');
  const power=effects.filter(effect=>effect.kind==='power').reduce((sum,effect)=>sum+(effect.amount??0),0);
  const cost=effects.filter(effect=>effect.kind==='cost').reduce((sum,effect)=>sum+(effect.amount??0),0);
  const keywords=card.temporaryKeywords?.filter(keyword=>!effects.some(effect=>(effect.kind==='grant-keyword'||effect.kind==='grant-keyword-attribute')&&effect.detail===keyword)||remaining.some(effect=>effect.target===card.id&&(effect.kind==='grant-keyword'||effect.kind==='grant-keyword-attribute')&&effect.detail===keyword));
  const attributes=card.temporaryAttributes?.filter(attribute=>!effects.some(effect=>(effect.kind==='grant-attribute'||effect.kind==='grant-keyword-attribute')&&effect.detail===attribute)||remaining.some(effect=>effect.target===card.id&&(effect.kind==='grant-attribute'||effect.kind==='grant-keyword-attribute')&&effect.detail===attribute));
  const negated=effects.some(effect=>effect.kind==='negate-effect')&&!remaining.some(effect=>effect.kind==='negate-effect'&&effect.target===card.id);return {...card,...(copiedBasePower?.detail!==undefined?{power:Number(copiedBasePower.detail)}:{}),...(negated?{effectNegated:false}:{}),...(effects.some(effect=>effect.kind==='attack-restriction')?{cannotAttack:false}:{}),...(readyByDelayedEffect?{rested:false}:{}),powerModifier:((card.powerModifier??0)-power)||undefined,costModifier:((card.costModifier??0)-cost)||undefined,temporaryKeywords:keywords?.length?keywords:undefined,temporaryAttributes:attributes?.length?attributes:undefined};
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
export function effectiveCounterAmount(state:MatchEffectState,card:MatchCard):number{
 let amount=card.counter??0;
 if(card.zone!=='hand'||!['Character','Event'].includes(card.type??''))return amount;
 for(const source of state.cards){
  if(source.owner!==card.owner||source.effectNegated||!['leader','character','stage'].includes(source.zone))continue;
  for(const ability of source.effectSchema?.ast??[]){
   const applicable=ability.trigger==='continuous'||ability.trigger==='unknown';
   if(!applicable||!ability.conditions.every(condition=>evaluateEffectCondition(condition.text,state,source.owner,source.id)===true))continue;
   for(const action of ability.actions)if(action.kind==='hand-counter'&&card.type===action.cardType&&(!action.onlyWithoutCounter||!(card.counter??0)))amount+=action.amount;
  }
 }
 return amount;
}

/** Calculates the DON!! cost after active cost-reduction effects have been applied. */
export function effectivePlayCost(state:MatchEffectState,actor:PlayerId,card:MatchCard):number{
 const baseCost=Math.max(0,(card.cost??0)+(card.costModifier??0));
 const reductions:{amount:number;cardType?:Card['type'];trait?:string;minimumCost?:number;nextOnly?:boolean}[]=[];
 let continuousCostChange=0;
 for(const source of state.cards.filter(item=>['leader','character','stage'].includes(item.zone)&&!item.effectNegated)){
  for(const ability of source.effectSchema?.ast??[]){
   const requiredDon=ability.actions.reduce((maximum,action)=>action.kind==='attach-don-required'?Math.max(maximum,action.amount):maximum,0);
   const attachedDon=state.cards.filter(item=>item.owner===source.owner&&item.type==='DON!!'&&item.attachedTo===source.id).length;
   if(ability.trigger!=='continuous'||attachedDon<requiredDon||!ability.conditions.every(condition=>evaluateEffectCondition(condition.text,state,source.owner,source.id)===true))continue;
   for(const action of ability.actions){if(source.owner===actor&&action.kind==='cost-reduction')reductions.push(action);if(source.owner!==actor&&action.kind==='cost'&&action.continuous&&action.target==='opponent-character'&&card.owner===actor&&card.zone==='character'&&(action.maxCost===undefined||Math.max(0,(card.cost??Infinity)+(card.costModifier??0))<=action.maxCost))continuousCostChange+=action.amount;}
  }
 }
 for(const active of state.turnEffects){
  if(active.kind!=='cost-reduction'||!active.target||state.cards.find(item=>item.id===active.target)?.owner!==actor)continue;
  if(active.nextOnly&&state.playedThisTurn?.includes(active.target))continue;
  reductions.push({amount:active.amount??0,cardType:active.cardType,trait:active.trait,minimumCost:active.minimumCost,nextOnly:active.nextOnly});
 }
 const reduction=reductions.reduce((total,item)=>{
  if(item.cardType&&card.type!==item.cardType)return total;
  if(item.trait&&!card.traits?.some(trait=>trait.toLowerCase()===item.trait!.toLowerCase()))return total;
  if(item.minimumCost!==undefined&&(card.cost??0)<item.minimumCost)return total;
  return total+Math.max(0,item.amount);
 },0);
 return Math.max(0,baseCost+continuousCostChange-reduction);
}

/** Runs Refresh, Draw, and DON!! in the order mandated by the official turn flow. */
export function beginTurn(state:MatchEffectState,actor:PlayerId,turnNumber=(state.turnNumber??0)+1):TurnStartResult{
 state=expireEffectModifiers(state,'turn-end');
 state=expireEffectModifiers(state,'opponent-next-turn',actor);
 state=expireEffectModifiers(state,'next-own-turn',actor);
 const skippedReadyIds=new Set([...state.turnEffects.filter(effect=>effect.kind==='skip-next-refresh'&&state.cards.some(card=>card.id===effect.target&&card.owner===actor)).map(effect=>effect.target),...state.cards.filter(card=>card.owner===actor&&card.cannotReady).map(card=>card.id)]);
 const firstTurn=turnNumber===1&&state.firstPlayer===actor;
 const returned=state.cards.map(card=>card.owner===actor&&card.type==='DON!!'&&card.attachedTo?{...card,zone:'cost-area' as CardZone,attachedTo:undefined,rested:true}:card);
 const refreshed=returned.map(card=>card.owner===actor&&['leader','character','stage','cost-area'].includes(card.zone)?{...card,rested:skippedReadyIds.has(card.id)?true:false,powerModifier:undefined,costModifier:undefined,temporaryKeywords:undefined,cannotAttack:undefined,cannotReady:undefined,effectNegated:undefined,preventKo:undefined}:card);
 const deck=refreshed.filter(card=>card.owner===actor&&card.zone==='deck');
 if(!firstTurn&&!deck.length)return {state:{...state,cards:refreshed,turn:actor,turnNumber,phase:'draw'},addedDonIds:[],gameOver:actor};
 const drawn=firstTurn?undefined:deck[0];
 const afterDraw=drawn?refreshed.map(card=>card.id===drawn.id?{...card,zone:'hand' as CardZone}:card):refreshed;
 const donCount=firstTurn?1:2;
 const hadDonBeforeDonPhase=afterDraw.some(card=>card.owner===actor&&card.type==='DON!!'&&card.zone==='cost-area');
 const dons=afterDraw.filter(card=>card.owner===actor&&card.zone==='don-deck').slice(0,donCount);
 let nextState:MatchEffectState={...state,turnEffects:state.turnEffects.filter(effect=>!skippedReadyIds.has(effect.target)),cards:afterDraw.map(card=>dons.some(don=>don.id===card.id)?{...card,zone:'cost-area' as CardZone,rested:false}:card),turn:actor,turnNumber,phase:'main' as TurnPhase,playedThisTurn:[]};
 nextState=applyDonPhaseLeaderAttachment(nextState,actor,dons.map(card=>card.id),hadDonBeforeDonPhase);
 return {state:nextState,drawnCardId:drawn?.id,addedDonIds:dons.map(card=>card.id),gameOver:!firstTurn&&deck.length===1?actor:undefined};
}

/** Resolves passive Leader replacement text against DON!! that actually entered in this DON!! Phase. */
export function applyDonPhaseLeaderAttachment(state:MatchEffectState,actor:PlayerId,placedDonIds:string[],hadDonBeforeDonPhase:boolean):MatchEffectState{
 if(!hadDonBeforeDonPhase)return state;
 const leader=cardsFor(state,actor,'leader').find(card=>card.type==='Leader');if(!leader?.effectSchema)return state;
 const applies=leader.effectSchema.ast.some(ability=>ability.actions.some(action=>action.kind==='don-phase-attach')&&ability.conditions.every(condition=>evaluateEffectCondition(condition.text,state,actor,leader.id)===true));
 const donId=placedDonIds.find(id=>state.cards.some(card=>card.id===id&&card.owner===actor&&card.type==='DON!!'&&card.zone==='cost-area'&&!card.attachedTo));
 return applies&&donId?update(state,donId,{attachedTo:leader.id}):state;
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
 if(state.turnEffects.some(item=>item.kind==='hand-play-prohibition'&&item.owner===actor))return {state,error:'You cannot play cards from your hand during this turn.'};
 const card=state.cards.find(item=>item.id===cardId);
 if(!card||card.owner!==actor||card.zone!=='hand'||!['Character','Stage','Event'].includes(card.type??''))return {state,error:'Select a Character, Stage, or Event from your hand.'};
 if(card.type==='Event'&&!card.keywords?.includes('main'))return {state,error:'Only an Event with [Main] can be activated during the Main Phase.'};
 const cost=effectivePlayCost(state,actor,card);const donors=cardsFor(state,actor,'cost-area').filter(item=>item.type==='DON!!'&&!item.rested&&!item.attachedTo).slice(0,cost);
 if(donors.length!==cost)return {state,error:'There are not enough active DON!! cards to pay this cost.'};
 const capacity=replaceCharactersForPlay(state,actor,card.type==='Character'?1:0,replacementIds);
 if(capacity.error||capacity.requiresSelection)return capacity;
 const next=capacity.state.cards.map(item=>donors.some(don=>don.id===item.id)?{...item,rested:true}:item).map(item=>{
  if(item.id!==cardId)return item;
  if(item.type==='Event')return {...item,zone:'trash' as CardZone,rested:false};
  return {...item,zone:(item.type==='Stage'?'stage':'character') as CardZone,rested:false};
 });
 const withStageReplacement=card.type==='Stage'?next.map(item=>item.owner===actor&&item.zone==='stage'&&item.id!==cardId?{...item,zone:'trash' as CardZone,rested:false}:item):next;
 const turnEffects=capacity.state.turnEffects.filter(effect=>!(effect.kind==='cost-reduction'&&effect.nextOnly&&effect.target&&state.cards.find(item=>item.id===effect.target)?.owner===actor&&(!effect.cardType||card.type===effect.cardType)&&(!effect.trait||card.traits?.some(trait=>trait.toLowerCase()===effect.trait!.toLowerCase()))&&(effect.minimumCost===undefined||(card.cost??0)>=effect.minimumCost)));
 return {state:{...capacity.state,cards:withStageReplacement,turnEffects,playedThisTurn:[...(state.playedThisTurn??[]),cardId]},playedCardId:cardId};
}

/** An attack rests its active attacker; new Characters need Rush and the first player cannot attack on turn one. */
export function hasCardKeyword(card:MatchCard,keyword:string,state?:MatchEffectState):boolean{
 if(card.temporaryKeywords?.includes(keyword)||keyword==='rush'&&card.temporaryKeywords?.includes('rush-character'))return true;
 if(card.effectNegated)return false;
 if(card.keywords?.includes(keyword))return true;
 return Boolean(card.effectSchema?.ast.some(ability=>{
  const requiredDon=ability.actions.find(action=>action.kind==='attach-don-required')?.amount??0;
  const hasRequiredDon=requiredDon===0||Boolean(state&&state.cards.filter(don=>don.owner===card.owner&&don.type==='DON!!'&&don.attachedTo===card.id).length>=requiredDon);
  return ability.actions.some(action=>action.kind===keyword&&hasRequiredDon||action.kind==='grant-keyword'&&action.keyword===keyword&&hasRequiredDon&&(!action.continuous||Boolean(state&&protectionConditionsMet(state,card,ability))));
 }));
}

export function declareAttack(state:MatchEffectState,actor:PlayerId,attackerId:string,targetId:string):AttackDeclaration{
 if(state.phase&&state.phase!=='main')return {state,error:'Attacks can only be declared during the Main Phase.'};
 if(state.turn!==actor)return {state,error:'Only the turn player can attack.'};
 if(state.turnNumber===1&&state.firstPlayer===actor)return {state,error:'The first player cannot attack on their first turn.'};
 const attacker=state.cards.find(card=>card.id===attackerId),target=state.cards.find(card=>card.id===targetId);
 if(!attacker||attacker.owner!==actor||!['leader','character'].includes(attacker.zone)||attacker.rested)return {state,error:'Select an active Leader or Character to attack.'};
 if(attacker.cannotAttack)return {state,error:'This card cannot attack for the duration of the printed restriction.'};
 if(!attacker.effectNegated&&attacker.effectSchema?.ast.some(ability=>ability.actions.some(action=>action.kind==='attack-prohibition'&&(action.scope==='own-leader'?attacker.zone==='leader':attacker.zone==='character')&&!action.condition&&!action.target&&!action.during)))return {state,error:attacker.zone==='leader'?'This Leader cannot attack.':'This Character cannot attack.'};
 const canAttackCharacterOnPlay=target?.zone==='character'&&(state.playedThisTurn??[]).includes(attackerId)&&state.turnEffects.some(effect=>effect.kind==='attack-permission'&&effect.target===attackerId&&effect.detail==='character-on-play'&&effect.owner===actor);
 if(attacker.zone==='character'&&(state.playedThisTurn??[]).includes(attackerId)&&!hasCardKeyword(attacker,'rush',state)&&!canAttackCharacterOnPlay)return {state,error:'A Character cannot attack on the turn it was played without Rush.'};
 if(!target||target.owner!==other(actor)||!['leader','character'].includes(target.zone))return {state,error:'Select the opponent Leader or Character as the attack target.'};
 if(attacker.zone==='leader'&&state.turnEffects.some(item=>item.kind==='leader-battle-attack-lock'&&item.target===attacker.id&&target.zone==='character'&&(target.cost??Infinity)<=(item.amount??-1)))return {state,error:'This Leader cannot attack that Character due to its effect this turn.'};
 if(attacker.temporaryKeywords?.includes('rush-character')&&target.zone!=='character')return {state,error:'This Character can attack Characters only while its Rush: Character permission applies.'};
 const targetLockedBy=state.cards.find(source=>source.owner===target.owner&&source.zone==='character'&&source.rested&&!source.effectNegated&&source.effectSchema?.ast.some(ability=>ability.actions.some(action=>action.kind==='attack-target-lock'&&action.whileSourceRested&&matchesCardName(source,action.targetName))));
 if(targetLockedBy&&target.id!==targetLockedBy.id)return {state,error:`You must attack ${targetLockedBy.name??'the rested Character'} while its effect applies.`};
 if(!attacker.effectNegated&&attacker.effectSchema?.ast.some(ability=>ability.actions.some(action=>action.kind==='attack-prohibition'&&(action.scope==='own-leader'?attacker.zone==='leader':attacker.zone==='character')&&(!action.during||(action.during==='play-turn'&&(state.playedThisTurn??[]).includes(attackerId)))&&(!action.target||target.zone===action.target)&&(!action.condition||evaluateEffectCondition(action.condition,state,actor,attackerId)!==true))))return {state,error:'This attack target is prohibited by the card effect.'};
 if(target.zone==='character'&&!target.rested){const permission=state.turnEffects.some(effect=>effect.kind==='attack-permission'&&effect.target===attackerId&&effect.amount===1)||attacker.effectSchema?.ast.some(ability=>{const requiredDon=ability.actions.reduce((maximum,action)=>action.kind==='attach-don-required'?Math.max(maximum,action.amount):maximum,0);const enoughDon=state.cards.filter(don=>don.owner===actor&&don.type==='DON!!'&&don.attachedTo===attacker.id).length>=requiredDon;return ability.actions.some(action=>action.kind==='attack-permission'&&action.activeTargets&&!action.until)&&enoughDon&&ability.conditions.every(condition=>evaluateEffectCondition(condition.text,state,actor,attacker.id)===true);});if(!permission)return {state,error:'Characters must be rested to be chosen as an attack target.'};}
 let next=update(state,attackerId,{rested:true});if(state.turnEffects.some(effect=>effect.kind==='attack-trigger-blocker-lock'&&effect.target===attackerId&&effect.owner===actor)&&!state.turnEffects.some(effect=>effect.kind==='prevent-keyword-activation'&&effect.detail==='blocker'&&!effect.target&&effect.owner===actor))next=effect(next,'prevent-keyword-activation',undefined,undefined,'blocker','turn-end',actor);return {state:next};
}

/** Counter cards are played from hand during battle and go to Trash after contributing their printed Counter. */
export function playCounters(state:MatchEffectState,defender:PlayerId,cardIds:string[],donCardIds:string[]=[]):CounterResult{
 const cards=state.cards.filter(card=>cardIds.includes(card.id));
 if(cards.length!==cardIds.length||cards.some(card=>card.owner!==defender||card.zone!=='hand'||!['Character','Event'].includes(card.type??'')||effectiveCounterAmount(state,card)<=0))return {state,total:0,error:'Selected cards are not legal Counter cards from the defending hand.'};
 const eventCost=cards.filter(card=>card.type==='Event').reduce((sum,card)=>sum+(card.cost??0),0);
 const donors=state.cards.filter(card=>donCardIds.includes(card.id));
 if(donors.length!==eventCost||donors.some(card=>card.owner!==defender||card.zone!=='cost-area'||card.type!=='DON!!'||card.rested))return {state,total:0,error:'Select active DON!! cards equal to the cost of the Counter Event cards.'};
 return {state:{...state,cards:state.cards.map(card=>donCardIds.includes(card.id)?{...card,rested:true}:cardIds.includes(card.id)?{...card,zone:'trash',rested:false}:card)},total:cards.reduce((sum,card)=>sum+effectiveCounterAmount(state,card),0)};
}

/** Applies one already-authorized effect action. The UI provides selections; legality remains here. */
export function applyEffectAction(state:MatchEffectState,actor:PlayerId,action:EffectAction,selection:EffectSelection={}):EffectStepResult{
 if(selection.cardIds&&new Set(selection.cardIds).size!==selection.cardIds.length)return {state,error:'Each selected card must be unique.'};
 if(action.kind==='don-phase-attach')return {state};
 if(action.kind==='add-don'&&action.selection){const available=cardsFor(state,actor,'don-deck').filter(card=>card.type==='DON!!');if(!available.length)return {state};if(!selection.cardIds)return {state,requiresSelection:`Choose up to ${Math.min(action.amount,available.length)} DON!! to add.`};const ids=selection.cardIds;if(ids.length>action.amount||ids.some(id=>!available.some(card=>card.id===id)))return {state,error:'Choose only available DON!! cards up to the printed amount.'};return {state:{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,zone:'cost-area',rested:Boolean(action.rested)}:card)}};}
 if(action.kind==='trash-life'&&action.selection){const available=action.scope==='both'?[actor,other(actor)].flatMap(owner=>cardsFor(state,owner,'life').slice(0,action.amount)):cardsFor(state,action.scope==='own'?actor:other(actor),'life').slice(0,action.amount);if(!available.length)return {state};if(selection.choice===undefined)return {state,requiresSelection:`Choose how many top Life cards to trash (up to ${Math.min(action.amount,available.length)}).`};const count=Number(selection.choice);if(!Number.isInteger(count)||count<0||count>Math.min(action.amount,available.length))return {state,error:'Choose a valid number of top Life cards to trash.'};if(count===0)return {state};return {state:available.slice(0,count).reduce((next,card)=>move(next,card.id,'trash',{faceUp:undefined}),state)};}
 if(action.kind==='attach-don'&&action.selection){const recipient=selected(state,selection);if(!recipient||!legalOwner(recipient,actor)||!['leader','character'].includes(recipient.zone))return {state,error:'Select your Character receiving the DON!!.'};if(!selection.cardIds)return {state,requiresSelection:`Choose up to ${action.amount} rested DON!! to attach.`};const ids=selection.cardIds;if(ids.length>action.amount)return {state,error:'Too many DON!! cards selected.'};const donors=ids.map(id=>state.cards.find(card=>card.id===id));if(donors.some(card=>!card||card.owner!==actor||card.type!=='DON!!'||card.zone!=='cost-area'||card.attachedTo||Boolean(card.rested)!==Boolean(action.rested)))return {state,error:'Selected DON!! do not match the printed source or rested state.'};return {state:{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,attachedTo:recipient.id}:card)}};}
 if(action.selection&&!(action.kind==='bottom-deck'&&typeof action.selection.max==='number'&&action.selection.max>1)){
  if(!['ko','trash-character','rest','cost','power','return-to-hand','bottom-deck','ready','move-to-life','life','play','grant-keyword','grant-attribute','grant-keyword-attribute','attack-trigger-blocker-lock','prevent-ready','attack-restriction','prevent-keyword-activation','negate-effect','reveal-hand','attack-permission'].includes(action.kind))return {state,error:'Target-count metadata is unsupported for this action.'};
  const single={...action,selection:undefined};
  const candidates=state.cards.filter(card=>{const result=applyEffectAction(state,actor,single,{targetId:card.id,sourceCardId:selection.sourceCardId});return !result.error&&!result.requiresSelection;});
  const all=action.selection.max==='all';
  const ids=all?candidates.map(card=>card.id):selection.cardIds??(selection.targetId?[selection.targetId]:undefined);
  if(action.kind==='play'&&action.topOnly&&(action.unselectedTopToBottom||action.unselectedTopPosition==='choice')&&(!ids&&!candidates.length||ids?.length===0)){const top=cardsFor(state,actor,'deck')[0];if(!top)return {state};const position=action.unselectedTopToBottom?'bottom':selection.position;if(!position)return {state,requiresSelection:'Choose whether to place the revealed card on top or bottom of your deck.'};return {state:moveToDeck(state,[top.id],position)};}
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
 if(action.kind==='rest'&&selection.sourceCardId&&targetCards().some(card=>card.owner!==actor&&protectedFromEffect(state,card,selection.sourceCardId,'rest')))return {state,error:'This Character cannot be rested by opponent effects.'};
 switch(action.kind){
  case 'negate-source-effect':{const source=state.cards.find(card=>card.id===(selection.sourceCardId??selection.targetId));if(!source||source.owner!==actor||!['leader','character','stage'].includes(source.zone))return {state,error:'The effect source is no longer in play.'};return {state:effect(update(state,source.id,{effectNegated:true}),'negate-effect',source.id,undefined,undefined,action.until,actor)};}
  case 'leader-battle-ready':{const source=state.cards.find(card=>card.id===(selection.sourceCardId??selection.targetId));if(!source||source.owner!==actor||source.zone!=='leader'||action.maxBaseCost<0)return {state,error:'This effect must be activated by your Leader.'};if(action.oncePerTurn&&state.turnEffects.some(item=>item.kind==='leader-battle-ready'&&item.target===source.id))return {state,error:'This Leader has already activated this effect this turn.'};return {state:effect(state,'leader-battle-ready',source.id,action.maxBaseCost,undefined,'turn-end',actor)};}
  case 'return-source-to-hand':{const source=selection.sourceCardId?state.cards.find(card=>card.id===selection.sourceCardId):undefined;if(!source||source.owner!==actor||!['life','trash'].includes(source.zone))return {state,error:'The effect source is not in your Life or Trash.'};return {state:move(state,source.id,'hand',{faceUp:undefined})};}
  case 'draw':{const cards=cardsFor(state,actor,'deck').slice(0,action.amount);return {state:{...state,cards:state.cards.map(card=>cards.some(item=>item.id===card.id)?{...card,zone:'hand'}:card)}};}
  case 'rest':{if(action.scope==='self'||action.scope==='own-leader'){const found=targetResult('Select your Leader or this card to rest.');if('result'in found)return found.result;if(!legalOwner(found.card,actor)||(action.scope==='own-leader'?found.card.zone!=='leader':!['character','stage'].includes(found.card.zone))||found.card.rested)return {state,error:'Selected card cannot pay this rest cost.'};return {state:update(state,found.card.id,{rested:true})};}const found=targetResult('Select an opponent card.');if('result'in found)return found.result;if(!legalOwner(found.card,opponent))return {state,error:'Selected card is not an opponent card.'};const legalZone=action.scope==='opponent-leader'?found.card.zone==='leader':action.scope==='opponent-character'?found.card.zone==='character':action.scope==='opponent-don'?found.card.zone==='cost-area'&&found.card.type==='DON!!'&&!found.card.attachedTo:['leader','character'].includes(found.card.zone);if(!legalZone)return {state,error:'Selected card is outside the printed rest target.'};const targetCost=Math.max(0,(found.card.cost??Infinity)+(found.card.costModifier??0));let maxCost=action.maxCost;if(action.maxCostFromLife)maxCost=action.maxCostFromLife==='both'?cardsFor(state,actor,'life').length+cardsFor(state,opponent,'life').length:cardsFor(state,action.maxCostFromLife==='own'?actor:opponent,'life').length;if(maxCost!==undefined&&targetCost>maxCost)return {state,error:'Selected card exceeds the printed cost limit.'};if(action.exactCost!==undefined&&targetCost!==action.exactCost)return {state,error:'Selected card does not match the printed exact cost.'};if(action.minAttachedDon!==undefined&&state.cards.filter(card=>card.owner===found.card.owner&&card.type==='DON!!'&&card.attachedTo===found.card.id).length<action.minAttachedDon)return {state,error:'Selected Character does not have enough DON!! attached.'};return {state:update(state,found.card.id,{rested:true})};}
  case 'ready':{
   const cards=targetCards();if(!selection.cardIds&&!selection.targetId)return {state,requiresSelection:'Select cards to set active.'};
   if(cards.length!==(selection.cardIds?.length??1)||cards.length>(action.amount??1))return {state,error:'Invalid number of cards selected.'};
   if(cards.some(card=>!legalOwner(card,actor)||(action.scope==='own-character'?card.zone!=='character':action.scope==='own-leader'?card.zone!=='leader':action.scope==='own-don'?card.zone!=='cost-area'||card.type!=='DON!!'||Boolean(card.attachedTo)||!card.rested:!['leader','character','stage'].includes(card.zone))||(action.restedOnly&&!card.rested)||((action.trait||action.traits?.length)&&!card.traits?.some(trait=>(action.trait?[action.trait]:action.traits!).some(expected=>trait.toLowerCase()===expected.toLowerCase())))||(action.attribute&&!card.attributes?.some(attribute=>attribute.toLowerCase()===action.attribute!.toLowerCase()))||(action.name&&!matchesCardName(card,action.name))||(action.color&&!card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))||(action.minCost!==undefined&&(card.cost??-Infinity)<action.minCost)||(action.maxCost!==undefined&&(card.cost??Infinity)>action.maxCost)))return {state,error:'Selected card is outside the printed ready target.'};
   return {state:cards.reduce((next,card)=>card.cannotReady?next:update(next,card.id,{rested:false}),state)};
  }
  case 'ready-choice':{if(selection.choice!=='character'&&selection.choice!=='don')return {state,requiresSelection:'Choose this Character or up to one DON!! card to set active.'};if(selection.choice==='character'){const source=selection.sourceCardId?state.cards.find(card=>card.id===selection.sourceCardId):undefined;if(!source||!legalOwner(source,actor)||source.zone!=='character'||source.type!=='Character')return {state,error:'The source Character is not in play.'};return {state:update(state,source.id,{rested:false})};}const ids=selection.cardIds??[];if(ids.length>(action.amount??1)||new Set(ids).size!==ids.length)return {state,error:'Select up to the printed number of DON!! cards.'};const dons=selectedCards(state,selection);if(dons.some(card=>!legalOwner(card,actor)||card.zone!=='cost-area'||card.type!=='DON!!'||!card.rested||card.attachedTo))return {state,error:'Select only your rested, unattached DON!! cards.'};return {state:dons.reduce((next,card)=>update(next,card.id,{rested:false}),state)};}
  case 'life-add-prohibition':{if(action.maxOwnLife!==undefined&&cardsFor(state,actor,'life').length>action.maxOwnLife)return {state};if(action.leaderName){const leader=cardsFor(state,actor,'leader')[0];if(!leader||!matchesCardName(leader,action.leaderName))return {state};}return {state:effect(state,'life-add-prohibition',undefined,undefined,undefined,'turn-end',actor)};}
  case 'ready-all-don':return {state:{...state,cards:state.cards.map(card=>card.owner===actor&&card.type==='DON!!'&&card.zone==='cost-area'?{...card,rested:false}:card)}};
  case 'ready-all-characters':{if(action.delay==='turn-end')return {state:{...state,turnEffects:[...state.turnEffects,{kind:'ready-all-characters-at-end',owner:actor,trait:action.trait,expires:'turn-end'}]}};return {state:{...state,cards:state.cards.map(card=>card.owner===actor&&card.zone==='character'&&(!action.trait||card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))?{...card,rested:false}:card)}};}
  case 'hand-play-prohibition':return {state:effect(state,'hand-play-prohibition',undefined,undefined,undefined,'turn-end',actor)};
   case 'trash-character':{if(action.scope!=='opponent')return {state,error:'Select an opponent Character to trash.'};const ids=selection.cardIds??(selection.targetId?[selection.targetId]:undefined);if(action.selection&&!ids)return {state,requiresSelection:`Choose ${action.selection.min===0?'up to':'exactly'} ${action.selection.max==='all'?'all':action.selection.max} eligible opposing Characters to trash.`};if(action.selection&&ids&&(ids.length<action.selection.min||(action.selection.max!=='all'&&ids.length>action.selection.max)||new Set(ids).size!==ids.length))return {state,error:'Choose a legal number of distinct opposing Characters.'};const targets=ids?ids.map(id=>state.cards.find(card=>card.id===id)):[];if(!action.selection){const found=targetResult('Select an opponent Character to trash.');if('result'in found)return found.result;targets.push(found.card);}for(const card of targets){if(!card||!legalOwner(card,opponent)||card.zone!=='character')return {state,error:'Select an opponent Character to trash.'};if(action.maxPower!==undefined&&(card.power??Infinity)>action.maxPower)return {state,error:'Selected Character exceeds the printed trash power limit.'};if(action.maxCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))>action.maxCost)return {state,error:'Selected Character exceeds the printed trash cost limit.'};if(action.exactCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))!==action.exactCost)return {state,error:'Selected Character does not match the printed trash cost.'};}return {state:targets.reduce((next,card)=>move(next,card!.id,'trash'),state)};}
   case 'ko':{const stageTarget=action.scope==='opponent-stage',found=targetResult(stageTarget?'Select an opponent Stage.':'Select an opponent Character.');if('result'in found)return found.result;const card=found.card;if(!legalOwner(card,opponent)||card.zone!==(stageTarget?'stage':'character'))return {state,error:stageTarget?'Selected card is not an opponent Stage.':'Selected card is not an opponent Character.'};if(!stageTarget&&action.requiresTrigger&&!/\[Trigger\]/i.test(card.effectText??''))return {state,error:'Selected Character does not have a Trigger effect.'};if(!stageTarget&&action.trait&&!card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))return {state,error:'Selected Character does not have the printed trait.'};if(!stageTarget&&action.name&&!matchesCardName(card,action.name))return {state,error:'Selected Character does not match the printed name.'};if(!stageTarget&&protectedFromEffect(state,card,selection.sourceCardId))return {state,error:'This Character cannot be K.O.’d by effects.'};let maxCost=action.maxCost;if(action.maxCostFromLife)maxCost=action.maxCostFromLife==='both'?cardsFor(state,actor,'life').length+cardsFor(state,opponent,'life').length:cardsFor(state,action.maxCostFromLife==='own'?actor:opponent,'life').length;if(action.conditionalMaxCost){const condition=evaluateEffectCondition(action.conditionalMaxCost.condition,state,actor);if(condition===undefined)return {state,error:'Unsupported conditional K.O. cost limit.'};if(condition)maxCost=action.conditionalMaxCost.amount;}if(maxCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))>maxCost)return {state,error:'Selected Character exceeds the printed cost limit.'};if(action.exactCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))!==action.exactCost)return {state,error:'Selected Character does not have the exact printed cost.'};if(action.maxBaseCost!==undefined&&(card.cost??Infinity)>action.maxBaseCost)return {state,error:'Selected Character exceeds the printed base-cost limit.'};if(action.exactBaseCost!==undefined&&(card.cost??Infinity)!==action.exactBaseCost)return {state,error:'Selected Character does not have the exact printed base cost.'};if(action.maxPower!==undefined&&((card.power??Infinity)+(card.powerModifier??0))>action.maxPower)return {state,error:'Selected Character exceeds the printed power limit.'};if(action.maxBasePower!==undefined&&(card.power??Infinity)>action.maxBasePower)return {state,error:'Selected Character exceeds the printed base-power limit.'};if(action.minAttachedDon!==undefined&&state.cards.filter(don=>don.owner===card.owner&&don.type==='DON!!'&&don.attachedTo===card.id).length<action.minAttachedDon)return {state,error:'Selected Character does not have enough DON!! attached.'};if(action.restedOnly&&!card.rested)return {state,error:'Selected Character must be rested.'};
   if(action.costEqualAttachedDon){const attached=state.cards.filter(don=>don.owner===card.owner&&don.type==='DON!!'&&don.attachedTo===card.id).length;if(Math.max(0,(card.cost??Infinity)+(card.costModifier??0))!==attached)return {state};}
   const removalReplacementSources=stageTarget?[]:cardsFor(state,card.owner).filter(source=>['leader','character','stage'].includes(source.zone)&&!source.effectNegated).flatMap(source=>source.effectSchema?.ast.flatMap(ability=>ability.actions.filter((candidate):candidate is Extract<EffectAction,{kind:'replacement'}>=>candidate.kind==='replacement'&&['removed-by-effect','ko-by-effect','ko'].includes(candidate.event)&&(candidate.event!=='ko'||state.turn!==source.owner)&&(!candidate.eligibility?.scope||candidate.eligibility.scope==='self'&&source.id===card.id||candidate.eligibility.scope==='own-characters')&&(!candidate.eligibility?.cardType||card.type===candidate.eligibility.cardType)&&(!candidate.eligibility?.trait||(card.traits?.some(trait=>trait.toLowerCase().includes(candidate.eligibility!.trait!.toLowerCase()))??false))&&(!candidate.eligibility?.color||(card.color?.toLowerCase().includes(candidate.eligibility.color.toLowerCase())??false))&&(candidate.eligibility?.maxBaseCost===undefined||(card.cost??Infinity)<=candidate.eligibility.maxBaseCost)&&(candidate.eligibility?.maxBasePower===undefined||(card.power??Infinity)<=candidate.eligibility.maxBasePower)&&(!candidate.oncePerTurn||!state.turnEffects.some(effect=>effect.kind==='replacement-used'&&effect.target===source.id))).map(replacement=>({source,replacement})))??[]);
   const replacementPaymentCards=(replacement:Extract<EffectAction,{kind:'replacement'}>,owner:PlayerId)=>replacement.cost.kind==='bottom-deck-trash'?cardsFor(state,owner,'trash'):replacement.cost.kind==='trash-life'?(()=>{const life=cardsFor(state,owner,'life');return Array.from(new Set([life[0],life[life.length-1]].filter((item):item is MatchCard=>Boolean(item))))})():replacement.cost.kind==='trash-hand-character'?cardsFor(state,owner,'hand').filter(item=>item.type==='Character'&&(item.power??0)>=(replacement.cost.minPower??0)):replacement.cost.kind==='return-don'?cardsFor(state,owner,'cost-area').filter(item=>item.type==='DON!!'):replacement.cost.kind==='rest-don'?cardsFor(state,owner,'cost-area').filter(item=>item.type==='DON!!'&&!item.rested):replacement.cost.kind==='rest-card'?cardsFor(state,owner).filter(item=>['leader','character','stage','cost-area'].includes(item.zone)&&!item.rested):[];
   const removalOffer=removalReplacementSources.find(({source,replacement})=>{const amount=replacement.cost.amount??(replacement.cost.kind==='return-don'?1:0);return replacementPaymentCards(replacement,source.owner).length>=amount&&amount>0;});
   if(removalOffer){const {source:replacementSource,replacement:removedReplacement}=removalOffer,amount=removedReplacement.cost.amount??(removedReplacement.cost.kind==='return-don'?1:0),paymentCards=replacementPaymentCards(removedReplacement,replacementSource.owner),prompt=removedReplacement.cost.kind==='bottom-deck-trash'&&removedReplacement.event!=='removed-by-effect'?`${replacementSource.name??'This Character'}: you may place ${amount} cards from your Trash at the bottom of your deck instead of this K.O.`:`${replacementSource.name??'This Character'}: you may pay its removal replacement.`;if(selection.choice==='accept'){const ids=selection.cardIds;if(!ids)return {state,requiresSelection:`Choose ${amount} ${removedReplacement.cost.kind==='bottom-deck-trash'?'Trash':removedReplacement.cost.kind==='trash-life'?'top or bottom Life card':removedReplacement.cost.kind==='trash-hand-character'?'qualifying Character from your hand':removedReplacement.cost.kind==='return-don'?'DON!!':'active card'}${amount===1?'':'s'} to pay for ${replacementSource.name??'this Character'}’s replacement.`};if(ids.length!==amount||new Set(ids).size!==amount||ids.some(id=>!paymentCards.some(item=>item.id===id)))return {state,error:removedReplacement.cost.kind==='bottom-deck-trash'?`Choose exactly ${amount} different cards from your Trash.`:'The selected replacement payment is not legal.'};const paid=removedReplacement.cost.kind==='return-don'?{...state,cards:state.cards.map(item=>ids.includes(item.id)?{...item,zone:'don-deck' as const,rested:false,attachedTo:undefined}:item)}:removedReplacement.cost.kind==='bottom-deck-trash'?moveToDeck(state,ids,'bottom'):{...state,cards:state.cards.map(item=>ids.includes(item.id)?{...item,...(removedReplacement.cost.kind==='trash-hand-character'||removedReplacement.cost.kind==='trash-life'?{zone:'trash' as const,rested:false}:{rested:true}),attachedTo:undefined}:item)};return {state:removedReplacement.oncePerTurn?effect(paid,'replacement-used',replacementSource.id,undefined,removedReplacement.event,'turn-end'):paid};}if(selection.choice!=='decline')return {state,requiresSelection:prompt};}
   const replacementSource=stageTarget?undefined:cardsFor(state,opponent,'character').find(source=>!source.effectNegated&&source.effectSchema?.ast.some(ability=>ability.trigger==='continuous'&&ability.actions.some(candidate=>candidate.kind==='replacement'&&candidate.event==='ko-by-effect'&&candidate.cost.kind==='bottom-deck-trash'&&(!candidate.eligibility?.color||card.color?.toLowerCase().includes(candidate.eligibility.color.toLowerCase()))&&(!candidate.eligibility?.cardType||card.type===candidate.eligibility.cardType)&&(candidate.eligibility?.maxBaseCost===undefined||(card.cost??Infinity)<=candidate.eligibility.maxBaseCost)&&(!candidate.oncePerTurn||!state.turnEffects.some(effect=>effect.kind==='replacement-used'&&effect.target===source.id)))));
   const replacement=replacementSource?.effectSchema?.ast.flatMap(ability=>ability.actions).find((candidate):candidate is Extract<EffectAction,{kind:'replacement'}>=>candidate.kind==='replacement'&&candidate.event==='ko-by-effect'&&candidate.cost.kind==='bottom-deck-trash');
   if(replacementSource&&replacement){const count=replacement.cost.kind==='bottom-deck-trash'?(replacement.cost.amount??0):0;const trash=cardsFor(state,opponent,'trash');if(selection.choice==='accept'){
     if(!count||!selection.cardIds)return {state,requiresSelection:`Choose exactly ${count} cards from your Trash to place at the bottom of your deck.`};
     if(selection.cardIds.length!==count||new Set(selection.cardIds).size!==count||selection.cardIds.some(id=>!trash.some(item=>item.id===id)))return {state,error:`Choose exactly ${count} different cards from your Trash.`};
     const decked=moveToDeck(state,selection.cardIds,'bottom');const marked=replacement.oncePerTurn?effect(decked,'replacement-used',replacementSource.id,undefined,'ko-by-effect','turn-end'):decked;return {state:marked};
    }
    if(selection.choice!=='decline'&&trash.length>=count&&count>0)return {state,requiresSelection:`${replacementSource.name??'A Character'}: you may place ${count} cards from your Trash at the bottom of your deck instead of this K.O.`,};
   }
   return {state:move(state,card.id,'trash')};}
  case 'return-to-hand':case 'return-to-deck':case 'bottom-deck':{if(action.kind==='bottom-deck'&&action.selection&&typeof action.selection.max==='number'&&action.selection.max>1){const ids=selection.deckOrder??selection.cardIds;if(!ids)return {state,requiresSelection:`Select ${action.selection.min===action.selection.max?'exactly '+action.selection.max:'up to '+action.selection.max} eligible cards and order them.`};const single={...action,selection:undefined},eligible=new Set(state.cards.filter(card=>{const result=applyEffectAction(state,actor,single,{targetId:card.id});return !result.error&&!result.requiresSelection;}).map(card=>card.id));if(ids.length<action.selection.min||ids.length>action.selection.max||new Set(ids).size!==ids.length||ids.some(id=>!eligible.has(id)))return {state,error:'Selected cards do not match the printed bottom-deck requirement.'};return {state:moveToDeck(state,ids,'bottom')};}const found=targetResult('Select a legal card.');if('result'in found)return found.result;const card=found.card;const anyOwner=action.scope==='any-character'||action.scope==='any-card';const expected=action.scope==='own-character'||action.scope==='trash'?actor:opponent;const zoneForScope=action.scope==='trash'||action.scope==='opponent-trash'?'trash':action.scope==='opponent-hand'?'hand':action.scope==='opponent-life'?'life':action.scope==='any-card'?['leader','character','stage'].includes(card.zone)?card.zone:'': 'character';const expectedOwner=action.scope==='opponent-trash'?opponent:expected;if((!anyOwner&&!legalOwner(card,expectedOwner))||card.zone!==zoneForScope||(action.kind==='return-to-hand'&&action.activeOnly&&card.rested))return {state,error:'Selected card is outside the printed effect target.'};if('maxCost'in action&&action.maxCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))>action.maxCost)return {state,error:'Selected card exceeds the printed cost limit.'};if(action.kind==='return-to-hand'&&action.maxPower!==undefined&&((card.power??Infinity)+(card.powerModifier??0))>action.maxPower)return {state,error:'Selected card exceeds the printed power limit.'};if(action.kind==='return-to-hand'&&action.maxBasePower!==undefined&&(card.power??Infinity)>action.maxBasePower)return {state,error:'Selected card exceeds the printed base-power limit.'};if(action.kind==='bottom-deck'&&action.maxPower!==undefined&&((card.power??Infinity)+(card.powerModifier??0))>action.maxPower)return {state,error:'Selected card exceeds the printed power limit.'};if(action.kind==='bottom-deck'&&action.cardType&&card.type!==action.cardType)return {state,error:'Selected card does not match the printed card type.'};return {state:action.kind==='return-to-hand'?move(state,card.id,'hand'):moveToDeck(state,[card.id],action.kind==='return-to-deck'?action.position:'bottom')};}
  case 'trash':{const zone=action.scope==='hand'?'hand':action.scope==='deck'?'deck':action.scope==='opponent-hand'?'hand':undefined;const owner=action.scope==='opponent-hand'?opponent:actor;if(action.scope==='self'){const found=targetResult('Select this card.');if('result'in found)return found.result;if(!legalOwner(found.card,actor))return {state,error:'Selected card is not yours.'};return {state:move(state,found.card.id,'trash')};}const candidates=cardsFor(state,owner,zone).filter(card=>(!action.requiresTrigger||hasTrigger(card))&&(!action.color||card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))&&(!action.trait||card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))&&(!action.cardType||card.type===action.cardType)&&(action.maxCost===undefined||(card.cost??Infinity)<=action.maxCost));if(action.all){const trashed={...state,cards:state.cards.map(card=>candidates.some(candidate=>candidate.id===card.id)?{...card,zone:'trash' as const}:card)};return {state:action.scope==='hand'||action.scope==='opponent-hand'?resolveHandTrashListeners(trashed,owner,candidates.length,selection.sourceCardId):trashed};}if(action.upTo){const maximum=Math.min(action.amount,candidates.length),ids=selection.cardIds;if(!ids){return maximum===0?{state}:{state,requiresSelection:`Select up to ${maximum} card${maximum===1?'':'s'} from your hand, or skip.`};}if(ids.length>maximum||new Set(ids).size!==ids.length||ids.some(id=>!candidates.some(card=>card.id===id)))return {state,error:`Select up to ${maximum} eligible cards.`};const trashed={...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,zone:'trash' as const}:card)};return {state:action.scope==='hand'||action.scope==='opponent-hand'?resolveHandTrashListeners(trashed,owner,ids.length,selection.sourceCardId):trashed};}const required=Math.min(action.amount,candidates.length);if(action.scope==='deck')return {state:candidates.slice(0,required).reduce((next,card)=>move(next,card.id,'trash'),state)};if(required===0)return {state};const ids=selection.cardIds;if(!ids)return {state,requiresSelection:`Select ${required} card${required===1?'':'s'}.`};if(ids.length!==required)return {state,error:`Select exactly ${required} card${required===1?'':'s'}.`};if(ids.some(id=>!candidates.some(card=>card.id===id)))return {state,error:'A selected card is outside the legal zone.'};const trashed={...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,zone:'trash' as const}:card)};return {state:action.scope==='hand'||action.scope==='opponent-hand'?resolveHandTrashListeners(trashed,owner,ids.length,selection.sourceCardId):trashed};}
  case 'prevent-keyword-activation':{const eligible=(card:MatchCard)=>card.owner===opponent&&card.zone==='character'&&hasCardKeyword(card,action.keyword,state)&&(action.maxPower===undefined||effectiveCardPower(state,card.id)<=action.maxPower)&&(action.maxCost===undefined||(action.baseCost?card.cost??Infinity:Math.max(0,(card.cost??Infinity)+(card.costModifier??0)))<=action.maxCost);if(selection.targetId){const card=state.cards.find(item=>item.id===selection.targetId);if(!card||!eligible(card))return {state,error:'Selected Character is outside the printed Blocker restriction.'};return {state:effect(state,'prevent-keyword-activation',card.id,action.maxPower??action.maxCost??0,action.keyword,action.until,actor)};}const candidates=cardsFor(state,opponent,'character').filter(eligible);if(!candidates.length)return {state};return {state:candidates.reduce((next,card)=>effect(next,'prevent-keyword-activation',card.id,action.maxPower??action.maxCost??0,action.keyword,action.until,actor),state)};}
  case 'power':case 'cost':case 'set-power':case 'set-cost':case 'base-power':case 'copy-base-power':case 'swap-power':case 'negate-effect':{const found=targetResult('Select the card affected by this effect.');if('result'in found)return found.result;const card=found.card;const expected=('target' in action&&String(action.target).startsWith('opponent'))||action.kind==='negate-effect'&&action.scope.startsWith('opponent')?opponent:actor;const namedLeaderAlternative=action.kind==='power'&&action.target==='own-character-or-named-leader';const validZone=action.kind==='negate-effect'?(action.scope==='opponent-character'?card.zone==='character':['leader','character'].includes(card.zone)):namedLeaderAlternative?(card.zone==='character'||(card.zone==='leader'&&action.kind==='power'&&action.name!==undefined&&matchesCardName(card,action.name))):!('target'in action&&action.target.endsWith('character'))?['leader','character'].includes(card.zone):card.zone==='character';if(!legalOwner(card,expected)||!validZone||(!namedLeaderAlternative&&'target'in action&&action.target.endsWith('leader')&&card.zone!=='leader'))return {state,error:'Selected card is outside the printed effect target.'};if(action.kind==='cost'&&action.maxCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))>action.maxCost)return {state,error:'Selected Character exceeds the printed cost limit.'};if(action.kind==='power'){if(action.trait&&!card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))return {state,error:'Selected card does not have the printed trait.'};if(action.attribute&&!card.attributes?.some(attribute=>attribute.toLowerCase()===action.attribute!.toLowerCase()))return {state,error:'Selected card does not have the printed attribute.'};if(action.name&&(!namedLeaderAlternative||card.zone==='leader')&&card.name?.toLowerCase()!==action.name.toLowerCase())return {state,error:'Selected card does not match the printed name.'};if(action.color&&!card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))return {state,error:'Selected card does not have the printed color.'};const targetCost=Math.max(0,(card.cost??Infinity)+(card.costModifier??0));if(action.exactCost!==undefined&&targetCost!==action.exactCost)return {state,error:'Selected card does not have the printed exact cost.'};if(action.minCost!==undefined&&targetCost<action.minCost)return {state,error:'Selected card is below the printed cost range.'};if(action.maxCost!==undefined&&targetCost>action.maxCost)return {state,error:'Selected card exceeds the printed cost limit.'};const bonus=action.bonus?evaluateEffectCondition(action.bonus.condition,state,actor):false;if(bonus===undefined)return {state,error:'Unsupported conditional power bonus.'};const amount=action.amount+(bonus?action.bonus!.amount:0);return {state:effect(update(state,card.id,{powerModifier:(card.powerModifier??0)+amount}),'power',card.id,amount,undefined,action.until,actor)};}if(action.kind==='cost')return {state:effect(update(state,card.id,{costModifier:(card.costModifier??0)+action.amount}),'cost',card.id,action.amount,undefined,'turn-end')};if(action.kind==='set-power'||action.kind==='base-power')return {state:effect(update(state,card.id,{power:action.amount,powerModifier:0}),action.kind,card.id,action.amount,undefined,action.until,actor)};if(action.kind==='set-cost')return {state:effect(update(state,card.id,{cost:action.amount,costModifier:0}),'set-cost',card.id,action.amount)};if(action.kind==='negate-effect'){if(action.maxCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))>action.maxCost)return {state,error:'Selected Character exceeds the printed cost limit.'};const negated=update(state,card.id,{effectNegated:true});if(action.andKo)return {state:move(negated,card.id,'trash',{effectNegated:true})};return {state:effect(negated,'negate-effect',card.id,action.amount,undefined,action.until)};}if(action.kind==='copy-base-power'){const source=action.from==='opponent-leader'?state.cards.find(item=>item.owner===opponent&&item.zone==='leader'):selection.cardIds?.map(id=>state.cards.find(item=>item.id===id)).find((item):item is MatchCard=>Boolean(item));if(!source||!legalOwner(source,opponent)||source.zone!==(action.from==='opponent-leader'?'leader':'character'))return {state,error:action.from==='opponent-leader'?'The opponent Leader whose power should be copied is not in play.':'Select an opponent Character whose base power will be copied.'};const previousPower=card.power??0;return {state:{...effect(update(state,card.id,{power:source.power??0,powerModifier:0}),'copy-base-power',card.id,source.power??0,String(previousPower),action.until,actor)}};}const otherCard=selection.cardIds?.map(id=>state.cards.find(item=>item.id===id)).find((item):item is MatchCard=>Boolean(item));if(!otherCard||!['leader','character'].includes(otherCard.zone)||otherCard.id===card.id)return {state,requiresSelection:'Select the other Leader or Character whose power will be swapped.'};return {state:effect({...state,cards:state.cards.map(item=>item.id===card.id?{...item,power:otherCard.power,powerModifier:0}:item.id===otherCard.id?{...item,power:card.power,powerModifier:0}:item)},'swap-power',card.id,otherCard.power)};}
  case 'grant-keyword':{const found=targetResult('Select a legal card that gains this keyword.');if('result'in found)return found.result;const card=found.card;const expectedZone=action.scope==='own-leader'?'leader':'character';if(!legalOwner(card,actor)||!(action.scope==='own-card'?['leader','character'].includes(card.zone):action.scope==='self'?['leader','character'].includes(card.zone)&&(!selection.sourceCardId||card.id===selection.sourceCardId):card.zone===expectedZone))return {state,error:'Selected card is outside the printed keyword target.'};if(action.trait&&!card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))return {state,error:'Selected card does not have the printed trait.'};if(action.name&&!matchesCardName(card,action.name))return {state,error:'Selected card does not match the printed name.'};if(action.color&&!card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))return {state,error:'Selected card does not have the printed color.'};if(action.maxCost!==undefined&&(card.cost??Infinity)>action.maxCost)return {state,error:'Selected card exceeds the printed cost limit.'};if(action.exactCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))!==action.exactCost)return {state,error:'Selected card does not have the printed exact cost.'};if(action.withoutOnPlay&&/\[On Play\]/i.test(card.effectText??card.effectSchema?.rawEffectText??''))return {state,error:'Selected Character has an On Play effect.'};const temporaryKeywords=[...new Set([...(card.temporaryKeywords??[]),action.keyword])];return {state:effect(update(state,card.id,{temporaryKeywords}),'grant-keyword',card.id,undefined,action.keyword,action.until,actor)};}
  case 'grant-attribute':{const found=targetResult('Select a Character receiving the attribute.');if('result'in found)return found.result;const card=found.card;if(!legalOwner(card,actor)||card.zone!=='character'||action.name&&!matchesCardName(card,action.name))return {state,error:'Select an eligible Character receiving the attribute.'};const temporaryAttributes=[...new Set([...(card.temporaryAttributes??[]),action.attribute])];return {state:effect(update(state,card.id,{temporaryAttributes}),'grant-attribute',card.id,undefined,action.attribute,action.until,actor)};}
  case 'grant-keyword-attribute':{const found=targetResult('Select an eligible Character receiving the keyword and attribute.');if('result'in found)return found.result;const card=found.card;if(!legalOwner(card,actor)||card.zone!=='character'||action.name&&!matchesCardName(card,action.name))return {state,error:'Select the printed Character target.'};return {state:effect(effect(update(state,card.id,{temporaryKeywords:[...new Set([...(card.temporaryKeywords??[]),action.keyword])],temporaryAttributes:[...new Set([...(card.temporaryAttributes??[]),action.attribute])]}),'grant-keyword-attribute',card.id,undefined,action.keyword,action.until,actor),'grant-keyword-attribute',card.id,undefined,action.attribute,action.until,actor)};}
  case 'prevent-ko':{const found=targetResult('Select the Character protected from K.O.');if('result'in found)return found.result;const card=found.card;if(!legalOwner(card,actor)||card.zone!=='character')return {state,error:'Select one of your Characters.'};return {state:effect(update(state,card.id,{preventKo:action.by}),'prevent-ko',card.id)};}
  case 'attack-permission':{const found=targetResult('Select your Character receiving attack permission.');if('result'in found)return found.result;if(!legalOwner(found.card,actor)||found.card.zone!=='character'||action.trait&&!found.card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))return {state,error:'Select an eligible Character receiving attack permission.'};if(action.characterOnPlay&&!(state.playedThisTurn??[]).includes(found.card.id))return {state,error:'This attack permission applies to a Character played this turn.'};return {state:effect(state,'attack-permission',found.card.id,action.activeTargets?1:0,action.characterOnPlay?'character-on-play':undefined,action.until??(action.characterOnPlay?'turn-end':undefined),actor)};}
  case 'attack-trigger-blocker-lock':{const found=targetResult('Select a Character to receive the Blocker restriction.');if('result'in found)return found.result;const card=found.card;if(!legalOwner(card,actor)||card.zone!=='character'||!card.traits?.some(trait=>trait.toLowerCase()===action.trait.toLowerCase())||effectiveCardPower(state,card.id)<action.minPower)return {state,error:'Select an eligible Character with the required trait and power.'};return {state:effect(state,'attack-trigger-blocker-lock',card.id,action.minPower,action.trait,'turn-end',actor)};}
  case 'cost-reduction':return {state:{...state,turnEffects:[...state.turnEffects,{kind:'cost-reduction',target:selection.sourceCardId,amount:action.amount,cardType:action.cardType,trait:action.trait,minimumCost:action.minimumCost,nextOnly:action.nextOnly,expires:'turn-end'}]}};
  case 'draw-trashed-cards':return {state,error:'This action only resolves when a card is trashed from hand by an effect.'};
  case 'skip-next-refresh':{const found=targetResult('Select this Character.');if('result'in found)return found.result;if(!legalOwner(found.card,actor)||found.card.zone!=='character')return {state,error:'Select this Character in your Character area.'};return {state:effect(state,'skip-next-refresh',found.card.id)};}
  case 'attack-restriction':case 'prevent-rest':case 'prevent-ready':{
   const found=targetResult('Select the card affected by this restriction.');if('result'in found)return found.result;
   const card=found.card;if(!legalOwner(card,opponent)||action.kind==='attack-restriction'&&(!(action.scope==='opponent-card'?['leader','character'].includes(card.zone):card.zone===(action.scope==='opponent-leader'?'leader':'character'))||action.maxCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))>action.maxCost||action.excludeName!==undefined&&matchesCardName(card,action.excludeName))||!['leader','character','cost-area'].includes(card.zone))return {state,error:'Select an opponent card affected by this restriction.'};
   if(action.kind==='prevent-ready'){
    const attachedDonCount=state.cards.filter(don=>don.owner===card.owner&&don.type==='DON!!'&&don.attachedTo===card.id).length;const legalTarget=action.scope==='opponent-character'
     ?card.zone==='character'&&(!action.restedOnly||card.rested)&&(action.maxCost===undefined||Math.max(0,(card.cost??Infinity)+(card.costModifier??0))<=action.maxCost)&&(action.exactCost===undefined||Math.max(0,(card.cost??Infinity)+(card.costModifier??0))===action.exactCost)&&(action.minAttachedDon===undefined||attachedDonCount>=action.minAttachedDon)
     :action.scope==='opponent-don'?card.zone==='cost-area'&&card.type==='DON!!'&&(!action.restedOnly||card.rested)&&(action.maxCost===undefined||Math.max(0,(card.cost??Infinity)+(card.costModifier??0))<=action.maxCost)&&(action.exactCost===undefined||Math.max(0,(card.cost??Infinity)+(card.costModifier??0))===action.exactCost):(['leader','character','stage'].includes(card.zone)||card.zone==='cost-area'&&card.type==='DON!!')&&(!action.restedOnly||card.rested)&&(action.maxCost===undefined||Math.max(0,(card.cost??Infinity)+(card.costModifier??0))<=action.maxCost)&&(action.exactCost===undefined||Math.max(0,(card.cost??Infinity)+(card.costModifier??0))===action.exactCost);
    if(!legalTarget)return {state,error:'Selected card is outside the printed no-ready target.'};
   }
   const patch=action.kind==='attack-restriction'?{cannotAttack:true}:action.kind==='prevent-ready'?{cannotReady:true}:{rested:true};
   return {state:effect(update(state,card.id,patch),action.kind,card.id,undefined,undefined,action.kind==='attack-restriction'?action.until:undefined,action.kind==='attack-restriction'?actor:undefined)};
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
   const deck=cardsFor(state,actor,'deck'),revealed=action.amount>0?deck.slice(0,action.amount):deck;
   if(!selection.cardIds)return {state,requiresSelection:'Choose eligible cards, or explicitly choose none.'};
   if(new Set(selection.cardIds).size!==selection.cardIds.length)return {state,error:'Duplicate selection.'};
   const cards=targetCards();
   if(cards.length!==selection.cardIds.length||cards.length>action.choose)return {state,error:'Invalid number of cards selected.'};
   if(cards.some(card=>!revealed.some(item=>item.id===card.id))||!matchesSearchSelection(cards,action))return {state,error:'Selected card does not satisfy the printed search restriction.'};
   const remainder=revealed.filter(card=>!cards.some(item=>item.id===card.id));
   const untouched=state.cards.filter(card=>!revealed.some(item=>item.id===card.id));
   if(action.remainderOrder){if(!selection.deckOrder)return {state,requiresSelection:'Order each remaining inspected card exactly once.'};if(selection.deckOrder.length!==remainder.length||new Set(selection.deckOrder).size!==remainder.length||selection.deckOrder.some(id=>!remainder.some(card=>card.id===id)))return {state,error:'Order each remaining inspected card exactly once.'};}
   const position=action.remainderPosition??'bottom';if(position==='choice'&&!selection.position)return {state,requiresSelection:'Choose whether to place the remaining inspected cards on top or bottom of your deck.'};
   const orderedRemainder=action.remainderOrder?selection.deckOrder!.map(id=>remainder.find(card=>card.id===id)!):remainder;
   const placedRemainder=orderedRemainder.map(card=>({...card,zone:action.destination==='trash'?'trash' as const:'deck' as const}));
   const handCards=cards.map(card=>({...card,zone:'hand' as const}));
   const untouchedDeck=untouched.filter(card=>card.owner===actor&&card.zone==='deck');
   const retained=state.cards.filter(card=>!(card.owner===actor&&card.zone==='deck')&&!revealed.some(item=>item.id===card.id));
   const deckCards=action.destination==='trash'?untouchedDeck:[...(position==='top'?placedRemainder:[]),...untouchedDeck,...(position==='top'?[]:placedRemainder)];
   const nextCards=[...retained,...deckCards,...handCards,...(action.destination==='trash'?placedRemainder:[])];
   return {state:{...state,cards:nextCards}};
  }
  case 'play':{
   if(selection.cardIds?.length===0){if(action.unselectedTopToBottom){const top=cardsFor(state,actor,'deck')[0];return top?{state:moveToDeck(state,[top.id],'bottom')}:{state};}return {state};}
   const cards=targetCards();if(!cards.length)return {state,requiresSelection:'Select a card to play.'};
   if(cards.length!==(selection.cardIds?.length??1))return {state,error:'A selected play card does not exist.'};
   if(cards.length>(action.amount??1))return {state,error:'Too many cards selected.'};
   if(cards.some(card=>card.effectSchema?.ast.some(ability=>ability.actions.some(candidate=>candidate.kind==='effect-play-prohibition'))))return {state,error:'This card cannot be played by an effect.'};
   const donField=cardsFor(state,actor).filter(card=>card.type==='DON!!'&&(card.zone==='cost-area'||Boolean(card.attachedTo))).length;
   const matchesAlternative=(card:MatchCard)=>!action.alternatives?.length||action.alternatives.some(alternative=>(!alternative.cardType||card.type===alternative.cardType)&&(!alternative.name||matchesCardName(card,alternative.name))&&(!alternative.trait||card.traits?.some(trait=>trait.toLowerCase()===alternative.trait!.toLowerCase()))&&(!alternative.color||card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===alternative.color!.toLowerCase()))&&(!alternative.attribute||card.attributes?.some(attribute=>attribute.toLowerCase()===alternative.attribute!.toLowerCase())));
   const legal=cards.every(card=>['Character','Stage'].includes(card.type??'')&&legalOwner(card,actor)&&card.zone===action.source&&(!action.topOnly||card.id===cardsFor(state,actor,'deck')[0]?.id)&&(action.maxCost===undefined||(card.cost??Infinity)<=action.maxCost)&&(action.minCost===undefined||(card.cost??-Infinity)>=action.minCost)&&(action.exactCost===undefined||card.cost===action.exactCost)&&(action.maxPower===undefined||(card.power??Infinity)<=action.maxPower)&&(action.minPower===undefined||(card.power??-Infinity)>=action.minPower)&&(action.exactPower===undefined||card.power===action.exactPower)&&(!action.costAtMostDonField||(card.cost??Infinity)<=donField)&&(!action.cardType||card.type===action.cardType)&&(!action.trait||card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))&&(!action.color||card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))&&(!action.attribute||card.attributes?.some(attribute=>attribute.toLowerCase()===action.attribute!.toLowerCase()))&&(!action.name||matchesCardName(card,action.name))&&(!action.triggerOnly||hasTrigger(card))&&(!action.noBaseEffect||typeof card.effectText==='string'&&!card.effectText.trim())&&matchesAlternative(card)&&(!action.excludeName||!matchesCardName(card,action.excludeName)));
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
   if(action.operation==='add-to-hand'&&state.turnEffects.some(item=>item.kind==='life-add-prohibition'&&item.owner===actor))return {state};
   if(action.operation==='opponent-top-to-owner-hand'){const top=cardsFor(state,opponent,'life').slice(0,action.amount);if(!selection.cardIds&&!selection.targetId)return {state,requiresSelection:`Choose up to ${action.amount} card${action.amount===1?'':'s'} from the top of your opponent's Life.`};const ids=selection.cardIds??(selection.targetId?[selection.targetId]:[]);if(ids.length>action.amount||ids.some((id,index)=>top[index]?.id!==id))return {state,error:'Choose only the top opponent Life cards, in order.'};return {state:ids.reduce((next,id)=>move(next,id,'hand',{faceUp:undefined}),state)};}
   const life=cardsFor(state,actor,'life').slice(0,action.amount);
   return {state:life.reduce((next,card)=>move(next,card.id,action.operation==='trash'?'trash':'hand',{faceUp:undefined}),state)};
  }
  case 'trash-life':{
   const owners=action.scope==='both'?[actor,opponent]:[action.scope==='own'?actor:opponent];
   const ids=owners.flatMap(owner=>{const life=cardsFor(state,owner,'life'),amount=action.leaveAt===undefined?action.amount:Math.max(0,life.length-action.leaveAt);return life.slice(0,amount).map(card=>card.id);});
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
  case 'recover':{if(!selection.cardIds&&!selection.targetId)return {state,requiresSelection:`Choose up to ${action.amount} cards from Trash.`};const cards=targetCards();if(cards.length!==(selection.cardIds?.length??1))return {state,error:'A selected recovery card does not exist.'};if(cards.length>action.amount)return {state,error:'Too many cards selected.'};if(cards.some(card=>!legalOwner(card,actor)||card.zone!=='trash'||(action.maxCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))>action.maxCost)||(action.minCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))<action.minCost)||(action.exactCost!==undefined&&Math.max(0,(card.cost??Infinity)+(card.costModifier??0))!==action.exactCost)||(action.cardType&&card.type!==action.cardType)||(action.name&&!matchesCardName(card,action.name))||(action.trait&&!card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))||(action.color&&!card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))||(action.excludeName&&matchesCardName(card,action.excludeName))))return {state,error:'Selected card does not satisfy the printed recovery restriction.'};return {state:{...state,cards:state.cards.map(card=>cards.some(item=>item.id===card.id)?{...card,zone:'hand'}:card)}};}
  case 'return-trash-to-deck-bottom':{const cards=targetCards();if(cards.length!==action.amount)return {state,requiresSelection:`Select ${action.amount} card${action.amount===1?'':'s'} from Trash.`};if(cards.some(card=>!legalOwner(card,actor)||card.zone!=='trash'))return {state,error:'Selected card is not in your Trash.'};return {state:moveToDeck(state,cards.map(card=>card.id),'bottom')};}
  case 'bottom-deck-hand':{return {state:moveToDeck(state,cardsFor(state,actor,'hand').map(card=>card.id),'bottom')};}
  case 'hand-reset':{
   const owner=action.scope==='self'?actor:opponent,hand=cardsFor(state,owner,'hand');
   let next=moveToDeck(state,hand.map(card=>card.id),'bottom');
   if(action.shuffle)next=shuffleDeck(next,owner);
   const draw=cardsFor(next,owner,'deck').slice(0,action.draw==='returned'?hand.length:action.draw??hand.length);
   return {state:draw.reduce((current,card)=>move(current,card.id,'hand'),next)};
  }
  case 'shuffle':return {state:shuffleDeck(state,action.scope==='self'?actor:opponent)};
  case 'reorder-life':{
   const owner=action.scope==='own'?actor:action.scope==='opponent'?opponent:selection.owner;
   if(!owner)return {state,requiresSelection:'Choose which player’s Life to inspect.'};
   const inspected=action.amount==='all'?cardsFor(state,owner,'life'):cardsFor(state,owner,'life').slice(0,action.amount);
   if(!inspected.length)return {state};
   const ids=selection.cardIds;
   if(!ids)return {state,requiresSelection:'Choose the order of the inspected Life cards.'};
   if(ids.length!==inspected.length||ids.some(id=>!inspected.some(card=>card.id===id)))return {state,error:'Order every inspected Life card exactly once.'};
   if(new Set(ids).size!==ids.length)return {state,error:'Order each inspected Life card exactly once.'};
   if(action.moveFirstToDeckTop){const first=state.cards.find(card=>card.id===ids[0])!;const lifeOrder=ids.slice(1).map(id=>state.cards.find(card=>card.id===id)!);const other=state.cards.filter(card=>!ids.includes(card.id));const deckIndex=other.findIndex(card=>card.owner===owner&&card.zone==='deck');const deckTop=[...other.slice(0,deckIndex<0?other.length:deckIndex),{...first,zone:'deck' as const,rested:false,attachedTo:undefined},...other.slice(deckIndex<0?other.length:deckIndex)];const result={...state,cards:[...lifeOrder,...deckTop.filter(card=>!lifeOrder.some(life=>life.id===card.id))]};return {state:result};}
   const ordered=ids.map(id=>inspected.find(card=>card.id===id)!);
   return {state:{...state,cards:[...ordered,...state.cards.filter(card=>!ids.includes(card.id))]}};
  }
  case 'set-life-face':{
   const owner=action.scope==='own'?actor:opponent;
   return {state:{...state,cards:state.cards.map(card=>card.owner===owner&&card.zone==='life'?{...card,faceUp:action.faceUp}:card)}};
  }
  case 'reveal':return {state:effect(state,action.kind,target?.id,action.amount)};
  case 'add-don':{const available=cardsFor(state,actor,'don-deck').filter(card=>card.type==='DON!!');if(!available.length)return {state};const requested=action.selection?selection.cardIds:undefined;if(action.selection&&!requested)return {state,requiresSelection:`Choose up to ${Math.min(action.amount,available.length)} DON!! to add.`};const ids=requested??available.slice(0,action.amount).map(card=>card.id);if(ids.length>action.amount||new Set(ids).size!==ids.length||ids.some(id=>!available.some(card=>card.id===id)))return {state,error:'Choose only available DON!! cards up to the printed amount.'};return {state:{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,zone:'cost-area',rested:Boolean(action.rested)}:card)}};}
  case 'return-don':{const cards=targetCards(),owner=action.owner==='opponent'?opponent:actor;if(cards.length!==action.amount)return {state,requiresSelection:`Select ${action.amount} DON!! card${action.amount===1?'':'s'} to return.`};if(cards.some(card=>!legalOwner(card,owner)||card.type!=='DON!!'||card.zone!=='cost-area'))return {state,error:`A selected card is not the ${action.owner==='opponent'?'opponent’s':'your'} DON!!.`};return {state:{...state,cards:state.cards.map(card=>cards.some(item=>item.id===card.id)?{...card,zone:'don-deck',rested:false,attachedTo:undefined}:card)}};}
  case 'attach-don':{const owner=action.owner==='opponent'?opponent:actor,found=targetResult(`Select ${owner===actor?'your':'your opponent’s'} Leader or Character.`);if('result'in found)return found.result;const recipient=found.card;if(!legalOwner(recipient,owner)||!['leader','character'].includes(recipient.zone)||action.name&&!matchesCardName(recipient,action.name)||action.trait&&!recipient.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))return {state,error:'Select an eligible Leader or Character to receive DON!!.'};const dons=selectedCards(state,selection);if(!selection.cardIds)return {state,requiresSelection:`Select up to ${action.amount} DON!! card${action.amount===1?'':'s'} to attach.`};if(dons.length>action.amount)return {state,error:'Too many DON!! cards selected.'};const legalDons=dons.every(card=>legalOwner(card,owner)&&card.type==='DON!!'&&(action.source==='attached'?Boolean(card.attachedTo)&&(!selection.sourceCardId||card.attachedTo===selection.sourceCardId):card.zone==='cost-area'&&(action.source==='opponent-cost-area'||!card.attachedTo)&&(action.source==='opponent-cost-area'||(action.rested?Boolean(card.rested):!card.rested))));if(!legalDons)return {state,error:'Selected DON!! do not match the printed source or rested state.'};return {state:{...state,cards:state.cards.map(card=>dons.some(don=>don.id===card.id)?{...card,zone:'cost-area',attachedTo:recipient.id}:card)}};}
  case 'attach-don-required':return {state:effect(state,action.kind,target?.id,action.amount)};
  case 'reveal-hand':{const found=targetResult('Choose a card from your opponent\'s hand to reveal.');if('result'in found)return found.result;const card=found.card;if(!legalOwner(card,opponent)||card.zone!=='hand')return {state,error:'Choose only cards from your opponent\'s hand.'};return {state:{...state,revealedCardIds:[...new Set([...(state.revealedCardIds??[]),card.id]) ]}};}
  case 'return-trash-to-deck-bottom':case 'recover':case 'hand-reset':case 'shuffle':case 'bottom-deck-hand':case 'hand-limit':case 'play-or-life':case 'activate-referenced-effect':case 'activate-main-effect':case 'blocker':case 'counter':case 'rush':case 'double-attack':case 'banish':case 'on-ko':case 'on-block':case 'attack-permission':case 'attack-restriction':case 'prevent-ready':case 'prevent-rest':case 'prevent-ko':case 'grant-keyword':case 'replacement':case 'custom-resolver':case 'effect-play-prohibition':case 'draw-by':return {state:effect(state,action.kind,target?.id,'amount'in action&&typeof action.amount==='number'?action.amount:undefined)};
  default:return {state,error:'Unhandled effect action.'};
 }
}

export function payEffectCost(state:MatchEffectState,actor:PlayerId,cost:EffectCost,selection:EffectSelection={}):EffectStepResult{
 if(cost.kind==='ko-character'&&cost.scope==='own-character'){
  if(!selection.cardIds)return {state,requiresSelection:`Choose ${cost.amount} of your ${cost.trait??''} Characters to K.O. as the cost.`};
  const cards=selectedCards(state,selection),payable=cardsFor(state,actor,'character').filter(card=>card.type==='Character'&&(!cost.trait||card.traits?.some(trait=>trait.toLowerCase()===cost.trait!.toLowerCase())));
  if(cards.length!==cost.amount||cards.some(card=>!payable.some(candidate=>candidate.id===card.id)))return {state,error:`Choose ${cost.amount} eligible Character${cost.amount===1?'':'s'} you control to K.O. as the cost.`};
  return {state:cards.reduce((next,card)=>move(next,card.id,'trash'),state)};
 }
 if(cost.kind==='bottom-deck-trash'){if(!selection.cardIds)return {state,requiresSelection:`Choose exactly ${cost.amount} cards${cost.trait?` with a type including ${cost.trait}`:''} from your Trash to return to the bottom of your deck in any order.`};const cards=selectedCards(state,selection);if(cards.length!==cost.amount||new Set(selection.cardIds).size!==cost.amount||cards.some(card=>card.owner!==actor||card.zone!=='trash'||(cost.trait&&!card.traits?.some(trait=>trait.toLowerCase().includes(cost.trait!.toLowerCase())))))return {state,error:`Choose exactly ${cost.amount} different cards${cost.trait?` with a type including ${cost.trait}`:''} from your Trash.`};return {state:moveToDeck(state,selection.cardIds,'bottom')};}
 if(cost.kind==='attach-don-character'){const recipient=selected(state,selection);if(!recipient)return {state,requiresSelection:`Choose one of your ${cost.name} Characters to receive the DON!!.`};if(!legalOwner(recipient,actor)||recipient.zone!=='character'||recipient.type!=='Character'||recipient.name?.toLowerCase()!==cost.name.toLowerCase())return {state,error:`Choose one of your ${cost.name} Characters to receive the DON!!.`};if(!selection.cardIds)return {state,requiresSelection:`Choose exactly ${cost.amount} active DON!! card${cost.amount===1?'':'s'} to attach.`};const ids=selection.cardIds,donors=ids.map(id=>state.cards.find(card=>card.id===id)),available=cardsFor(state,actor,'cost-area').filter(card=>card.type==='DON!!'&&!card.rested&&!card.attachedTo);if(ids.length!==cost.amount||new Set(ids).size!==cost.amount||donors.some(card=>!card||!available.some(candidate=>candidate.id===card.id)))return {state,error:`Choose exactly ${cost.amount} active DON!! card${cost.amount===1?'':'s'} you control.`};return {state:{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,attachedTo:recipient.id}:card)}};}
 if(cost.kind==='bottom-deck-stage'){if(!selection.cardIds)return {state,requiresSelection:`Choose ${cost.amount} Stage${cost.amount===1?'':'s'} to place at the bottom of your deck.`};const cards=selectedCards(state,selection);if(cards.length!==cost.amount||new Set(selection.cardIds).size!==cost.amount||cards.some(card=>card.owner!==actor||card.zone!=='stage'||card.type!=='Stage'||(cost.exactCost!==undefined&&card.cost!==cost.exactCost)))return {state,error:'Choose the required Stage card(s) you control with the printed cost.'};return {state:moveToDeck(state,selection.cardIds,'bottom')};}
 if(cost.kind==='bottom-deck-self'){const card=selection.sourceCardId?state.cards.find(item=>item.id===selection.sourceCardId):undefined;if(!card||card.owner!==actor||card.zone!=='character'||card.type!=='Character')return {state,error:'The source Character must be in play to pay this cost.'};return {state:moveToDeck(state,[card.id],'bottom')};}
 if(cost.kind==='return-character-hand'){if(!selection.cardIds)return {state,requiresSelection:`Choose ${cost.amount} Character${cost.amount===1?'':'s'} you control to return to your hand.`};const cards=selectedCards(state,selection),payable=cardsFor(state,actor,'character').filter(card=>card.type==='Character');if(cards.length!==cost.amount||new Set(selection.cardIds).size!==cost.amount||cards.some(card=>!payable.some(candidate=>candidate.id===card.id)))return {state,error:'Choose the required number of Characters you control to return to your hand.'};return {state:cards.reduce((next,card)=>move(next,card.id,'hand'),state)};}
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
  const payable=cardsFor(state,actor).filter(card=>['leader','character','stage'].includes(card.zone)&&!card.rested&&(!cost.trait||card.traits?.some(trait=>trait.toLowerCase()===cost.trait!.toLowerCase()))&&(!cost.cardType||card.type===cost.cardType));
  if(ids.some(id=>!payable.some(card=>card.id===id)))return {state,error:cost.trait?`Select active ${cost.trait} cards you control to pay this cost.`:'Select active Leader, Character, or Stage cards you control to pay this cost.'};
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
 const printedBlocker=!blocker.effectNegated&&(hasCardKeyword(blocker,'blocker',state)||/^\[Blocker\](?:\s*\([^)]*\))?(?:\s|\[|$)/i.test((blocker.effectText??blocker.effectSchema?.rawEffectText??'').trimStart()));
 if(!printedBlocker&&!blocker.temporaryKeywords?.includes('blocker'))return {state,winner:'none',error:'Selected Character does not have Blocker.'};
 if(state.turnEffects.some(effect=>effect.kind==='prevent-keyword-activation'&&effect.target===blockerId&&effect.detail==='blocker'&&['battle','turn-end','opponent-next-turn'].includes(effect.expires??'')))return {state,winner:'none',error:'This Blocker cannot activate during this battle.'};
 if(state.turnEffects.some(effect=>effect.kind==='prevent-keyword-activation'&&!effect.target&&effect.owner!==defender&&effect.detail==='blocker'&&['battle','turn-end','opponent-next-turn'].includes(effect.expires??'')))return {state,winner:'none',error:'The attacking effect prevents Blocker activation this turn.'};
 const blocked=state.turnEffects.some(effect=>effect.kind==='prevent-keyword-activation'&&effect.detail==='blocker'&&['battle','turn-end','opponent-next-turn'].includes(effect.expires??'')&&effect.target===blocker.id);
 if(blocked)return {state,winner:'none',error:'This Blocker cannot activate during this battle.'};
 const nextState=update(state,blockerId,{rested:true}),attacker=other(defender);
 for(const source of nextState.cards){
  if(source.owner!==attacker||source.effectNegated||!['leader','character','stage'].includes(source.zone))continue;
  const wins=source.effectSchema?.ast.some(ability=>ability.trigger==='opponent-blocker'&&ability.actions.some(action=>action.kind==='win-game'&&action.when==='opponent-blocker'&&action.ifEitherPlayerHasNoLife)&&ability.conditions.every(condition=>evaluateEffectCondition(condition.text,nextState,source.owner,source.id)===true));
  if(wins)return {state:nextState,winner:'none',gameOver:source.owner};
 }
 return {state:nextState,winner:'none'};
}

export function effectiveCardPower(state:MatchEffectState,cardId:string):number{
 const card=state.cards.find(item=>item.id===cardId);
 if(!card||!['leader','character'].includes(card.zone))return 0;
 const donPower=state.turn===card.owner?state.cards.filter(don=>don.type==='DON!!'&&don.owner===card.owner&&don.zone==='cost-area'&&don.attachedTo===cardId).reduce((sum,don)=>{
  const amount=don.effectSchema?don.effectSchema.ast.flatMap(ability=>ability.actions).find(action=>action.kind==='don-power')?.amount??0:1000;
  return sum+amount;
 },0):0;
 const passivePower=state.cards.filter(source=>source.owner===card.owner&&!source.effectNegated&&['leader','character','stage'].includes(source.zone)).reduce((total,source)=>total+(source.effectSchema?.ast.filter(ability=>{const requiredDon=ability.actions.find(action=>action.kind==='attach-don-required')?.amount??0;return (ability.trigger==='continuous'||ability.actions.some(action=>action.kind==='power'&&action.continuous))&&ability.conditions.every(condition=>evaluateEffectCondition(condition.text,state,source.owner,source.id)===true)&&(!requiredDon||state.cards.filter(don=>don.owner===source.owner&&don.type==='DON!!'&&don.attachedTo===source.id).length>=requiredDon);}).flatMap(ability=>ability.actions).filter((action):action is Extract<EffectAction,{kind:'power'}>=>action.kind==='power').reduce((sum,action)=>{
  const opponentTarget=action.target.startsWith('opponent'),expectedOwner=opponentTarget?other(source.owner):source.owner;
  const validZone=action.target==='own-card'||action.target==='opponent-card'?['leader','character'].includes(card.zone):action.target==='own-character-or-named-leader'?card.zone==='character'||card.zone==='leader'&&Boolean(action.name&&matchesCardName(card,action.name)):action.target.endsWith('leader')?card.zone==='leader':card.zone==='character';
  const cost=Math.max(0,(card.cost??Infinity)+(card.costModifier??0));
  if(card.owner!==expectedOwner||!validZone||(action.trait&&!card.traits?.some(trait=>trait.toLowerCase()===action.trait!.toLowerCase()))||(action.name&&!matchesCardName(card,action.name))||(action.color&&!card.color?.split(/[\s/]+/).some(color=>color.toLowerCase()===action.color!.toLowerCase()))||(action.exactCost!==undefined&&cost!==action.exactCost)||(action.minCost!==undefined&&cost<action.minCost)||(action.maxCost!==undefined&&cost>action.maxCost))return sum;
  const bonus=action.bonus?evaluateEffectCondition(action.bonus.condition,state,source.owner,source.id):false;
  if(bonus===undefined)return sum;
  const scaled=action.scale?Math.floor(cardsFor(state,source.owner,'trash').filter(item=>!action.scale?.cardType||item.type===action.scale.cardType).length/action.scale.every):0;
  return sum+(action.scale?scaled*Math.abs(action.amount):action.amount)+(bonus?(action.bonus?.amount??0):0);
 },0)??0),0);
 return Math.max(0,(card.power??0)+(card.powerModifier??0)+donPower+passivePower);
}

/** Resolves a battle after Block and Counter choices. Equal power defeats a Character or damages a Leader. */
export function resolveBattle(state:MatchEffectState,attackerId:string,defenderId:string,attackingPower=effectiveCardPower(state,attackerId),defendingPower=effectiveCardPower(state,defenderId),replacementChoice?:{choice:'accept'|'decline';cardId?:string;cardIds?:string[]}):BattleResolution{
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
 const finishCharacterBattle=(board:MatchEffectState):MatchEffectState=>{
  const source=board.cards.find(card=>card.id===attacker.id);if(!source||source.effectNegated||source.owner!==board.turn)return board;
  const leaderBattleEffect=source.zone==='leader'&&defender.zone==='character'?board.turnEffects.find(item=>item.kind==='leader-battle-ready'&&item.target===source.id):undefined;
  if(leaderBattleEffect){const readied=update(board,source.id,{rested:false});return effect(readied,'leader-battle-attack-lock',source.id,leaderBattleEffect.amount,undefined,'turn-end',source.owner);}
  if(source.zone!=='character')return board;
  const ability=source.effectSchema?.ast.find(item=>item.trigger==='end-battle'&&item.conditions.some(condition=>/this Character battles your opponent's Character/i.test(condition.text)));
  const ready=ability?.actions.find((action):action is Extract<EffectAction,{kind:'ready'}>=>action.kind==='ready'&&action.scope==='self');if(!ready)return board;
  const required=ability!.actions.reduce((count,action)=>action.kind==='attach-don-required'?Math.max(count,action.amount):count,0),attached=board.cards.filter(card=>card.owner===source.owner&&card.type==='DON!!'&&card.attachedTo===source.id).length;
  if(attached<required||ready.oncePerTurn&&board.turnEffects.some(item=>item.kind==='end-battle-ready-used'&&item.target===source.id))return board;
  const next=update(board,source.id,{rested:false});return ready.oncePerTurn?effect(next,'end-battle-ready-used',source.id,undefined,undefined,'turn-end'):next;
 };
 if(attackingPower<defendingPower)return {state:finishCharacterBattle(state),winner:'defender'};
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
 if(protectedFromBattle)return {state:finishCharacterBattle(state),winner:'attacker'};
 const replacement=defender.effectNegated?undefined:defender.effectSchema?.ast.flatMap(ability=>ability.actions).find((action):action is Extract<EffectAction,{kind:'replacement'}>=>action.kind==='replacement'&&action.event==='ko'&&(!action.oncePerTurn||!state.turnEffects.some(item=>item.kind==='replacement-used'&&item.target===defender.id)));
 if(replacement){
  const count=replacement.cost.amount??1;
  const paymentTargets=replacement.cost.kind==='rest-leader-or-stage'?state.cards.filter(card=>card.owner===defender.owner&&!card.rested&&(card.zone==='leader'||card.zone==='stage'&&card.name===replacement.cost.stageName)):replacement.cost.kind==='bottom-deck-trash'?cardsFor(state,defender.owner,'trash'):replacement.cost.kind==='trash-life'?(()=>{const life=cardsFor(state,defender.owner,'life');return Array.from(new Set([life[0],life[life.length-1]].filter((card):card is MatchCard=>Boolean(card))))})():replacement.cost.kind==='trash-hand-character'?cardsFor(state,defender.owner,'hand').filter(card=>card.type==='Character'&&(card.power??0)>=(replacement.cost.minPower??0)):replacement.cost.kind==='rest-card'?cardsFor(state,defender.owner).filter(card=>['leader','character','stage','cost-area'].includes(card.zone)&&!card.rested):replacement.cost.kind==='rest-don'?cardsFor(state,defender.owner,'cost-area').filter(card=>card.type==='DON!!'&&!card.rested):[];
  if(paymentTargets.length>=count){
   if(!replacementChoice)return {state,winner:'attacker',requiresSelection:replacement.cost.kind==='rest-leader-or-stage'?`You may rest your Leader or ${replacement.cost.stageName} instead of this K.O.`:`You may pay ${count} card${count===1?'':'s'} for this K.O. replacement.`};
   if(replacementChoice.choice==='accept'){
    const ids=replacementChoice.cardIds??(replacementChoice.cardId?[replacementChoice.cardId]:[]);
    if(ids.length!==count||new Set(ids).size!==count||ids.some(id=>!paymentTargets.some(card=>card.id===id)))return {state,winner:'none',error:'Choose the exact legal replacement payment.'};
    const paid=replacement.cost.kind==='bottom-deck-trash'?moveToDeck(state,ids,'bottom'):{...state,cards:state.cards.map(card=>ids.includes(card.id)?{...card,...(replacement.cost.kind==='trash-hand-character'||replacement.cost.kind==='trash-life'?{zone:'trash' as const,rested:false}:{rested:true})}:card)};
    const replaced=replacement.oncePerTurn?effect(paid,'replacement-used',defender.id,undefined,'ko','turn-end'):paid;return {state:finishCharacterBattle(replaced),winner:'attacker',replacementResolved:true};
   }
  }
 }
 return {state:finishCharacterBattle(move(state,defender.id,'trash')),winner:'attacker',defeatedCharacterId:defender.id};
}
