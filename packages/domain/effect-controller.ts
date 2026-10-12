import {evaluateEffectCondition} from './effect-conditions';
import type {EffectAction, EffectCost, EffectTrigger} from './effect-rules';
import {applyEffectAction, isCardEffectNegated, isTimingNegated, payEffectCost, type EffectSelection, type MatchEffectState, type PlayerId} from './match-effect-state';
import {resolveEffectTiming,unavailableSequentialCostAbilityIds,type EffectCommand} from './effect-runtime';

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
	lastDrawCount?:number;
	lastActionSucceeded?:boolean;
	battleOpponentId?:string;
};

export type EffectExecutionResult={
 execution:EffectExecution;
 complete:boolean;
 requiresSelection?:string;
 error?:string;
};

/** Starts an ordered card effect without guessing any player-owned selection. */
export function beginEffectExecution(state:MatchEffectState,actor:PlayerId,sourceId:string,timing:EffectTrigger,commands:EffectCommand[]):EffectExecutionResult{
 const source=state.cards.find(card=>card.id===sourceId);
 if(source&&isCardEffectNegated(state,source))return {execution:{actor,sourceId,timing,commands,commandIndex:commands.length,state},complete:true};
 if(isTimingNegated(state,actor,timing))return {execution:{actor,sourceId,timing,commands,commandIndex:commands.length,state},complete:true};
 const attachedDon=state.cards.filter(card=>card.owner===actor&&card.type==='DON!!'&&card.attachedTo===sourceId).length;
 const disabledAbilityIds=[...new Set([...commands.filter(command=>(command.requiredAttachedDon??0)>attachedDon).map(command=>command.abilityId).filter((id):id is number=>id!==undefined),...unavailableSequentialCostAbilityIds(state,actor,commands)])];
 const execution={actor,sourceId,timing,commands,disabledAbilityIds,commandIndex:0,state};
 const limited=commands.find(command=>{if(command.kind!=='resolve-action')return false;const value=command.value;return 'oncePerTurn'in value&&value.oncePerTurn&&'activationKey'in value&&Boolean(value.activationKey);});
 if(limited?.kind==='resolve-action'&&'oncePerTurn'in limited.value&&limited.value.oncePerTurn&&'activationKey'in limited.value){const activationKey=limited.value.activationKey;if(state.turnEffects.some(item=>item.kind==='activation-used'&&item.target===sourceId&&item.detail===activationKey))return {execution,complete:false,error:'This ability has already been used this turn.'};}
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
  const commandSourceId=command.sourceId??execution.sourceId;
  const promptSelection=usedSelection?{}:{...execution.pendingSelection,...selection};
  if(command.abilityId!==undefined&&execution.disabledAbilityIds?.includes(command.abilityId)){index++;continue;}
  if(command.kind==='resolve-action'&&'requiresPreviousAction'in command.value&&command.value.requiresPreviousAction&&!execution.lastActionSucceeded){index++;continue;}
  const checks=(command.conditions??[]).map(text=>{const key=`${command.abilityId??0}:${commandSourceId}:${text}`;if(key in conditionResults)return conditionResults[key];const result=evaluateEffectCondition(text,state,execution.actor,commandSourceId);if(result!==undefined)conditionResults[key]=result;return result;});
  if(checks.includes(undefined))return {execution:{...execution,state,conditionResults,commandIndex:index},complete:false,error:'This effect has an unsupported condition.'};
  if(checks.includes(false)){execution={...execution,lastActionSucceeded:false};index++;continue;}
  if(command.kind==='resolve-action'&&'condition'in command.value&&command.value.condition){const result=evaluateEffectCondition(command.value.condition,state,execution.actor,commandSourceId);if(result===undefined)return {execution:{...execution,state,conditionResults,commandIndex:index},complete:false,error:'This effect has an unsupported action condition.'};if(!result){index++;continue;}}
  if(command.kind==='resolve-action'&&command.value.kind==='activate-trash-event-main'){
   const action=command.value,ids=promptSelection.cardIds;
   if(!ids)return {execution:{...execution,state,conditionResults,commandIndex:index,pendingSelection:execution.pendingSelection},complete:false,requiresSelection:`Choose up to 1 Event with cost ${action.maxCost} or less from your Trash to activate its Main effect.`};
   if(ids.length>1)return {execution:{...execution,state,conditionResults,commandIndex:index},complete:false,error:'Choose no more than 1 Event from your Trash.'};
   if(!ids.length){index++;execution={...execution,commandIndex:index,pendingSelection:undefined};usedSelection=true;selection={};continue;}
   const event=state.cards.find(card=>card.id===ids[0]);
   if(!event||event.owner!==execution.actor||event.zone!=='trash'||event.type!=='Event'||(event.cost??Infinity)>action.maxCost||!event.effectSchema)return {execution:{...execution,state,conditionResults,commandIndex:index},complete:false,error:'Choose an eligible Event from your Trash.'};
   const nested=resolveEffectTiming(event.effectSchema,'main');
   if(nested.status!=='ready'||!nested.commands.length)return {execution:{...execution,state,conditionResults,commandIndex:index},complete:false,error:`${event.name??'That Event'} does not have a supported Main effect in its stored rules.`};
   const nestedCommands=nested.commands.map(item=>({...item,sourceId:event.id}));
   const commands=[...execution.commands];commands.splice(index,1,...nestedCommands);
   const attached=state.cards.filter(card=>card.owner===execution.actor&&card.type==='DON!!'&&card.attachedTo===event.id).length;
   const disabled=new Set([...(execution.disabledAbilityIds??[]),...nestedCommands.filter(item=>(item.requiredAttachedDon??0)>attached).map(item=>item.abilityId).filter((id):id is number=>id!==undefined),...unavailableSequentialCostAbilityIds(state,execution.actor,nestedCommands)]);
   execution={...execution,commands,disabledAbilityIds:[...disabled],pendingSelection:undefined,commandIndex:index};
   selection={};usedSelection=true;continue;
  }
  if(command.kind==='resolve-action'&&command.value.kind==='choose-one'){
   const action=command.value;
   const selected=execution.pendingSelection?.choice?.match(/^option:(\d+)$/),requested=selection.choice?.match(/^option:(\d+)$/);
   if(!selected&&!requested)return {execution:{...execution,state,conditionResults,commandIndex:index,pendingSelection:{...execution.pendingSelection}},complete:false,requiresSelection:`${action.chooser==='opponent'?'Your opponent chooses one':'Choose one option'}.`};
   const optionIndex=Number((requested??selected)?.[1]);
   if(!Number.isInteger(optionIndex)||!action.options[optionIndex])return {execution:{...execution,state,conditionResults,commandIndex:index,pendingSelection:execution.pendingSelection},complete:false,error:'Choose one of the listed options.'};
   if(!selected){
   const option=action.options[optionIndex],optionActions=option.actions??('action'in option&&option.action?[option.action]:[]),branchCommands=[...(option.costs??[]).map(value=>({kind:'pay-cost' as const,value,abilityId:command.abilityId,conditions:[...(command.conditions??[]),...(option.conditions??[]).map(condition=>condition.text)],requiredAttachedDon:command.requiredAttachedDon})),...optionActions.map(value=>({kind:'resolve-action' as const,value,abilityId:command.abilityId,conditions:[...(command.conditions??[]),...(option.conditions??[]).map(condition=>condition.text)],requiredAttachedDon:command.requiredAttachedDon}))];
   const commands=[...execution.commands];commands.splice(index,1,...branchCommands);
    execution={...execution,commands,commandIndex:index,pendingSelection:{...execution.pendingSelection,choice:`option:${optionIndex}`}};
    selection={...selection,choice:undefined};usedSelection=true;
   }
   continue;
  }
  if(promptSelection.choice==='decline'&&((command.kind==='pay-cost'&&(command.value as EffectCost).optional)||(command.kind==='resolve-action'&&Boolean((command.value as EffectAction).optional)))){
   const ability=command.abilityId;
   if(ability===undefined)return {execution:{...execution,state,conditionResults,commandIndex:execution.commands.length},complete:true};
   while(index<execution.commands.length&&execution.commands[index].abilityId===ability)index++;
   usedSelection=true;
   continue;
  }
  if(promptSelection.choice==='accept'&&command.kind==='resolve-action'&&Boolean((command.value as EffectAction).optional)){
   const action=command.value as EffectAction;
   if(action.kind==='trash'&&action.scope==='deck'){const top=state.cards.find(card=>card.owner===execution.actor&&card.zone==='deck');if(!top)return {execution:{...execution,state,conditionResults,commandIndex:index},complete:false,error:'There is no card to trash from the top of your deck.'};const result=applyEffectAction(state,execution.actor,action,{targetId:top.id,sourceCardId:execution.sourceId});if(result.error||result.requiresSelection)return {execution:{...execution,state:result.state,conditionResults,commandIndex:index},complete:false,requiresSelection:result.requiresSelection,error:result.error};state=result.state;index++;usedSelection=true;continue;}
   usedSelection=true;
  }
  const cost=command.kind==='pay-cost'?command.value as EffectCost:undefined;
  const optionalAction=command.kind==='resolve-action'&&Boolean((command.value as EffectAction).optional);
  if(optionalAction&&!promptSelection.choice&&!promptSelection.cardIds?.length&&!promptSelection.targetId&&!promptSelection.position&&!promptSelection.deckOrder?.length&&!promptSelection.replacementIds?.length){return {execution:{...execution,state,conditionResults,commandIndex:index,pendingSelection:{...execution.pendingSelection,...selection}},complete:false,requiresSelection:'Resolve this optional effect, or decline it.'};}
  const deterministicOptionalCost=cost?.kind==='turn-life'||cost?.kind==='trash-life-choice'||cost?.kind==='attach-opponent-don-character'||cost?.kind==='attach-don-character'||cost?.kind==='reveal-hand-cards'||cost?.kind==='bottom-deck-self'||cost?.kind==='rest'&&cost.scope==='self'||cost?.kind==='trash'&&(cost.scope==='self'||cost.scope==='deck'||cost.scope==='hand');
  const priorAcceptedOptionalCost=usedSelection&&command.kind==='pay-cost'&&Boolean((command.value as EffectCost).optional)&&execution.commands[index-1]?.kind==='pay-cost'&&execution.commands[index-1]?.abilityId===command.abilityId&&Boolean((execution.commands[index-1]?.value as EffectCost|undefined)?.optional);
  if(deterministicOptionalCost&&cost?.optional&&!priorAcceptedOptionalCost&&!promptSelection.choice&&!promptSelection.cardIds?.length&&!promptSelection.targetId&&!promptSelection.position&&!promptSelection.deckOrder?.length&&!promptSelection.replacementIds?.length){
   return {execution:{...execution,state,conditionResults,commandIndex:index,pendingSelection:{...execution.pendingSelection,...selection}},complete:false,requiresSelection:'Pay this optional cost, or decline the effect.'};
  }
  const input={...(usedSelection?{}:execution.pendingSelection),...(usedSelection?{}:selection),...(execution.battleOpponentId?{battleOpponentId:execution.battleOpponentId}:{})};
  const value=command.value as EffectAction|EffectCost;
  if(command.kind==='resolve-action'&&value.kind==='grant-keyword'&&((value.scope==='previous-played'&&!execution.lastPlayedCardId)||(value.scope==='previous-target'&&!execution.lastTargetCardId))){index++;continue;}
  const sourceBound=(command.kind==='pay-cost'&&((value.kind==='rest'||value.kind==='trash')&&value.scope==='self'||value.kind==='bottom-deck-self'))
  ||(command.kind==='resolve-action'&&(value.kind==='return-source-to-hand'||(value.kind==='play'&&value.thisCard)||(value.kind==='copy-base-power'&&value.target==='own-character')||(value.kind==='rest'&&value.scope==='self')||(value.kind==='trash'&&value.scope==='self')||(value.kind==='ready'&&value.scope==='self')||(value.kind==='attach-don'&&value.recipient==='self')||(value.kind==='attack-permission'&&value.scope==='own-character')||(value.kind==='skip-next-refresh'&&value.scope==='self')||(value.kind==='bottom-deck'&&value.scope==='self')||(value.kind==='grant-keyword'&&value.scope==='self')));
  const previousTargetId=command.kind==='resolve-action'&&value.kind==='grant-keyword'?(value.scope==='previous-played'?execution.lastPlayedCardId:value.scope==='previous-target'?execution.lastTargetCardId:undefined):command.kind==='resolve-action'&&value.kind==='attack-trigger-blocker-lock'&&'requiresPreviousAction'in value&&value.requiresPreviousAction?execution.lastTargetCardId:undefined;
  const previousTargetBound=Boolean(previousTargetId);
  const resolvedInput=sourceBound?{...input,targetId:commandSourceId,sourceCardId:commandSourceId}:previousTargetBound?{...input,targetId:previousTargetId,sourceCardId:commandSourceId}:{...input,sourceCardId:commandSourceId};
  const resolvedAction=command.kind==='resolve-action'&&value.kind==='trash'&&value.scope==='deck'&&'amountFromPreviousHandTrash'in value&&value.amountFromPreviousHandTrash?{...value,amount:execution.lastHandTrashCount??0}:command.kind==='resolve-action'&&value.kind==='trash'&&value.scope==='hand'&&'amountFromPreviousDraw'in value&&value.amountFromPreviousDraw?{...value,amount:execution.lastDrawCount??0}:command.kind==='resolve-action'&&value.kind==='play'&&value.restedIfPreviousPlayed?{...value,rested:Boolean(execution.lastPlayedCardId)}:value;
  if(command.kind==='resolve-action'&&value.kind==='trash'&&value.scope==='deck'&&selection.choice==='accept'){const top=state.cards.find(card=>card.owner===execution.actor&&card.zone==='deck');if(!top)return {execution:{...execution,state,conditionResults,commandIndex:index},complete:false,error:'There is no card to trash from the top of your deck.'};const result=applyEffectAction(state,execution.actor,value,{targetId:top.id,sourceCardId:execution.sourceId});if(result.error||result.requiresSelection)return {execution:{...execution,state:result.state,conditionResults,commandIndex:index},complete:false,requiresSelection:result.requiresSelection,error:result.error};state=result.state;index++;execution={...execution,state,commandIndex:index,pendingSelection:undefined};usedSelection=true;continue;}
  const handCountBefore=state.cards.filter(card=>card.owner===execution.actor&&card.zone==='hand').length;
  const previousCards=JSON.stringify(state.cards);
  const result=command.kind==='pay-cost'
   ?payEffectCost(state,execution.actor,command.value as EffectCost,resolvedInput)
   :applyEffectAction(state,execution.actor,resolvedAction as EffectAction,resolvedInput);
  if(result.error||result.requiresSelection){
   return {execution:{...execution,state:result.state,conditionResults,commandIndex:index,pendingSelection:input},complete:false,requiresSelection:result.requiresSelection,error:result.error};
  }
  state=result.state;
  const lastActionSucceeded=JSON.stringify(state.cards)!==previousCards;
  const selectedTarget=command.kind==='pay-cost'&&value.kind==='attach-don-character'?input.targetId:command.kind==='resolve-action'&&(value.kind==='play'||value.kind==='ready')?(input.cardIds?.length===1?input.cardIds[0]:input.targetId):undefined;
  const validTarget=selectedTarget?state.cards.find(card=>card.id===selectedTarget&&card.owner===execution.actor&&card.zone==='character')?.id:undefined;
  execution={...execution,lastActionSucceeded,lastPlayedCardId:command.kind==='resolve-action'&&value.kind==='play'?validTarget:execution.lastPlayedCardId,lastTargetCardId:command.kind==='pay-cost'&&value.kind==='attach-don-character'?validTarget:command.kind==='resolve-action'&&(value.kind==='play'||value.kind==='ready')?validTarget:execution.lastTargetCardId,lastHandTrashCount:command.kind==='resolve-action'&&value.kind==='trash'&&value.scope==='hand'&&'upTo'in value&&value.upTo?(input.cardIds?.length??0):execution.lastHandTrashCount,lastDrawCount:command.kind==='resolve-action'&&(value.kind==='draw'||value.kind==='draw-by'||value.kind==='draw-to-hand-size')?Math.max(0,result.state.cards.filter(card=>card.owner===execution.actor&&card.zone==='hand').length-handCountBefore):execution.lastDrawCount,pendingSelection:undefined};
  index++;
  usedSelection=true;
 }
 const oncePerTurnKeys=new Map(execution.commands.filter(command=>command.kind==='resolve-action'&&'oncePerTurn'in command.value&&command.value.oncePerTurn&&'activationKey'in command.value&&Boolean(command.value.activationKey)).map(command=>[`${command.sourceId??execution.sourceId}:${(command.value as EffectAction&{activationKey:string}).activationKey}`,{sourceId:command.sourceId??execution.sourceId,key:(command.value as EffectAction&{activationKey:string}).activationKey}]));
 const turnEffects=[...state.turnEffects,...[...oncePerTurnKeys.values()].filter(item=>!state.turnEffects.some(effect=>effect.kind==='activation-used'&&effect.target===item.sourceId&&effect.detail===item.key)).map(item=>({kind:'activation-used',target:item.sourceId,detail:item.key,owner:execution.actor,expires:'turn-end' as const}))];
 return {execution:{...execution,state:{...state,turnEffects},conditionResults,commandIndex:index},complete:true};
}
