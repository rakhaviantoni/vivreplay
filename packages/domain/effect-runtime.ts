import {evaluateEffectCondition} from './effect-conditions';
import type {EffectAction,EffectCost,EffectDocument,EffectTrigger} from './effect-rules';
import {resolveCustomEffect,type CustomInstruction} from './custom-effect-resolvers';
import {applyEffectAction,payEffectCost,type EffectSelection,type MatchEffectState,type PlayerId} from './match-effect-state';

export type EffectCommand={abilityId?:number;conditions?:string[];requiredAttachedDon?:number;kind:'pay-cost'|'resolve-action';value:EffectCost|EffectAction};
export type RuntimeResolution={status:'ready'|'custom';commands:EffectCommand[];instructions?:CustomInstruction[];handler?:string};
export type CardEffectResolution=RuntimeResolution&{actions:EffectAction[];costs:EffectCost[]};

/** Converts a timing window into its ordered, executable resolution contract. */
export function resolveEffectTiming(document:EffectDocument,timing:EffectTrigger,visited:EffectTrigger[]=[]):RuntimeResolution{
 if(visited.includes(timing))return {status:'custom',commands:[],handler:'CYCLIC_EFFECT_REFERENCE'};
 const windows=document.normalized.filter(effect=>effect.timing===timing);
 const custom=windows.flatMap(effect=>effect.sequence).find(step=>step.type==='RESOLVE'&&step.action.kind==='custom-resolver');
 if(custom?.type==='RESOLVE'&&custom.action.kind==='custom-resolver'){
  const handler=custom.action.handler;
  const resolved=resolveCustomEffect(handler);
  // Instruction plans are descriptive metadata until a board adapter executes
  // each step. Returning `ready` here allowed callers to treat an empty command
  // list as a successful effect and silently skip the printed resolution.
  return resolved.status==='ready'?{status:'custom',commands:[],instructions:resolved.instructions,handler}:{status:'custom',commands:[],handler};
 }
 const commands:EffectCommand[]=[];
 let nextAbilityId=0;
 for(const [windowIndex,effect] of windows.entries()){
  const abilityId=nextAbilityId++,conditions=effect.conditions.map(condition=>condition.text);
  const ability=document.ast.filter(candidate=>candidate.trigger===timing)[windowIndex];
  const requiredAttachedDon=ability?.actions.reduce((maximum,action)=>action.kind==='attach-don-required'?Math.max(maximum,action.amount):maximum,0)??0;
  const rawText=ability?.rawText??'',conditionIndex=conditions.length?rawText.toLowerCase().indexOf(conditions[0].toLowerCase()):-1,costIndex=rawText.search(/\b(?:you may\s+)?(?:trash|rest|return|turn|give)\b/i);
  // Text after a printed cost divider is the effect being paid for. Resolve
  // the cost first, then evaluate those conditions against the post-cost state.
  const conditionAfterCost=Boolean(ability?.costs.length&&conditionIndex>=0&&costIndex>=0&&costIndex<conditionIndex);
  const donFieldPrerequisites=conditions.filter(condition=>/^you have \d+ or more DON!! cards on your field$/i.test(condition));
  const orderedConditions=[...donFieldPrerequisites,...conditions.filter(condition=>!donFieldPrerequisites.includes(condition))];
  for(const step of effect.sequence){
   if(step.type==='PAY_COST'){commands.push({abilityId,conditions:conditionAfterCost?donFieldPrerequisites:orderedConditions,requiredAttachedDon,kind:'pay-cost',value:step.cost});continue;}
   const action=step.action;
   if(action.kind==='activate-main-effect'||action.kind==='activate-referenced-effect'){
    // Older stored schemas emitted both Main aliases for one printed reference.
    if(action.kind==='activate-main-effect'&&effect.sequence.some(s=>s.type==='RESOLVE'&&s.action.kind==='activate-referenced-effect'&&s.action.trigger==='main'))continue;
    const reference=action.kind==='activate-main-effect'?'main':action.trigger;
    if(!document.normalized.some(e=>e.timing===reference))return {status:'custom',commands:[],handler:'MISSING_EFFECT_REFERENCE'};
    const nested=resolveEffectTiming(document,reference,[...visited,timing]);
    if(nested.status!=='ready'||nested.instructions)return {status:'custom',commands:[],handler:nested.handler};
    const ids=new Map<number,number>();
    for(const command of nested.commands){
     const nestedId=command.abilityId??0;
     if(!ids.has(nestedId))ids.set(nestedId,nextAbilityId++);
     commands.push({...command,abilityId:ids.get(nestedId),conditions:[...conditions,...command.conditions??[]]});
    }
   }else commands.push({abilityId,conditions:[...orderedConditions,...('condition'in action&&action.condition?[action.condition]:[])],requiredAttachedDon,kind:'resolve-action',value:action});
  }
 }
 return {status:'ready',commands};
}

