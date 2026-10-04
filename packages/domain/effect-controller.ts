import {evaluateEffectCondition} from './effect-conditions';
import type {EffectAction, EffectCost, EffectTrigger} from './effect-rules';
import {applyEffectAction, payEffectCost, type EffectSelection, type MatchEffectState, type PlayerId} from './match-effect-state';
import type {EffectCommand} from './effect-runtime';

export type EffectExecution={
 actor:PlayerId;
 sourceId:string;
 timing:EffectTrigger;
 commands:EffectCommand[];
 disabledAbilityIds?:number[];
 conditionResults?:Record<string,boolean>;
	commandIndex:number;
	state:MatchEffectState;
	pendingSelection?:EffectSelection;
	lastPlayedCardId?:string;
	lastTargetCardId?:string;
	lastHandTrashCount?:number;
};

export type EffectExecutionResult={
 execution:EffectExecution;
 complete:boolean;
 requiresSelection?:string;
 error?:string;
};

/** Starts an ordered card effect without guessing any player-owned selection. */
export function beginEffectExecution(state:MatchEffectState,actor:PlayerId,sourceId:string,timing:EffectTrigger,commands:EffectCommand[]):EffectExecutionResult{
 const attachedDon=state.cards.filter(card=>card.owner===actor&&card.type==='DON!!'&&card.attachedTo===sourceId).length;
 const disabledAbilityIds=[...new Set(commands.filter(command=>(command.requiredAttachedDon??0)>attachedDon).map(command=>command.abilityId).filter((id):id is number=>id!==undefined))];
 const execution={actor,sourceId,timing,commands,disabledAbilityIds,commandIndex:0,state};
 return advanceEffectExecution(execution);
}

/** Applies exactly one optional selection and advances through every deterministic command that follows it. */
export function advanceEffectExecution(execution:EffectExecution,selection:EffectSelection={}):EffectExecutionResult{
 let state=execution.state;
 let index=execution.commandIndex;
 let usedSelection=false;
 const conditionResults={...execution.conditionResults};
 while(index<execution.commands.length){
  const command=execution.commands[index];
  if(command.abilityId!==undefined&&execution.disabledAbilityIds?.includes(command.abilityId)){index++;continue;}
  const checks=(command.conditions??[]).map(text=>{const key=`${command.abilityId??0}:${text}`;if(key in conditionResults)return conditionResults[key];const result=evaluateEffectCondition(text,state,execution.actor,execution.sourceId);if(result!==undefined)conditionResults[key]=result;return result;});
  if(checks.includes(undefined))return {execution:{...execution,state,conditionResults,commandIndex:index},complete:false,error:'This effect has an unsupported condition.'};
  if(checks.includes(false)){index++;continue;}
  if(!usedSelection&&selection.choice==='decline'&&command.kind==='pay-cost'&&(command.value as EffectCost).optional){
   const ability=command.abilityId;
   if(ability===undefined)return {execution:{...execution,state,conditionResults,commandIndex:execution.commands.length},complete:true};
   while(index<execution.commands.length&&execution.commands[index].abilityId===ability)index++;
   usedSelection=true;
   continue;
  }
  const cost=command.kind==='pay-cost'?command.value as EffectCost:undefined;
  const deterministicOptionalCost=cost?.kind==='turn-life'||cost?.kind==='bottom-deck-self'||cost?.kind==='rest'&&cost.scope==='self'||cost?.kind==='trash'&&cost.scope==='self';
  if(!usedSelection&&deterministicOptionalCost&&cost?.optional&&!selection.choice&&!selection.cardIds?.length&&!selection.targetId&&!selection.position&&!selection.deckOrder?.length&&!selection.replacementIds?.length){
   return {execution:{...execution,state,conditionResults,commandIndex:index,pendingSelection:{...execution.pendingSelection,...selection}},complete:false,requiresSelection:'Pay this optional cost, or decline the effect.'};
  }
  const input=usedSelection?{}:{...execution.pendingSelection,...selection};
  const value=command.value as EffectAction|EffectCost;
  if(command.kind==='resolve-action'&&value.kind==='grant-keyword'&&((value.scope==='previous-played'&&!execution.lastPlayedCardId)||(value.scope==='previous-target'&&!execution.lastTargetCardId))){index++;continue;}
  const sourceBound=(command.kind==='pay-cost'&&((value.kind==='rest'||value.kind==='trash')&&value.scope==='self'||value.kind==='bottom-deck-self'))
  ||(command.kind==='resolve-action'&&(value.kind==='return-source-to-hand'||(value.kind==='copy-base-power'&&value.target==='own-character')||(value.kind==='rest'&&value.scope==='self')||(value.kind==='trash'&&value.scope==='self')||(value.kind==='ready'&&value.scope==='self')||(value.kind==='attach-don'&&value.recipient==='self')||(value.kind==='attack-permission'&&value.scope==='own-character')||(value.kind==='skip-next-refresh'&&value.scope==='self')||(value.kind==='grant-keyword'&&value.scope==='self')));
  const previousTargetId=command.kind==='resolve-action'&&value.kind==='grant-keyword'?(value.scope==='previous-played'?execution.lastPlayedCardId:value.scope==='previous-target'?execution.lastTargetCardId:undefined):undefined;
  const previousTargetBound=Boolean(previousTargetId);
  const resolvedInput=sourceBound?{...input,targetId:execution.sourceId,sourceCardId:execution.sourceId}:previousTargetBound?{...input,targetId:previousTargetId,sourceCardId:execution.sourceId}:{...input,sourceCardId:execution.sourceId};
  const resolvedAction=command.kind==='resolve-action'&&value.kind==='trash'&&value.scope==='deck'&&value.amountFromPreviousHandTrash?{...value,amount:execution.lastHandTrashCount??0}:value;
  const result=command.kind==='pay-cost'
   ?payEffectCost(state,execution.actor,command.value as EffectCost,resolvedInput)
   :applyEffectAction(state,execution.actor,resolvedAction as EffectAction,resolvedInput);
  if(result.error||result.requiresSelection){
   return {execution:{...execution,state:result.state,conditionResults,commandIndex:index,pendingSelection:input},complete:false,requiresSelection:result.requiresSelection,error:result.error};
  }
  state=result.state;
  const selectedTarget=command.kind==='resolve-action'&&(value.kind==='play'||value.kind==='ready')?(input.cardIds?.length===1?input.cardIds[0]:input.targetId):undefined;
  const validTarget=selectedTarget?state.cards.find(card=>card.id===selectedTarget&&card.owner===execution.actor&&card.zone==='character')?.id:undefined;
  execution={...execution,lastPlayedCardId:command.kind==='resolve-action'&&value.kind==='play'?validTarget:execution.lastPlayedCardId,lastTargetCardId:command.kind==='resolve-action'&&(value.kind==='play'||value.kind==='ready')?validTarget:execution.lastTargetCardId,lastHandTrashCount:command.kind==='resolve-action'&&value.kind==='trash'&&value.scope==='hand'&&'upTo'in value&&value.upTo?(input.cardIds?.length??0):execution.lastHandTrashCount,pendingSelection:undefined};
  index++;
  usedSelection=true;
 }
 return {execution:{...execution,state,conditionResults,commandIndex:index},complete:true};
}
