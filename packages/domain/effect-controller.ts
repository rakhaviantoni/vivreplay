import {evaluateEffectCondition} from './effect-conditions';
import type {EffectAction, EffectCost, EffectTrigger} from './effect-rules';
import {applyEffectAction, payEffectCost, type EffectSelection, type MatchEffectState, type PlayerId} from './match-effect-state';
import type {EffectCommand} from './effect-runtime';

export type EffectExecution={
 actor:PlayerId;
 sourceId:string;
 timing:EffectTrigger;
 commands:EffectCommand[];
 conditionResults?:Record<string,boolean>;
 commandIndex:number;
 state:MatchEffectState;
};

export type EffectExecutionResult={
 execution:EffectExecution;
 complete:boolean;
 requiresSelection?:string;
 error?:string;
};

/** Starts an ordered card effect without guessing any player-owned selection. */
export function beginEffectExecution(state:MatchEffectState,actor:PlayerId,sourceId:string,timing:EffectTrigger,commands:EffectCommand[]):EffectExecutionResult{
 return advanceEffectExecution({actor,sourceId,timing,commands,commandIndex:0,state});
}

/** Applies exactly one optional selection and advances through every deterministic command that follows it. */
export function advanceEffectExecution(execution:EffectExecution,selection:EffectSelection={}):EffectExecutionResult{
 let state=execution.state;
 let index=execution.commandIndex;
 let usedSelection=false;
 const conditionResults={...execution.conditionResults};
 while(index<execution.commands.length){
  const command=execution.commands[index];
  const checks=(command.conditions??[]).map(text=>{const key=`${command.abilityId??0}:${text}`;if(key in conditionResults)return conditionResults[key];const result=evaluateEffectCondition(text,state,execution.actor);if(result!==undefined)conditionResults[key]=result;return result;});
  if(checks.includes(undefined))return {execution:{...execution,state,conditionResults,commandIndex:index},complete:false,error:'This effect has an unsupported condition.'};
  if(checks.includes(false)){index++;continue;}
  if(!usedSelection&&selection.choice==='decline'&&command.kind==='pay-cost'&&(command.value as EffectCost).optional){
   const ability=command.abilityId;
   if(ability===undefined)return {execution:{...execution,state,conditionResults,commandIndex:execution.commands.length},complete:true};
   while(index<execution.commands.length&&execution.commands[index].abilityId===ability)index++;
   usedSelection=true;
   continue;
  }
  const input=usedSelection?{}:selection;
  const value=command.value as EffectAction|EffectCost;
  const sourceBound=(command.kind==='pay-cost'&&(value.kind==='rest'||value.kind==='trash')&&value.scope==='self')
   ||(command.kind==='resolve-action'&&((value.kind==='rest'&&value.scope==='self')||(value.kind==='trash'&&value.scope==='self')||(value.kind==='ready'&&value.scope==='self')));
  const resolvedInput=sourceBound?{...input,targetId:execution.sourceId}:input;
  const result=command.kind==='pay-cost'
   ?payEffectCost(state,execution.actor,command.value as EffectCost,resolvedInput)
   :applyEffectAction(state,execution.actor,command.value as EffectAction,resolvedInput);
  if(result.error||result.requiresSelection){
   return {execution:{...execution,state:result.state,conditionResults,commandIndex:index},complete:false,requiresSelection:result.requiresSelection,error:result.error};
  }
  state=result.state;
  index++;
  usedSelection=true;
 }
 return {execution:{...execution,state,conditionResults,commandIndex:index},complete:true};
}