/** Single entry point for consumers: costs remain ordered before actions and custom plans stay intact. */
export function resolveCardEffect(document:EffectDocument,timing:EffectTrigger):CardEffectResolution{
 const resolution=resolveEffectTiming(document,timing);
 return {...resolution,actions:resolution.commands.flatMap(command=>command.kind==='resolve-action'?[command.value as EffectAction]:[]),costs:resolution.commands.flatMap(command=>command.kind==='pay-cost'?[command.value as EffectCost]:[])};
}

export type RuntimeExecution={state:MatchEffectState;nextCommand?:number;requiresSelection?:string;error?:string};

export function unavailableSequentialCostAbilityIds(state:MatchEffectState,actor:PlayerId,commands:EffectCommand[]):number[]{
 const ids=new Set<number>();
 for(const abilityId of new Set(commands.filter(command=>command.kind==='resolve-action'&&'requiresPreviousAction'in command.value&&command.value.requiresPreviousAction).map(command=>command.abilityId).filter((id):id is number=>id!==undefined))){
  const costs=commands.filter(command=>command.abilityId===abilityId&&command.kind==='pay-cost').map(command=>command.value as EffectCost);
  const handTrash=costs.find((cost):cost is Extract<EffectCost,{kind:'trash'}>=>cost.kind==='trash'&&cost.scope==='hand');
  const restedDon=costs.find((cost):cost is Extract<EffectCost,{kind:'rest'}>=>cost.kind==='rest'&&cost.scope==='don');
  const hand=state.cards.filter(card=>card.owner===actor&&card.zone==='hand'&&(!handTrash?.cardType||card.type===handTrash.cardType)&&(!handTrash?.trait||card.traits?.some(trait=>trait.toLowerCase().includes(handTrash.trait!.toLowerCase())))&&(!handTrash?.color||card.color?.toLowerCase().includes(handTrash.color.toLowerCase())));
  const don=state.cards.filter(card=>card.owner===actor&&card.type==='DON!!'&&card.zone==='cost-area'&&!card.rested&&!card.attachedTo);
  if(handTrash&&hand.length<handTrash.amount||restedDon&&don.length<restedDon.amount)ids.add(abilityId);
 }
 return [...ids];
}

