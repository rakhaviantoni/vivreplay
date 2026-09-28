import {evaluateEffectCondition} from './effect-conditions';
import type {EffectAction,EffectCost,EffectDocument,EffectTrigger} from './effect-rules';
import {resolveCustomEffect,type CustomInstruction} from './custom-effect-resolvers';
import {applyEffectAction,payEffectCost,type EffectSelection,type MatchEffectState,type PlayerId} from './match-effect-state';

export type EffectCommand={abilityId?:number;conditions?:string[];kind:'pay-cost'|'resolve-action';value:EffectCost|EffectAction};
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
  return resolved.status==='ready'?{status:'ready',commands:[],instructions:resolved.instructions,handler}:{status:'custom',commands:[],handler};
 }
 const commands:EffectCommand[]=[];
 let nextAbilityId=0;
 for(const effect of windows){
  const abilityId=nextAbilityId++,conditions=effect.conditions.map(condition=>condition.text);
  for(const step of effect.sequence){
   if(step.type==='PAY_COST'){commands.push({abilityId,conditions,kind:'pay-cost',value:step.cost});continue;}
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
   }else commands.push({abilityId,conditions,kind:'resolve-action',value:action});
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

/** Executes a normalized generic-effect sequence in printed order. A caller supplies one selection per command. */
export function executeEffectCommands(
 state:MatchEffectState,
 actor:PlayerId,
 commands:EffectCommand[],
 selections:EffectSelection[]=[]
):RuntimeExecution{
 let current=state;
 const conditionResults=new Map<string,boolean>();
 for(let index=0;index<commands.length;index++){
  const command=commands[index];
  const checks=(command.conditions??[]).map(text=>{const key=`${command.abilityId??0}:${text}`;if(conditionResults.has(key))return conditionResults.get(key);const result=evaluateEffectCondition(text,current,actor);if(result!==undefined)conditionResults.set(key,result);return result;});
  if(checks.includes(undefined))return {state:current,nextCommand:index,error:'This effect has an unsupported condition.'};
  if(checks.includes(false))continue;
  const selection=selections[index]??{};
  const result=command.kind==='pay-cost'
   ? payEffectCost(current,actor,command.value as EffectCost,selection)
   : applyEffectAction(current,actor,command.value as EffectAction,selection);
  if(result.error||result.requiresSelection)return {state:result.state,nextCommand:index,requiresSelection:result.requiresSelection,error:result.error};
  current=result.state;
 }
 return {state:current};
}