/** Executes a normalized generic-effect sequence in printed order. A caller supplies one selection per command. */
export function executeEffectCommands(
 state:MatchEffectState,
 actor:PlayerId,
 commands:EffectCommand[],
 selections:EffectSelection[]=[],
 sourceCardId?:string
):RuntimeExecution{
 let current=state;
 let lastPlayedCardId:string|undefined;
 let lastTargetCardId:string|undefined;
 let lastDrawCount=0;
 let lastActionSucceeded=false;
 const attachedDon=sourceCardId?state.cards.filter(card=>card.owner===actor&&card.type==='DON!!'&&card.attachedTo===sourceCardId).length:0;
 const disabledAbilityIds=new Set([...commands.filter(command=>(command.requiredAttachedDon??0)>attachedDon).map(command=>command.abilityId).filter((id):id is number=>id!==undefined),...unavailableSequentialCostAbilityIds(state,actor,commands)]);
 const conditionResults=new Map<string,boolean>();
 for(let index=0;index<commands.length;index++){
  const command=commands[index];
  if(command.abilityId!==undefined&&disabledAbilityIds.has(command.abilityId))continue;
  if(command.kind==='resolve-action'&&'requiresPreviousAction'in command.value&&command.value.requiresPreviousAction&&!lastActionSucceeded)continue;
  if(command.kind==='resolve-action'&&command.value.kind==='grant-keyword'&&((command.value.scope==='previous-played'&&!lastPlayedCardId)||(command.value.scope==='previous-target'&&!lastTargetCardId))){continue;}
  const checks=(command.conditions??[]).map(text=>{const key=`${command.abilityId??0}:${text}`;if(conditionResults.has(key))return conditionResults.get(key);const result=evaluateEffectCondition(text,current,actor,sourceCardId);if(result!==undefined)conditionResults.set(key,result);return result;});
  if(checks.includes(false)){lastActionSucceeded=false;continue;}
  if(checks.includes(undefined))return {state:current,nextCommand:index,error:'This effect has an unsupported condition.'};
  const selfBound=command.kind==='resolve-action'&&(command.value.kind==='negate-source-effect'||(command.value.kind==='grant-keyword'&&command.value.scope==='self')||(command.value.kind==='copy-base-power'&&command.value.target==='own-character')||(command.value.kind==='bottom-deck'&&command.value.scope==='self'));
  const previousTargetId=command.kind==='resolve-action'&&command.value.kind==='grant-keyword'?(command.value.scope==='previous-played'?lastPlayedCardId:command.value.scope==='previous-target'?lastTargetCardId:undefined):undefined;
  const selection={...(selections[index]??{}),...(sourceCardId?{sourceCardId,...(selfBound?{targetId:sourceCardId}:{})}:{}) ,...(previousTargetId?{targetId:previousTargetId}: {})};
  const actionValue=command.kind==='resolve-action'&&command.value.kind==='trash'&&command.value.scope==='hand'&&'amountFromPreviousDraw'in command.value&&command.value.amountFromPreviousDraw?{...command.value,amount:lastDrawCount}:command.value;
  const beforeHandCount=current.cards.filter(card=>card.owner===actor&&card.zone==='hand').length;
  const previousCards=JSON.stringify(current.cards);
  const result=command.kind==='pay-cost'
   ? payEffectCost(current,actor,command.value as EffectCost,selection)
   : applyEffectAction(current,actor,actionValue as EffectAction,selection);
  if(result.error||result.requiresSelection)return {state:result.state,nextCommand:index,requiresSelection:result.requiresSelection,error:result.error};
  current=result.state;
  lastActionSucceeded=JSON.stringify(current.cards)!==previousCards;
  if(command.kind==='resolve-action'&&(command.value.kind==='draw'||command.value.kind==='draw-by'))lastDrawCount=Math.max(0,current.cards.filter(card=>card.owner===actor&&card.zone==='hand').length-beforeHandCount);
  if(command.kind==='resolve-action'&&['play','ready'].includes((command.value as EffectAction).kind)){
   const input=selections[index],id=input?.cardIds?.length===1?input.cardIds[0]:input?.targetId;
   const playOwner=command.kind==='resolve-action'&&command.value.kind==='play'&&command.value.owner==='opponent'?(actor==='player'?'opponent':'player'):actor;
   const valid=id&&current.cards.some(card=>card.id===id&&card.zone==='character'&&card.owner===(command.kind==='resolve-action'&&command.value.kind==='play'?playOwner:actor))?id:undefined;
   if((command.value as EffectAction).kind==='play')lastPlayedCardId=valid;
   lastTargetCardId=valid;
  }
 }
 return {state:current};
}
