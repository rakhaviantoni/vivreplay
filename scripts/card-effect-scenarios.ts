import {compileEffectDocument,type EffectAction,type EffectCost,type EffectDocument,type EffectTrigger} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {beginEffectExecution,advanceEffectExecution} from '../packages/domain/effect-controller';
import type {MatchCard,MatchEffectState} from '../packages/domain/match-effect-state';
import {applyEffectAction,payEffectCost,beginTurn,declareAttack,declareBlock,expireEffectModifiers,resolveBattle} from '../packages/domain/match-effect-state';
import {familyScenarios} from './effect-family-scenarios';
import {recoveryScenarios} from './effect-recovery-scenarios';
import {donScenarios} from './effect-don-scenarios';
import {keywordScenarios} from './effect-keyword-scenarios';
export type Identity={id:string;code:string;name:string;color:string;card_type:'Character'|'Leader'|'Event'|'Stage';cost:number;power:number;effect_text:string};
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const clean=(text:string|null)=>text?.replace(/^NULL$/i,'').trim()??'';
const base=():MatchEffectState=>({turn:'player',cards:Array.from({length:8},(_,i)=>({id:`deck-${i}`,owner:'player',zone:'deck',type:'Character'})),turnEffects:[],restrictions:[],delayed:[]});
type Scenario={name:string;run:(doc:EffectDocument)=>void};
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
const attachedDonRestScenarios=(row:Identity):Scenario[]=>{
 const local=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 return local.ast.flatMap((expectedAbility,index)=>{
  const expectedAction=expectedAbility.actions.find((action):action is Extract<EffectAction,{kind:'rest'}>=>action.kind==='rest'&&action.scope==='opponent-character'&&action.minAttachedDon!==undefined);if(!expectedAction||expectedAction.minAttachedDon===undefined)return [];
  const required=expectedAction.minAttachedDon;
  return [{name:`schema-attached-don-rest ${expectedAbility.trigger}: require ${required} attached DON!!`,run(doc){
   const ability=doc.ast.filter(candidate=>candidate.trigger===expectedAbility.trigger)[local.ast.filter(candidate=>candidate.trigger===expectedAbility.trigger).indexOf(expectedAbility)];
   if(!ability)throw new Error(`Published ${expectedAbility.trigger} ability ${index+1} is missing`);
   const action=ability.actions.find((candidate):candidate is Extract<EffectAction,{kind:'rest'}>=>candidate.kind==='rest'&&candidate.scope==='opponent-character');
   if(!action)throw new Error('Published rest action is missing');assert(action.minAttachedDon===required,'Published rest target is missing the attached-DON minimum');
   const makeState=(attached:number)=>({turn:'player' as const,cards:[{id:'eligible',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,cost:3},...Array.from({length:attached},(_,don)=>({id:`don-${don}`,owner:'opponent' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'eligible'})),{id:'ineligible',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,cost:3},{id:'own',owner:'player' as const,zone:'character' as const,type:'Character' as const,cost:3}],turnEffects:[],restrictions:[],delayed:[]});
   const insufficient=makeState(Math.max(0,required-1)),rejected=applyEffectAction(insufficient,'player',action,{targetId:'eligible',cardIds:['eligible']});assert(Boolean(rejected.error)&&rejected.state.cards.find(card=>card.id==='eligible')?.rested!==true,'Character below the attached-DON threshold was rested');
   const enough=makeState(required),rested=applyEffectAction(enough,'player',action,{targetId:'eligible',cardIds:['eligible']});assert(!rested.error&&!rested.requiresSelection&&rested.state.cards.find(card=>card.id==='eligible')?.rested===true,'Character at the attached-DON threshold could not be rested');
   const own=applyEffectAction(enough,'player',action,{targetId:'own',cardIds:['own']});assert(Boolean(own.error)&&own.state.cards.find(card=>card.id==='own')?.rested!==true,'Opponent-only rest accepted an own Character');
  }}];
 });
};
const boundedKeywordGrantScenarios=(row:Identity):Scenario[]=>{
 const local=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 return local.ast.flatMap((expected,index)=>{
  const action=expected.actions.find((candidate):candidate is Extract<EffectAction,{kind:'grant-keyword'}>=>candidate.kind==='grant-keyword');
  if(!action||!action.scope||action.scope==='previous-played')return [];
  const timingIndex=local.ast.filter(candidate=>candidate.trigger===expected.trigger).indexOf(expected);
  const cases:Scenario[]=[{name:`engine-action ${expected.trigger} grant-keyword-target: validate recipient restrictions`,run(doc){
   const ability=doc.ast.filter(candidate=>candidate.trigger===expected.trigger)[timingIndex];assert(Boolean(ability),'Published keyword-grant ability is missing');
   const parsed=ability!.actions.find((candidate):candidate is Extract<EffectAction,{kind:'grant-keyword'}>=>candidate.kind==='grant-keyword');assert(Boolean(parsed)&&canonical(parsed)===canonical(action),'Published keyword grant omitted or changed recipient restrictions');
   const state=base();state.cards.push({id:'source',owner:'player',zone:row.card_type==='Leader'?'leader':'character',type:row.card_type==='Leader'?'Leader':'Character',name:row.name,effectText:row.effect_text},{id:'legal',owner:'player',zone:'character',type:'Character',traits:action.trait?[action.trait]:[],name:action.name??'Eligible',cost:action.maxCost??3,color:action.color??'red',effectText:action.withoutOnPlay?'':''},{id:'wrong-trait',owner:'player',zone:'character',type:'Character',traits:['Other'],name:'Wrong Name',cost:action.maxCost??3,color:action.color??'red'},{id:'opponent',owner:'opponent',zone:'character',type:'Character',traits:action.trait?[action.trait]:[],name:action.name??'Eligible',cost:action.maxCost??3,color:action.color??'red'},{id:'own-leader',owner:'player',zone:'leader',type:'Leader',name:action.name??'Eligible',traits:action.trait?[action.trait]:[],cost:action.maxCost??3,color:action.color??'red'});
   const targetId=action.scope==='self'?'source':action.scope==='own-leader'?'own-leader':'legal';
   const selected=action.selection?{cardIds:[targetId]}:{targetId};const result=applyEffectAction(state,'player',action,selected);assert(!result.error&&!result.requiresSelection,'Legal printed keyword target was rejected');assert(result.state.cards.find(card=>card.id===targetId)?.temporaryKeywords?.includes(action.keyword),'Keyword was not granted to the selected target');
   if(action.selection){const prompt=applyEffectAction(state,'player',action);assert(Boolean(prompt.requiresSelection),'Up-to keyword grant did not ask for a target choice');const skipped=applyEffectAction(state,'player',action,{cardIds:[]});assert(!skipped.error&&!skipped.requiresSelection,'Optional up-to keyword grant could not be skipped');const tooMany=applyEffectAction(state,'player',action,{cardIds:['legal','wrong-trait']});assert(Boolean(tooMany.error),'Keyword grant accepted too many targets or an ineligible target');}
   for(const invalidId of ['opponent',...(action.trait?['wrong-trait']:[]),...(action.maxCost!==undefined?['too-expensive']:[])]){if(invalidId==='too-expensive')state.cards.push({id:invalidId,owner:'player',zone:'character',type:'Character',traits:action.trait?[action.trait]:[],name:action.name??'Eligible',cost:(action.maxCost??0)+1,color:action.color??'red'});const invalid=applyEffectAction(state,'player',action,action.selection?{cardIds:[invalidId]}:{targetId:invalidId});assert(Boolean(invalid.error),`Keyword grant accepted illegal target ${invalidId}`);}
  }}];
  if(!/\[On Play\](?!\s*effect\b)/i.test(row.effect_text))cases.push({name:'schema-keyword-isolation on-play: reject an unprinted On Play timing',run(doc){assert(!doc.ast.some(ability=>ability.trigger==='on-play'),'Keyword grant was incorrectly published as an On Play effect when the printed card has no On Play timing');}});
  return cases;
 });
};
const standaloneActionScenarios=(row:Identity):Scenario[]=>{
 const local=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 const supported=new Set(['power','ko','rest','ready','return-to-hand','bottom-deck','cost','draw','add-don','grant-keyword','attack-restriction','prevent-ready','prevent-rest']);
 return local.ast.flatMap((expectedAbility,abilityIndex)=>{
  if(expectedAbility.conditions.length||expectedAbility.costs.length||expectedAbility.actions.length!==1)return [];
  const expectedAction=expectedAbility.actions[0];if(!supported.has(expectedAction.kind))return [];
  const timingIndex=local.ast.filter(candidate=>candidate.trigger===expectedAbility.trigger).indexOf(expectedAbility);
  return [{name:`engine-action ${expectedAbility.trigger} ${expectedAction.kind}: resolve isolated parsed instruction`,run(doc){
   const ability=doc.ast.filter(candidate=>candidate.trigger===expectedAbility.trigger)[timingIndex];
   if(!ability)throw new Error(`Ability ${abilityIndex+1} was missing from the published schema`);
   assert(ability.actions.length===1&&ability.conditions.length===0&&ability.costs.length===0,`Ability ${abilityIndex+1} was no longer isolated in the published schema`);
   const action=ability.actions[0];assert(canonical(action)===canonical(expectedAction),'Published action differs from the locally parsed action');
   const state=base(),targetId='effect-target',selection:{targetId?:string;cardIds?:string[];sourceCardId?:string}={};
   const add=(card:MatchCard)=>state.cards.push(card);
   const targetOwner=('target'in action&&String(action.target).startsWith('opponent'))||('scope'in action&&['opponent-character','opponent-leader','opponent-card','opponent-don','opponent-hand'].includes(String(action.scope)))?'opponent':'player';
   let target:MatchCard|undefined;
   if(action.kind==='power'||action.kind==='cost'){
    const zone=action.kind==='power'&&action.target.endsWith('leader')?'leader':'character';target={id:targetId,owner:targetOwner,zone,type:zone==='leader'?'Leader':'Character',power:5000,cost:3,...(action.kind==='power'&&action.trait?{traits:[action.trait]}:{}),...(action.kind==='power'&&action.name?{name:action.name}:{})};add(target);selection.targetId=targetId;
    if(action.selection)selection.cardIds=[targetId];
   }else if(action.kind==='ko'){
    target={id:targetId,owner:'opponent',zone:'character',type:'Character',cost:action.maxCost??0,power:action.maxPower??1000,rested:Boolean(action.restedOnly)};add(target);selection.targetId=targetId;
    if(action.selection)selection.cardIds=[targetId];
   }else if(action.kind==='rest'){
    const zone=action.scope==='own-leader'||action.scope==='opponent-leader'?'leader':action.scope==='opponent-don'?'cost-area':'character';target={id:targetId,owner:targetOwner,zone,type:zone==='leader'?'Leader':zone==='cost-area'?'DON!!':'Character',cost:action.maxCost??0,rested:false};add(target);selection.targetId=targetId;
    if(action.minAttachedDon){const invalid=applyEffectAction(state,'player',action,{targetId,cardIds:action.selection?[targetId]:undefined});assert(Boolean(invalid.error),'Rest accepted a Character without the required attached DON!!');for(let i=0;i<action.minAttachedDon;i++)add({id:`attached-don-${i}`,owner:target.owner,zone:'cost-area',type:'DON!!',attachedTo:targetId});}
    if(action.selection&&action.selection.max!=='all')selection.cardIds=[targetId];
   }else if(action.kind==='ready'){
    const zone=action.scope==='own-don'?'cost-area':'character';target={id:targetId,owner:'player',zone,type:zone==='cost-area'?'DON!!':'Character',rested:true,traits:action.trait?[action.trait]:action.traits??[],attributes:action.attribute?[action.attribute]:[],cost:action.minCost??action.maxCost??0};add(target);selection.targetId=targetId;
    if(action.selection)selection.cardIds=[targetId];
   }else if(action.kind==='return-to-hand'||action.kind==='bottom-deck'){
    const zone=action.scope==='trash'?'trash':action.scope==='opponent-hand'?'hand':'character',owner=action.scope==='own-character'||action.scope==='trash'?'player':action.scope==='any-character'||action.scope==='any-card'?'player':'opponent',power=action.kind==='return-to-hand'?(action.maxBasePower??action.maxPower??5000):5000;target={id:targetId,owner,zone,type:'Character',cost:action.maxCost??0,power,rested:false};add(target);selection.targetId=targetId;
    if(action.selection)selection.cardIds=[targetId];
   }else if(action.kind==='draw'){
    // The base state contains eight ordered deck cards.
   }else if(action.kind==='add-don'){
    const count=Math.min(action.amount,2);for(let i=0;i<count;i++)add({id:`don-deck-${i}`,owner:'player',zone:'don-deck',type:'DON!!'});
    if(action.selection)selection.cardIds=Array.from({length:count},(_,i)=>`don-deck-${i}`);
   }else if(action.kind==='grant-keyword'){
    const zone=action.scope==='own-leader'?'leader':'character';target={id:targetId,owner:'player',zone,type:zone==='leader'?'Leader':'Character',traits:action.trait?[action.trait]:[],name:action.name,cost:action.maxCost??0,color:action.color??'red',effectText:action.withoutOnPlay?'':''};add(target);selection.targetId=targetId;if(action.scope==='self')selection.sourceCardId=targetId;
   }else if(action.kind==='attack-restriction'||action.kind==='prevent-ready'||action.kind==='prevent-rest'){
    const zone=action.scope==='opponent-don'?'cost-area':action.scope==='opponent-leader'?'leader':'character';target={id:targetId,owner:'opponent',zone,type:zone==='leader'?'Leader':zone==='cost-area'?'DON!!':'Character',...(action.kind==='prevent-ready'?{rested:Boolean(action.restedOnly),cost:action.maxCost??0}: {})};add(target);if(action.kind==='prevent-ready'&&action.minAttachedDon)for(let i=0;i<action.minAttachedDon;i++)add({id:`attached-don-${i}`,owner:target.owner,zone:'cost-area',type:'DON!!',attachedTo:targetId});selection.targetId=targetId;
   }
   if(action.kind==='power'&&action.bonus){
    const threshold=action.bonus.condition.match(/(\d+)\s+or\s+(more|less)\s+(?:cards? in your (trash|hand)|Life cards?)/i);
    if(threshold){const count=Number(threshold[1]),zone=/life/i.test(action.bonus.condition)?'life':/trash/i.test(action.bonus.condition)?'trash':'hand';for(let i=0;i<count;i++)add({id:`bonus-condition-${i}`,owner:'player',zone,type:'Character'});}
   }
   const result=applyEffectAction(state,'player',action,selection);assert(!result.error&&!result.requiresSelection,`Parsed ${action.kind} action did not resolve: ${result.error??result.requiresSelection}`);
   const changed=result.state.cards.find(card=>card.id===targetId);
   switch(action.kind){
    case 'power':assert((changed?.powerModifier??0)===action.amount+(action.bonus?.amount??0),'Power modifier differs from the parsed amount and satisfied bonus');break;
    case 'cost':assert((changed?.costModifier??0)===action.amount,'Cost modifier differs from the parsed amount');break;
    case 'ko':assert(changed?.zone==='trash','Eligible opposing Character was not K.O.d');break;
    case 'rest':assert(changed?.rested===true,'Eligible target was not rested');break;
    case 'ready':assert(changed?.rested===false,'Eligible target was not set active');break;
    case 'return-to-hand':assert(changed?.zone==='hand','Selected card did not return to hand');break;
    case 'bottom-deck':assert(changed?.zone==='deck','Selected card did not go to the bottom of the deck');break;
    case 'draw':assert(result.state.cards.filter(card=>card.owner==='player'&&card.zone==='hand').length===Math.min(8,action.amount),'Draw did not move the printed number of available cards');break;
    case 'add-don':assert(result.state.cards.filter(card=>card.owner==='player'&&card.zone==='cost-area'&&card.type==='DON!!').length===Math.min(action.selection?2:action.amount,action.amount),'Added DON!! count differs from the parsed amount');break;
    case 'grant-keyword':assert(changed?.temporaryKeywords?.includes(action.keyword),'Selected card did not gain the parsed keyword');break;
    case 'attack-restriction':assert(changed?.cannotAttack===true,'Opponent target did not receive the attack restriction');break;
    case 'prevent-ready':assert(changed?.cannotReady===true,'Opponent target did not receive the ready restriction');break;
    case 'prevent-rest':assert(changed?.rested===true,'Opponent target did not become rested');break;
   }
  }}];
 });
};
const simplePowerScenarios=(row:Identity):Scenario[]=>{
 const supported=new Set(['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block']);
 const result:Scenario[]=[];
 const clauses=clean(row.effect_text).split(/(?=\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block)\])/i);
 for(const [index,ability] of clauses.entries()){
  const timingMatch=ability.match(/^\s*\[(On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block)\]/i);
  if(!timingMatch)continue;
  const timing=({'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block'} as Record<string,EffectTrigger>)[timingMatch[1].toLowerCase()];
  if(!supported.has(timing))continue;
  const simple=ability.trim().match(/^\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block)\]\s*(?:(Up to 1 of your Leader or Character cards?|Up to 1 of your Characters?|This Character|This Leader|Your Leader) gains\s+([+\-−]\s*[\d,]+)\s+power during this (battle|turn)\.?)$/i);
  if(!simple)continue;
  const expected={amount:Number(simple[2].replace(/[\s,−]/g,'-')),until:/battle/i.test(simple[3])?'battle':'turn-end'};
  result.push({name:`schema-power ${timing}: printed amount and duration`,run(doc){
   const abilityBody=ability.trim().replace(/^\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block)\]\s*/i,'');
   const matching=doc.ast.filter(ast=>ast.trigger===timing&&ast.rawText.includes(abilityBody));
   assert(matching.length===1,`Printed power clause ${index+1} was not isolated to one ${timing} ability`);
   const ast=matching[0],actions=ast.actions.filter(action=>action.kind!=='attach-don-required');
   assert(ast.conditions.length===0&&ast.costs.length===0&&actions.length===1&&actions[0].kind==='power',`Power clause has extra conditions, costs, or actions requiring a dedicated scenario`);
   const action=actions[0];if(!action||action.kind!=='power')throw new Error('Expected one parsed power action');assert(action.amount===expected.amount&&action.until===expected.until,`Schema power ${action.amount}/${action.until} differs from printed ${expected.amount}/${expected.until}`);
   const own=String(action.target).startsWith('own'),leader=action.target==='own-leader'||action.target==='opponent-leader',self=/^(?:This Character|This Leader)$/i.test(simple[1]),targetId=self?'source':leader?'target-leader':'target-character';
   const state=base();state.cards.push({id:'source',owner:'player',zone:'character',type:'Character',name:row.name},{id:'target-leader',owner:own?'player':'opponent',zone:'leader',type:'Leader',power:5000},{id:'target-character',owner:own?'player':'opponent',zone:'character',type:'Character',power:4000});
   const done=applyEffectAction(state,'player',action,{targetId,cardIds:[targetId]});assert(!done.error&&!done.requiresSelection,'Printed power target was rejected');
   assert(done.state.cards.find(card=>card.id===targetId)?.powerModifier===expected.amount,'Printed power modifier was not applied to the selected card');
   const illegalId=own?'illegal-opponent':'illegal-own';done.state.cards.push({id:illegalId,owner:own?'opponent':'player',zone:'character',type:'Character',power:4000});
   const illegal=applyEffectAction(done.state,'player',action,{targetId:illegalId,cardIds:[illegalId]});assert(illegal.error,'Power effect accepted the wrong owner');
   const battleEnd=expireEffectModifiers(done.state,'battle'),afterBattle=battleEnd.cards.find(card=>card.id===targetId)?.powerModifier??0;
   assert(afterBattle===(expected.until==='battle'?0:expected.amount),'Power modifier expired in the wrong timing window');
   const turnEnd=expireEffectModifiers(battleEnd,'turn-end');assert((turnEnd.cards.find(card=>card.id===targetId)?.powerModifier??0)===0,'Power modifier remained after its printed duration');
  }});
 }
 return result;
};
const simpleCounterPowerScenarios=(row:Identity):Scenario[]=>{
 const clauses=clean(row.effect_text).split(/(?=\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block)\])/i),result:Scenario[]=[];
 for(const clause of clauses){const match=clause.trim().match(/^\[Counter\]\s*Up to 1 of your (.+?) gains ([+\-−]\s*\d+) power during this battle\.?$/i);if(!match||(/\bor\b/i.test(match[1])&&!/^Leader or Characters?$/i.test(match[1])))continue;
  const subject=match[1].trim(),amount=Number(match[2].replace(/[\s−]/g,'-')),trait=subject.match(/(?:\[([^\]]+)\]|\{([^}]+)\})\s+type\s+Characters?/i),name=subject.match(/\[([^\]]+)\](?:\s+cards?)?$/i);if(!/^(?:Leader|Characters?|Leader or Character cards?|Leader or Characters?|cards?|\[[^\]]+\](?:\s+cards?)?|(?:\[[^\]]+\]|\{[^}]+\})\s+type\s+Characters?)$/i.test(subject))continue;
  result.push({name:`schema-power counter: exact target, ${amount} for this battle`,run(doc){const abilityBody=clause.trim().replace(/^\[Counter\]\s*/i,'');const matches=doc.ast.filter(ast=>ast.trigger==='counter'&&ast.rawText.includes(abilityBody));assert(matches.length===1,'Printed Counter power clause is not isolated');const ast=matches[0],actions=ast.actions.filter(action=>action.kind!=='attach-don-required');assert(ast.conditions.length===0&&ast.costs.length===0&&actions.length===1&&actions[0].kind==='power','Counter power has unmodeled costs or additional actions');const action=actions[0];if(action.kind!=='power')throw new Error('Expected power action');const expectedTarget=/^Leader$/i.test(subject)?'own-leader':/cards?$/i.test(subject)||/^\[[^\]]+\]$/i.test(subject)||/^Leader or Characters?$/i.test(subject)?'own-card':'own-character';assert(action.target===expectedTarget&&action.amount===amount&&action.until==='battle'&&action.selection?.min===0&&action.selection.max===1,'Counter power scope, amount, duration, or optional target count differs from its text');assert(action.trait===(trait?.[1]??trait?.[2])&&action.name===name?.[1],'Counter power did not preserve its printed trait/name restriction');
   const owner:'player'|'opponent'=String(action.target).startsWith('opponent')?'opponent':'player',zone:'leader'|'character'=action.target.endsWith('leader')?'leader':'character',target={id:'target',owner,zone,type:zone==='leader'?'Leader' as const:'Character' as const,name:name?.[1]??'Target',traits:trait?[trait[1]??trait[2]]:[],power:4000},state:MatchEffectState={...base(),cards:[target]};const applied=applyEffectAction(state,'player',action,{targetId:target.id,cardIds:[target.id]});assert(!applied.error&&!applied.requiresSelection&&(applied.state.cards[0]?.powerModifier??0)===amount,'Counter power did not modify an eligible printed target');const expired=expireEffectModifiers(applied.state,'battle');assert((expired.cards[0]?.powerModifier??0)===0,'Counter power lasted beyond its battle');
   const wrong={...target,id:'wrong',name:name?'Different Name':target.name,traits:trait?['Wrong Trait']:target.traits};const rejected=applyEffectAction({...state,cards:[wrong]},'player',action,{targetId:'wrong',cardIds:['wrong']});if(name||trait)assert(Boolean(rejected.error),'Counter power accepted a card outside its printed name/trait restriction');
  }});
 }
 return result;
};
const printedOpponentPowerScenarios=(row:Identity):Scenario[]=>{
 const result:Scenario[]=[],compiled=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text}),clauses=clean(row.effect_text).split(/(?=\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block)\])/i);
 for(const clause of clauses){const match=clause.trim().match(/^\[(On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block)\]\s*Give up to (\d+) of your opponent's Characters? ([+\-−]\s*[\d,]+) power during this turn\.?$/i);if(!match)continue;
  const timing=({'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block'} as Record<string,EffectTrigger>)[match[1].toLowerCase()],amount=Number(match[2]),power=Number(match[3].replace(/[\s,−]/g,'-')),body=clause.trim().replace(/^\[[^\]]+\]\s*/,'');const abilityIndex=compiled.ast.filter(ast=>ast.trigger===timing).findIndex(ast=>ast.rawText.includes(body));if(abilityIndex<0)continue;
  result.push({name:`schema-opponent-power ${timing}: up to ${amount}, ${power}`,run(doc){
   const ability=doc.ast.filter(ast=>ast.trigger===timing)[abilityIndex];assert(Boolean(ability),'Opponent power clause was not isolated to its timing');const actions=ability.actions.filter(action=>action.kind!=='attach-don-required'),markers=ability.actions.filter(action=>action.kind==='attach-don-required'),donMarker=ability.rawText.match(/\[DON!!\s*[x×]\s*(\d+)\]/i);assert(ability.conditions.length===0&&ability.costs.length===0&&actions.length===1&&markers.length===(donMarker?1:0)&&(!donMarker||(markers[0].kind==='attach-don-required'&&markers[0].amount===Number(donMarker[1]))),'Opponent power clause has unmodeled conditions, costs, or actions');
   const action=actions[0];assert(action?.kind==='power','Printed clause did not parse as a power action');if(action.kind!=='power')throw new Error('Expected power action');assert(action.target==='opponent-character'&&action.amount===power&&action.until==='turn-end'&&action.selection?.min===0&&action.selection.max===amount,'Opponent power target, amount, duration, or up-to limit differs from its text');
   const state:MatchEffectState={...base(),cards:[{id:'eligible',owner:'opponent',zone:'character',type:'Character',power:6000},{id:'other-eligible',owner:'opponent',zone:'character',type:'Character',power:5000},{id:'own',owner:'player',zone:'character',type:'Character',power:5000}]};const selected=applyEffectAction(state,'player',action,{targetId:'eligible',cardIds:['eligible']});assert(!selected.error&&!selected.requiresSelection&&selected.state.cards.find(card=>card.id==='eligible')?.powerModifier===power,'Eligible opponent Character did not receive the printed power change');const skipped=applyEffectAction(state,'player',action,{cardIds:[]});assert(!skipped.error&&!skipped.requiresSelection&&state.cards.every(card=>!card.powerModifier),'Optional up-to power selection could not be skipped');if(amount<2){const excess=applyEffectAction(state,'player',action,{cardIds:['eligible','other-eligible']});assert(Boolean(excess.error)&&state.cards.every(card=>!card.powerModifier),'Power effect accepted more targets than its printed maximum');}const wrongOwner=applyEffectAction(state,'player',action,{targetId:'own',cardIds:['own']});assert(Boolean(wrongOwner.error),'Opponent-only power effect accepted your Character');const expired=expireEffectModifiers(selected.state,'turn-end');assert((expired.cards.find(card=>card.id==='eligible')?.powerModifier??0)===0,'Opponent power change lasted beyond this turn');
  }});
 }
 return result;
};

const printedTargetPowerScenarios=(row:Identity):Scenario[]=>{
 const result:Scenario[]=[],text=clean(row.effect_text);
 const clauses=text.split(/(?=\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block)\])/i);
 for(const clause of clauses){
  const match=clause.trim().match(/^\[(On Play|When Attacking|Activate\s*:\s*Main|Main|Trigger|On K\.O\.|On Block)\]\s*Up to (\d+) of your (.+?) gains ([+\-−]\s*[\d,]+) power during this (battle|turn)\.?$/i);
  if(!match)continue;
  const timing=({'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','trigger':'trigger','on k.o.':'on-ko','on block':'on-block'} as Record<string,EffectTrigger>)[match[1].toLowerCase()],amount=Number(match[4].replace(/[\s,−]/g,'-')),max=Number(match[2]),subject=match[3].trim();
  const traitMatch=subject.match(/(?:\[([^\]]+)\]|\{([^}]+)\})\s+type\s+(Characters?|Leader or Character) cards?/i);
  const nameMatch=subject.match(/^\[([^\]]+)\] cards?$/i);
  const leaderOrCharacter=/^Leader or Character cards?$/i.test(subject);
  const character=/^Characters?$/i.test(subject);
  const opponentCharacters=/^opponent's Characters?$/i.test(subject);
  if(!traitMatch&&!nameMatch&&!leaderOrCharacter&&!character&&!opponentCharacters)continue;
  const target=opponentCharacters?'opponent-character':(leaderOrCharacter||nameMatch||traitMatch?.[3]?.includes('Leader'))?'own-card':'own-character';
  const trait=traitMatch?.[1]??traitMatch?.[2],name=nameMatch?.[1];
  result.push({name:`schema-power ${timing}: printed target ${subject}, ${amount} for this ${match[5]}`,run(doc){
   const body=clause.trim().replace(/^\[[^\]]+\]\s*/,'');
   const candidates=doc.ast.filter(ast=>ast.trigger===timing&&ast.rawText.includes(body));assert(candidates.length===1,'Printed target-specific power clause was not isolated');
   const ability=candidates[0],actions=ability.actions.filter(action=>action.kind==='power');assert(ability.conditions.length===0&&ability.costs.length===0&&actions.length===1&&ability.actions.length===1,'Target-specific power clause has extra costs or unresolved actions');
   const action=actions[0];if(action.kind!=='power')throw new Error('Expected a power action');
   assert(action.target===target&&action.amount===amount&&action.until===(match[5].toLowerCase()==='battle'?'battle':'turn-end'),'Power target, amount, or duration differs from printed text');
   assert(action.selection?.min===0&&action.selection.max===max,'Power selection bounds differ from printed up-to count');assert(action.trait===trait&&action.name===name,'Power action lost its printed trait or card-name restriction');
   const state=base(),owner=opponentCharacters?'opponent':'player';
   const legal:MatchCard={id:'legal',owner,zone:'character',type:'Character',name:name??'Eligible',traits:trait?[trait]:[],power:5000};state.cards.push(legal);
   const selected=applyEffectAction(state,'player',action,{cardIds:['legal'],targetId:'legal'});assert(!selected.error&&!selected.requiresSelection&&selected.state.cards.find(card=>card.id==='legal')?.powerModifier===amount,'Eligible printed power recipient was rejected');
   const invalid:MatchCard={...legal,id:'invalid',...(trait?{traits:['Different trait']}:{}),...(name?{name:'Different name'}:{})};
   if(trait||name){const rejected=applyEffectAction({...state,cards:[invalid]},'player',action,{cardIds:['invalid'],targetId:'invalid'});assert(Boolean(rejected.error),'Power effect accepted a target outside its printed trait/name restriction');}
   const skipped=applyEffectAction(state,'player',action,{cardIds:[]});assert(!skipped.error&&!skipped.requiresSelection,'Optional up-to power target could not be skipped');
   const expired=expireEffectModifiers(selected.state,match[5].toLowerCase()==='battle'?'battle':'turn-end');assert((expired.cards.find(card=>card.id==='legal')?.powerModifier??0)===0,'Power modifier did not expire at its printed timing');
  }});
 }
 return result;
};
const printedRestScenarios=(row:Identity):Scenario[]=>{
 const expandedText=clean(row.effect_text).replace(/\[(Main|Counter|On Play|On K\.O\.)\]\s*\/\s*\[(Main|Counter|On Play|On K\.O\.)\]\s*(Rest up to 1 of your opponent's (?:Leader or Character cards?|Characters?|DON!! cards?)(?: with a cost of \d+ or less)?\.?)(?=\s*(?:\[|$))/gi,(_match,first,second,effect)=>`[${first}] ${effect}\n[${second}] ${effect}`);
 const result:Scenario[]=[],compiled=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text}),clauses=expandedText.split(/(?=\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|End of Your Turn)\])/i);
 for(const clause of clauses){
  const match=clause.trim().match(/^\[(On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|End of Your Turn)\]\s*Rest up to 1 of your opponent's (Leader or Character cards?|Characters?|DON!! cards?)(?: with a cost of (\d+) or less)?\.?$/i);if(!match)continue;
  const timing=({'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block',"on your opponent's attack":'opponent-attack','end of your turn':'end-turn'} as Record<string,EffectTrigger>)[match[1].toLowerCase()],subject=match[2],scope=/DON!!/i.test(subject)?'opponent-don':/leader or character/i.test(subject)?'opponent-card':/leader/i.test(subject)?'opponent-leader':'opponent-character',maxCost=match[3]===undefined?undefined:Number(match[3]),body=clause.trim().replace(/^\[[^\]]+\]\s*/,'');
  const abilityIndex=compiled.ast.filter(ast=>ast.trigger===timing).findIndex(ast=>ast.rawText.includes(body));if(abilityIndex<0)continue;
  result.push({name:`schema-rest-target ${timing}: ${scope}${maxCost===undefined?'':` cost ${maxCost}`}`,run(doc){
   const ability=doc.ast.filter(ast=>ast.trigger===timing)[abilityIndex];assert(Boolean(ability),'Printed rest clause was not isolated to its timing window');const actions=ability.actions.filter(action=>action.kind==='rest'),markers=ability.actions.filter(action=>action.kind==='attach-don-required'),donMarker=ability.rawText.match(/\[DON!!\s*[x×]\s*(\d+)\]/i);assert(ability.conditions.length===0&&ability.costs.length===0&&actions.length===1&&ability.actions.length===actions.length+markers.length&&markers.length===(donMarker?1:0)&&(!donMarker||(markers[0].kind==='attach-don-required'&&markers[0].amount===Number(donMarker[1]))),'Rest clause has unmodeled conditions, costs, or actions');
   const action=actions[0];if(action.kind!=='rest')throw new Error('Expected a rest action');assert(action.scope===scope&&action.maxCost===maxCost,'Rest target scope or cost limit differs from printed text');
   const zone=scope==='opponent-don'?'cost-area':scope==='opponent-leader'?'leader':'character',type=zone==='cost-area'?'DON!!':zone==='leader'?'Leader':'Character',state:MatchEffectState={...base(),cards:[{id:'eligible',owner:'opponent',zone,type,cost:maxCost??0,rested:false}]};
   const applied=applyEffectAction(state,'player',action,{targetId:'eligible',cardIds:['eligible']});assert(!applied.error&&!applied.requiresSelection&&applied.state.cards.find(card=>card.id==='eligible')?.rested===true,'Rest failed against an eligible printed target');
   if(maxCost!==undefined){const over={...state,cards:[{...state.cards[0],id:'over-limit',cost:maxCost+1}]},rejected=applyEffectAction(over,'player',action,{targetId:'over-limit',cardIds:['over-limit']});assert(Boolean(rejected.error)&&rejected.state.cards[0].rested!==true,'Rest accepted a target above its printed cost limit');}
   const wrongOwner={...state,cards:[{...state.cards[0],id:'own',owner:'player' as const}]},rejected=applyEffectAction(wrongOwner,'player',action,{targetId:'own',cardIds:['own']});assert(Boolean(rejected.error)&&rejected.state.cards[0].rested!==true,'Opponent-only rest accepted your card');
  }});
 }
 return result;
};
const printedPreventReadyScenarios=(row:Identity):Scenario[]=>{
 const result:Scenario[]=[],compiled=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text}),expandedText=clean(row.effect_text).replace(/\[(On Play|When Attacking)\]\s*\/\s*\[(On Play|When Attacking)\]\s*((?:Up to \d+ of your opponent's|All of your opponent's) (?:rested )?(?:Leader or Character cards?|Characters?|DON!! cards?|cards?)(?: with a cost of \d+ or less)? will not become active in your opponent's next Refresh Phase\.?)/gi,(_match,first,second,effect)=>`[${first}] ${effect}\n[${second}] ${effect}`),clauses=expandedText.split(/(?=\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|End of Your Turn)\])/i);
 for(const clause of clauses){const match=clause.trim().match(/^\[(Main|On Play|When Attacking|Activate\s*:\s*Main|Trigger|On K\.O\.|On Block)\]\s*(?:Up to (\d+) of your opponent's|All of your opponent's) (rested )?(Leader or Character cards?|Characters?|DON!! cards?|cards?)(?: with a cost of (\d+) or less)?(?: that has (\d+) or more DON!! cards? given)? will not become active in your opponent's next Refresh Phase\.?$/i);if(!match)continue;
  const timing=({'main':'main','on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','trigger':'trigger','on k.o.':'on-ko','on block':'on-block'} as Record<string,EffectTrigger>)[match[1].toLowerCase()],scope=/DON!!/i.test(match[4])?'opponent-don':/cards?$/i.test(match[4])&&!/Character/i.test(match[4])?'opponent-card':/Leader or Character/i.test(match[4])?'opponent-card':'opponent-character',restedOnly=Boolean(match[3]),maxCost=match[5]===undefined?undefined:Number(match[5]),minAttachedDon=match[6]===undefined?undefined:Number(match[6]),amount=match[2]===undefined?'all':Number(match[2]),body=clause.trim().replace(/^\[[^\]]+\]\s*/,'');
  const abilityIndex=compiled.ast.filter(ast=>ast.trigger===timing).findIndex(ast=>ast.rawText.includes(body));if(abilityIndex<0)continue;
  result.push({name:`schema-prevent-ready ${timing}: ${scope}${restedOnly?' rested':''}${maxCost===undefined?'':` cost ${maxCost}`}${minAttachedDon===undefined?'':` attached DON ${minAttachedDon}`} up-to ${amount}`,run(doc){
   const ability=doc.ast.filter(ast=>ast.trigger===timing)[abilityIndex];assert(Boolean(ability),'No-ready clause was not isolated to its printed timing');const actions=ability.actions.filter(action=>action.kind!=='attach-don-required'),markers=ability.actions.filter(action=>action.kind==='attach-don-required'),donMarker=ability.rawText.match(/\[DON!!\s*[x×]\s*(\d+)\]/i);assert(ability.conditions.length===0&&ability.costs.length===0&&actions.length===1&&markers.length===(donMarker?1:0)&&(!donMarker||(markers[0].kind==='attach-don-required'&&markers[0].amount===Number(donMarker[1]))),'No-ready clause has unmodeled conditions, costs, or actions');
   const action=actions[0];assert(action.kind==='prevent-ready'&&action.scope===scope&&action.until==='opponent-next-refresh'&&action.restedOnly===restedOnly&&action.maxCost===maxCost&&action.minAttachedDon===minAttachedDon&&action.selection?.min===0&&action.selection.max===amount,'No-ready target scope, rested filter, cost limit, timing, or target count differs from its text');
   const zone:MatchCard['zone']=scope==='opponent-don'?'cost-area':'character',type:MatchCard['type']=scope==='opponent-don'?'DON!!':'Character',targetCount=amount==='all'?2:Number(amount)+1,targetIds=Array.from({length:Math.max(2,targetCount)},(_,index)=>index===0?'eligible':index===1?'second-eligible':`extra-eligible-${index}`),cards:MatchEffectState['cards']=[...targetIds.map(id=>({id,owner:'opponent' as const,zone,type,cost:maxCost??0,rested:true})),{id:'wrong-rest-state',owner:'opponent',zone,type,cost:maxCost??0,rested:false},{id:'over-cost',owner:'opponent',zone,type,cost:(maxCost??0)+1,rested:true},{id:'own',owner:'player',zone:'character',type:'Character',cost:maxCost??0,rested:true}];if(minAttachedDon!==undefined)for(let i=0;i<minAttachedDon;i++)cards.push({id:`eligible-don-${i}`,owner:'opponent',zone:'cost-area',type:'DON!!',attachedTo:'eligible'});const state:MatchEffectState={...base(),cards};if(scope==='opponent-card')state.cards.push({id:'eligible-leader',owner:'opponent',zone:'leader',type:'Leader',rested:true},{id:'eligible-stage',owner:'opponent',zone:'stage',type:'Stage',rested:true},{id:'eligible-cost-don',owner:'opponent',zone:'cost-area',type:'DON!!',rested:true});if(minAttachedDon!==undefined)state.cards.push({id:'under-don',owner:'opponent',zone:'character',type:'Character',cost:maxCost??0,rested:true},{id:'under-don-card',owner:'opponent',zone:'cost-area',type:'DON!!',attachedTo:'under-don'});
   const picked=applyEffectAction(state,'player',action,{cardIds:['eligible']});assert(!picked.error&&!picked.requiresSelection&&picked.state.cards.find(card=>card.id==='eligible')?.cannotReady===true,'Eligible opponent card did not receive the no-ready effect');assert(!picked.state.cards.find(card=>card.id==='wrong-rest-state')?.cannotReady&&!picked.state.cards.find(card=>card.id==='over-cost')?.cannotReady&&!picked.state.cards.find(card=>card.id==='own')?.cannotReady,'No-ready effect included a card outside the printed rested/cost/opponent filter');if(amount!=='all'){const excess=applyEffectAction(state,'player',action,{cardIds:targetIds.slice(0,Number(amount)+1)});assert(Boolean(excess.error)&&state.cards.every(card=>!card.cannotReady),'No-ready effect accepted more targets than its printed maximum');}
  }});
 }
 return result;
};
const printedReadyScenarios=(row:Identity):Scenario[]=>{
 const result:Scenario[]=[],compiled=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text}),clauses=clean(row.effect_text).split(/(?=\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|End of Your Turn)\])/i);
 for(const clause of clauses){
  const match=clause.trim().match(/^\[(On Play|When Attacking|Activate\s*:\s*Main|Main|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|End of Your Turn)\]\s*Set up to (\d+) of your (.*?)(rested )?(Characters?|DON!! cards?)(?: with a type including [\"{]?([^\"}\]]+)[\"}\]]?)?(?: with a cost of (\d+) or less)? as active\.?$/i);if(!match)continue;
  const timing=({'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','trigger':'trigger','on k.o.':'on-ko','on block':'on-block',"on your opponent's attack":'opponent-attack','end of your turn':'end-turn'} as Record<string,EffectTrigger>)[match[1].toLowerCase()],amount=Number(match[2]),subject=match[3].trim(),restedOnly=Boolean(match[4]),targetIsDon=/DON!!/i.test(match[5]),maxCost=match[7]===undefined?undefined:Number(match[7]),includedType=match[6]?.trim();
  const traits=[...subject.matchAll(/\[([^\]]+)\]|\{([^}]+)\}|"([^"]+)"/g)].map(found=>(found[1]??found[2]??found[3]).trim());if(includedType)traits.push(includedType);const attribute=subject.match(/(?:\[([^\]]+)\]|\{([^}]+)\}|"([^"]+)"|([\w-]+))\s+attribute/i);const attributeName=attribute?(attribute[1]??attribute[2]??attribute[3]??attribute[4]).trim():undefined;const isTraitType=Boolean(includedType)||/type(?:\s+including)?/i.test(subject);if((traits.length&&!isTraitType&&!attributeName)||(!traits.length&&!attributeName&&subject.trim()!==''))continue;
  const expectedTraits=isTraitType?traits:[],scope=targetIsDon?'own-don':'own-character',zone=targetIsDon?'cost-area':'character',type=targetIsDon?'DON!!':'Character',body=clause.trim().replace(/^\[[^\]]+\]\s*/,'');const abilityIndex=compiled.ast.filter(ast=>ast.trigger===timing).findIndex(ast=>ast.rawText.includes(body));if(abilityIndex<0)continue;
  result.push({name:`schema-ready-target ${timing}: ${targetIsDon?'DON!!':expectedTraits.join('|')||attributeName||'any'}${maxCost===undefined?'':` cost ${maxCost}`}${restedOnly?' rested':''} max ${amount}`,run(doc){
   const ability=doc.ast.filter(ast=>ast.trigger===timing)[abilityIndex];assert(Boolean(ability),'Ready clause was not isolated to its printed timing');assert(ability.conditions.length===0&&ability.costs.length===0&&ability.actions.length===1,'Ready clause has unmodeled conditions, costs, or actions');
   const action=ability.actions[0];assert(action?.kind==='ready','Printed clause did not parse as a ready action');if(action.kind!=='ready')throw new Error('Expected ready action');assert(action.scope===scope&&action.amount===amount&&action.maxCost===maxCost&&Boolean(action.restedOnly)===restedOnly&&action.selection?.min===0&&action.selection.max===amount,'Ready scope, amount, cost/rested filter, or optional target count differs from its text');assert(JSON.stringify(action.trait?[action.trait]:action.traits??[])===JSON.stringify(expectedTraits)&&action.attribute===attributeName,'Ready action lost its printed trait or attribute filter');
   const make=(id:string,owner:'player'|'opponent',cost:number,rested:boolean,traitList=expectedTraits,attrs=attributeName?[attributeName]:[])=>({id,owner,zone:zone as 'character'|'cost-area',type:type as 'Character'|'DON!!',cost,rested,traits:traitList,attributes:attrs});const state:MatchEffectState={...base(),cards:[make('eligible','player',maxCost??0,true,expectedTraits.length?expectedTraits:['Generic'],attributeName?[attributeName]:[]),make('over-cost','player',(maxCost??0)+1,true),make('active','player',maxCost??0,false),make('wrong-filter','player',maxCost??0,true,expectedTraits.length?['Unprinted Trait']:['Generic'],attributeName?['Unprinted Attribute']:[]),make('opponent','opponent',maxCost??0,true)]};
   const chosen=applyEffectAction(state,'player',action,{cardIds:['eligible']});assert(!chosen.error&&!chosen.requiresSelection&&chosen.state.cards.find(card=>card.id==='eligible')?.rested===false,`Eligible rested ${type} was not set active`);for(const id of [...(maxCost===undefined?[]:['over-cost']),'active',...(expectedTraits.length||attributeName?['wrong-filter']:[]),'opponent']){const rejected=applyEffectAction(state,'player',action,{cardIds:[id]});const before=state.cards.find(card=>card.id===id),after=rejected.state.cards.find(card=>card.id===id);assert(Boolean(rejected.error)||after?.rested===before?.rested,`Ready effect changed illegal target ${id}`);}
  }});
 }
 return result;
};
const simpleKoScenarios=(row:Identity):Scenario[]=>{
 const result:Scenario[]=[];
 const dynamicLife=clean(row.effect_text).match(/^\[Main\]\s*K\.O\. up to (\d+) of your opponent's Characters with a cost equal to or less than the number of your opponent's Life cards\.?(?=\s*\[Trigger\])/i);
 if(dynamicLife){const amount=Number(dynamicLife[1]);return [{name:`schema-ko main: up to ${amount}, cost cap equals opponent Life`,run(doc){
  const ability=doc.ast.find(item=>item.trigger==='main');if(!ability)throw new Error('Main K.O. ability is missing');const action=ability.actions[0];assert(action?.kind==='ko'&&action.maxCostFromLife==='opponent'&&action.selection?.min===0&&action.selection.max===amount,'Main must set its K.O. cost cap from current opponent Life and preserve its optional target count');
  const state=base();state.cards.push(...Array.from({length:2},(_,index)=>({id:`opponent-life-${index}`,owner:'opponent' as const,zone:'life' as const,type:'Character' as const})),{id:'within-life-cap',owner:'opponent',zone:'character',type:'Character',cost:2,rested:true},{id:'over-life-cap',owner:'opponent',zone:'character',type:'Character',cost:3,rested:true});
  const accepted=applyEffectAction(state,'player',action,{targetId:'within-life-cap',cardIds:['within-life-cap']});assert(!accepted.error&&!accepted.requiresSelection&&accepted.state.cards.find(card=>card.id==='within-life-cap')?.zone==='trash','Character at the opponent-Life cost cap should be K.O.d');const rejected=applyEffectAction(state,'player',action,{targetId:'over-life-cap',cardIds:['over-life-cap']});assert(Boolean(rejected.error)&&rejected.state.cards.find(card=>card.id==='over-life-cap')?.zone==='character','Character above the live opponent-Life cap was accepted');
 }}];}
 const clauses=clean(row.effect_text).split(/(?=\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block)\])/i);
 for(const [index,ability] of clauses.entries()){
  const simple=ability.trim().match(/^\[(On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block)\]\s*K\.O\. up to (\d+) of your opponent's (rested )?Characters?(?: with (?:a cost of (\d+)|(\d+) (base )?power) or less)?\.?$/i);
  if(!simple)continue;
  const timing=({'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block'} as Record<string,EffectTrigger>)[simple[1].toLowerCase()];
  const amount=Number(simple[2]),field=simple[4]?'cost':simple[5]?simple[6]?'base-power':'power':'none',limit=simple[4]||simple[5]?Number(simple[4]??simple[5]):undefined,restedOnly=Boolean(simple[3]);
  result.push({name:`schema-ko ${timing}: up to ${amount}${field==='none'?'':`, ${field} cap ${limit}`}${restedOnly?' rested':''}`,run(doc){
   const abilityBody=ability.trim().replace(/^\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block)\]\s*/i,'');
   const matching=doc.ast.filter(ast=>ast.trigger===timing&&ast.rawText.includes(abilityBody));assert(matching.length===1,`Printed K.O. clause ${index+1} was not isolated to one ${timing} ability`);
   const ast=matching[0],actions=ast.actions.filter(action=>action.kind!=='attach-don-required');
   assert(ast.conditions.length===0&&ast.costs.length===0&&actions.length===1&&actions[0].kind==='ko',`K.O. clause includes other costs, conditions, or actions requiring a dedicated scenario`);
   const action=actions[0];if(!action||action.kind!=='ko')throw new Error('Expected one parsed K.O. action');
   assert(action.maxCost===(field==='cost'?limit:undefined)&&action.maxPower===(field==='power'?limit:undefined)&&action.maxBasePower===(field==='base-power'?limit:undefined)&&Boolean(action.restedOnly)===restedOnly&&action.selection?.min===0&&action.selection.max===amount,'K.O. target limits or optional count do not match printed text');
   const state=base(),boundaryPower=field==='power'?limit!:field==='base-power'?limit!:5000;for(let i=0;i<amount;i++)state.cards.push({id:`at-limit-${i}`,owner:'opponent',zone:'character',type:'Character',cost:field==='cost'?limit:3,power:boundaryPower,powerModifier:field==='base-power'?2000:0,rested:restedOnly});state.cards.push({id:'extra',owner:'opponent',zone:'character',type:'Character',cost:field==='cost'?limit:3,power:boundaryPower,powerModifier:field==='base-power'?2000:0,rested:restedOnly},{id:'over-limit',owner:'opponent',zone:'character',type:'Character',cost:field==='cost'?limit!+1:3,power:field==='power'?limit!+1:field==='base-power'?limit!+1:5000,powerModifier:field==='base-power'?-1000:0,rested:true},{id:'own',owner:'player',zone:'character',type:'Character',cost:limit??1,power:boundaryPower,rested:true},{id:'leader',owner:'opponent',zone:'leader',type:'Leader',cost:limit??1,power:boundaryPower,rested:true});
   const ids=Array.from({length:amount},(_,i)=>`at-limit-${i}`),selected=applyEffectAction(state,'player',action,{targetId:ids[0],cardIds:ids});assert(!selected.error&&!selected.requiresSelection&&ids.every(id=>selected.state.cards.find(card=>card.id===id)?.zone==='trash'),'K.O. failed on the printed boundary targets or count');
   for(const id of [...(field==='none'?[]:['over-limit']),'own','leader',...(restedOnly?['active']:[])]){if(id==='active')state.cards.push({id:'active',owner:'opponent',zone:'character',type:'Character',cost:limit??1,power:boundaryPower,rested:false});const rejected=applyEffectAction(state,'player',action,{targetId:id,cardIds:[id]});assert(Boolean(rejected.error)&&rejected.state.cards.find(card=>card.id===id)?.zone===(id==='leader'?'leader':'character'),`Illegal K.O. target ${id} was accepted`);}
   const skipped=applyEffectAction(state,'player',action,{cardIds:[]});assert(!skipped.error&&!skipped.requiresSelection&&skipped.state.cards.every(card=>card.zone!=='trash'),'Optional K.O. could not be skipped cleanly');
   const tooMany=applyEffectAction(state,'player',action,{cardIds:[...ids,'extra']});assert(Boolean(tooMany.error)&&state.cards.every(card=>card.zone!=='trash'),'K.O. accepted more targets than printed or partially mutated the board');
  }});
 }
 return result;
};
const referencedMainScenarios=(row:Identity):Scenario[]=>{
 const local=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 const triggerText=clean(row.effect_text).match(/\[Trigger\]\s*Activate this card's \[Main\] effect\./i)?.[0];if(!triggerText)return [];
 const main=local.ast.find(ability=>ability.trigger==='main');if(!main||main.conditions.length||main.actions.length!==1||main.costs.some(cost=>cost.kind!=='bottom-deck-trash')||/\bStages?\b/i.test(main.rawText))return [];
 const action=main.actions[0];if(action.kind!=='ko'||!action.selection||action.selection.max==='all')return [];
 const maximum=action.selection.max,trashCost=main.costs.find(cost=>cost.kind==='bottom-deck-trash'),trashAmount=trashCost?.kind==='bottom-deck-trash'?trashCost.amount:0;
 const mainScenario:Scenario={name:`schema-ko main: complete referenced K.O. sequence with ${trashAmount} Trash cost`,run(doc){
  const ability=doc.ast.find(item=>item.trigger==='main');if(!ability)throw new Error('Main K.O. ability is missing');assert(ability.actions.length===1&&ability.actions[0].kind==='ko'&&ability.costs.length===main.costs.length&&ability.costs.every(cost=>cost.kind==='bottom-deck-trash'&&cost.amount===trashAmount),'Main must preserve the complete supported cost and K.O. sequence');
  const ids=Array.from({length:trashAmount},(_,index)=>`main-trash-${index}`),state:MatchEffectState={...base(),cards:[{id:'event',owner:'player',zone:'hand',type:'Event',effectSchema:doc},...ids.map(id=>({id,owner:'player' as const,zone:'trash' as const,type:'Character' as const})),...Array.from({length:2},(_,index)=>({id:`opponent-life-${index}`,owner:'opponent' as const,zone:'life' as const,type:'Character' as const})),{id:'eligible',owner:'opponent',zone:'character',type:'Character',cost:2,power:3000,rested:true},{id:'ineligible',owner:'opponent',zone:'character',type:'Character',cost:3,power:3000,rested:true}]};
  const commands=resolveEffectTiming(doc,'main');assert(commands.status==='ready','Main K.O. sequence is not executable');const started=beginEffectExecution(state,'player','event','main',commands.commands);assert(started.requiresSelection,'Main must offer its optional cost or K.O. target choice');const paid=ids.length?advanceEffectExecution(started.execution,{cardIds:ids}):started;assert(!paid.error&&paid.requiresSelection,'Main must resolve its optional Trash cost before asking for the K.O. target');const resolved=advanceEffectExecution(paid.execution,{cardIds:['eligible'],targetId:'eligible'});assert(resolved.complete&&!resolved.error&&resolved.execution.state.cards.find(card=>card.id==='eligible')?.zone==='trash','Main did not K.O. its eligible target');assert(resolved.execution.state.cards.find(card=>card.id==='ineligible')?.zone==='character','Main K.O.d an ineligible Character');assert(ids.every(id=>resolved.execution.state.cards.find(card=>card.id===id)?.zone==='deck'),'Main did not pay its Trash-to-bottom-deck cost');
  const declined=ids.length?advanceEffectExecution(started.execution,{choice:'decline'}):advanceEffectExecution(started.execution,{cardIds:[]});assert(declined.complete&&!declined.error&&declined.execution.state.cards.find(card=>card.id==='eligible')?.zone==='character'&&ids.every(id=>declined.execution.state.cards.find(card=>card.id===id)?.zone==='trash'),'Skipping the optional Main cost or K.O. still resolved the effect or moved cost cards');
 }};
 const triggerScenario:Scenario={name:`schema-reference trigger: resolve the referenced Main K.O. up to ${maximum}`,run(doc){
  const trigger=doc.ast.find(ability=>ability.trigger==='trigger'&&/Activate this card's \[Main\] effect\./i.test(ability.rawText));
  assert(trigger&&trigger.actions.some(candidate=>candidate.kind==='activate-referenced-effect'&&candidate.trigger==='main'),'Trigger does not reference the Main effect');
  const mainAbility=doc.ast.find(ability=>ability.trigger==='main');if(!mainAbility)throw new Error('Referenced Main K.O. action is missing');assert(mainAbility.actions.length===1&&mainAbility.actions[0].kind==='ko'&&mainAbility.costs.every(cost=>cost.kind==='bottom-deck-trash'),'Referenced Main K.O. action or its complete supported cost sequence is missing');
  const mainResolution=resolveEffectTiming(doc,'main'),triggerResolution=resolveEffectTiming(doc,'trigger');
  assert(mainResolution.status==='ready'&&triggerResolution.status==='ready'&&canonical(mainResolution.commands.map(command=>command.value))===canonical(triggerResolution.commands.map(command=>command.value)),'Trigger did not resolve the exact Main action sequence');
  const ko=mainAbility.actions[0];if(ko.kind!=='ko')throw new Error('Referenced Main K.O. action is missing');const maximum=ko.selection?.max as number,lifeCap=ko.maxCostFromLife==='opponent'?2:ko.maxCostFromLife==='own'?1:ko.maxCost??Infinity;
  const trashIds=Array.from({length:trashAmount},(_,index)=>`trash-cost-${index}`);
  const state:MatchEffectState={...base(),cards:[{id:'event',owner:'player',zone:'life',type:'Event',effectSchema:doc},...trashIds.map(id=>({id,owner:'player' as const,zone:'trash' as const,type:'Character' as const})),...Array.from({length:2},(_,index)=>({id:`opponent-life-${index}`,owner:'opponent' as const,zone:'life' as const,type:'Character' as const})),...Array.from({length:maximum},(_,index)=>({id:`eligible-${index}`,owner:'opponent' as const,zone:'character' as const,type:'Character' as const,cost:Number.isFinite(lifeCap)?lifeCap:3,power:3000,rested:true})),{id:'ineligible',owner:'opponent',zone:'character',type:'Character',cost:Number.isFinite(lifeCap)?lifeCap+1:10,power:3000,rested:true}]};
  const started=beginEffectExecution(state,'player','event','trigger',triggerResolution.commands);assert(started.requiresSelection,'Trigger must pause for its referenced Main cost or target choice');
  const paid=trashIds.length?advanceEffectExecution(started.execution,{cardIds:trashIds}):started;assert(!paid.error&&paid.requiresSelection,'Trigger did not resolve the complete referenced Main cost before its K.O.');
  const ids=Array.from({length:maximum},(_,index)=>`eligible-${index}`),resolved=advanceEffectExecution(paid.execution,{cardIds:ids,targetId:ids[0]});assert(resolved.complete&&!resolved.error,'Trigger-referenced Main effect did not resolve');assert(ids.every(id=>resolved.execution.state.cards.find(card=>card.id===id)?.zone==='trash'),'Trigger failed to apply the Main K.O. to each selected legal target');assert(resolved.execution.state.cards.find(card=>card.id==='ineligible')?.zone==='character','Trigger K.O.d an ineligible Character');assert(trashIds.every(id=>resolved.execution.state.cards.find(card=>card.id===id)?.zone==='deck'),'Trigger did not pay the referenced Main Trash-to-bottom-deck cost');
 }};
 return [mainScenario,triggerScenario];
};
const searchScenarios=(row:Identity):Scenario[]=>{
 const compiled=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 const entries=compiled.ast.flatMap(ability=>ability.actions.filter((action):action is Extract<EffectAction,{kind:'search'}>=>action.kind==='search').map(action=>({ability,action})));
 const lookMatches=[...clean(row.effect_text).matchAll(/look at\s+(?:up to\s+)?(\d+)\s+cards? from the top of your deck/ig)];
 if(entries.length!==1||lookMatches.length!==1)return [];
 const {ability,action}=entries[0],timing=ability.trigger,look=lookMatches[0],amount=Number(look[1]),tail=clean(row.effect_text).slice(look.index??0);
 const subjectMatch=tail.match(/(?:reveal|add)\s+(?:up to\s+)?(\d+)\s+(.+?)\s+(?:and\s+add\s+(?:it|them)\s+to your hand|to your hand)/i);
 if(!subjectMatch)return [];
 const descriptor=subjectMatch[2],subject=descriptor.replace(/other than\s+\[[^\]]+\]/i,'').trim(),excluded=descriptor.match(/other than\s+\[([^\]]+)\]/i)?.[1];
 const cardType=subject.match(/\b(Character|Event|Stage|Leader)\s+cards?\b/i)?.[1];
 const color=subject.replace(/\{[^}]*\}|\[[^\]]*\]|"[^"]*"|'[^']*'/g,' ').match(/\b(red|blue|green|purple|black|yellow)\b/i)?.[1]?.toLowerCase();
 const power=subject.match(/(\d+)\s+power(?:\s+or\s+(less|more))?/i),cost=subject.match(/(?:card|Character|Event|Stage)\s+with a cost of\s+(\d+)(?:\s+or\s+(less|more))?/i);
 const typed=subject.match(/^(.+?)\s+type\b/i),traitNames=[...subject.matchAll(/(?:\{([^}]+)\}|\[([^\]]+)\]|\"([^\"]+)\"|'([^']+)')\s*(?=type\b)/ig)].map(match=>match[1]??match[2]??match[3]??match[4]).concat([...subject.matchAll(/type including\s+[\"']([^\"']+)[\"']/ig)].map(match=>match[1]));
 const directName=subject.match(/^\[([^\]]+)\]\s+or\s+(?:up to\s+\d+\s+)?card with a type including/i)?.[1]??(!typed?(subject.match(/^\[([^\]]+)\]$/)?.[1]??subject.match(/^\"([^\"]+)\"$/)?.[1]):undefined);
 const expectedChoose=Number(subjectMatch[1])+[...descriptor.matchAll(/\bor\s+up to\s+(\d+)\s+/ig)].reduce((sum,match)=>sum+Number(match[1]),0),expectedDestination=/trash the rest/i.test(tail)?'trash':/bottom of your deck/i.test(tail)?'deck-bottom':'hand';
 return [{name:`schema-search ${timing}: top ${amount}, up to ${expectedChoose}, ${expectedDestination}`,run(doc){
  const matching=doc.ast.filter(ast=>ast.trigger===timing&&ast.actions.some(candidate=>candidate.kind==='search'));
  assert(matching.length===1,'Search action was not isolated to one timing window');
  const parsed=matching[0].actions.filter((candidate):candidate is Extract<EffectAction,{kind:'search'}>=>candidate.kind==='search');assert(parsed.length===1,'Expected exactly one search action');
  const rule=parsed[0];assert(rule.amount===amount&&rule.choose===expectedChoose&&rule.destination===expectedDestination,'Search count, selection limit, or remainder destination differs from printed text');
  if(cardType)assert(rule.cardType===cardType||rule.alternatives?.some(part=>part.cardType===cardType),'Search card type differs from printed restriction');
  if(color)assert(rule.color===color||rule.alternatives?.some(part=>part.color===color),'Search color differs from printed restriction');
  if(power){const expected=power[2]?.toLowerCase()==='less'?{maxPower:Number(power[1])}:power[2]?.toLowerCase()==='more'?{minPower:Number(power[1])}:{exactPower:Number(power[1])};for(const [field,value]of Object.entries(expected))assert((rule as unknown as Record<string,unknown>)[field]===value,`Search ${field} differs from printed power restriction`);}
  if(cost){const expected=cost[2]?.toLowerCase()==='less'?{maxCost:Number(cost[1])}:cost[2]?.toLowerCase()==='more'?{minCost:Number(cost[1])}:{exactCost:Number(cost[1])};for(const [field,value]of Object.entries(expected))assert((rule as unknown as Record<string,unknown>)[field]===value,`Search ${field} differs from printed cost restriction`);}
  if(excluded)assert(rule.excludeName===excluded,'Search excluded-name restriction differs from printed text');
  if(directName)assert(rule.name===directName||rule.alternatives?.some(part=>part.name===directName),'Search exact name differs from printed text');
  if(traitNames.length){const parsedTraits=rule.alternatives?.map(part=>part.trait).filter(Boolean)??[rule.trait].filter(Boolean);assert(traitNames.every(trait=>parsedTraits.includes(trait)),'Search trait alternatives differ from printed text');}
  const firstRule=rule.alternatives?.[0]??rule;
  const card=(id:string,overrides:Partial<MatchCard>={},candidateRule=firstRule):MatchCard=>({id,owner:'player',zone:'deck',type:(candidateRule.cardType??rule.cardType??'Character') as MatchCard['type'],name:candidateRule.name??rule.name??'Eligible',traits:candidateRule.trait?[candidateRule.trait]:rule.trait?[rule.trait]:[],color:candidateRule.color??rule.color??'Red',cost:candidateRule.exactCost??candidateRule.maxCost??candidateRule.minCost??rule.exactCost??rule.maxCost??rule.minCost??2,power:candidateRule.exactPower??candidateRule.maxPower??candidateRule.minPower??rule.exactPower??rule.maxPower??rule.minPower??4000,...(rule.triggerOnly?{effectText:'[Trigger] Draw 1 card.'}:{}),...overrides});
  const invalidType=(rule.alternatives?.some(part=>part.cardType==='Event')||rule.cardType==='Event')?'Character':'Event';
  const invalidCost=rule.minCost!==undefined||rule.exactCost!==undefined?0:(rule.maxCost??1)+1,invalidPower=rule.minPower!==undefined||rule.exactPower!==undefined?0:(rule.maxPower??1)+1;
  const deck=Array.from({length:amount+1},(_,index)=>index<expectedChoose?card(`d${index}`,{},rule.alternatives?.[index]??firstRule):card(`d${index}`,index===expectedChoose?{name:'Ineligible',traits:['Ineligible'],color:'Yellow',type:invalidType,cost:invalidCost,power:invalidPower,effectText:''}:{}));
  if(rule.excludeName&&deck[0].name===rule.excludeName)deck[0].name=`Eligible ${row.code}`;
  const state:MatchEffectState={turn:'player',cards:deck,turnEffects:[],restrictions:[],delayed:[]};
  const chosenIds=Array.from({length:expectedChoose},(_,index)=>`d${index}`),valid=applyEffectAction(state,'player',rule,{cardIds:chosenIds,targetId:chosenIds[0]});assert(!valid.error&&!valid.requiresSelection,'Eligible looked-at card was rejected');
  assert(chosenIds.every(id=>valid.state.cards.find(card=>card.id===id)?.zone==='hand'),'Selected search card did not enter hand');
  const remainderZone=rule.destination==='trash'?'trash':'deck';if(expectedChoose<amount)assert(valid.state.cards.find(card=>card.id===`d${expectedChoose}`)?.zone===remainderZone,'Unselected looked-at card went to the wrong destination');
  const outside=applyEffectAction(state,'player',rule,{cardIds:[`d${amount}`],targetId:`d${amount}`});assert(Boolean(outside.error),'Search selected a card outside the looked-at top-card limit');
  const skipped=applyEffectAction(state,'player',rule,{cardIds:[]});assert(!skipped.error&&!skipped.requiresSelection&&skipped.state.cards.every(card=>card.zone!=='hand'),'Search could not choose zero eligible cards');
  assert(Array.from({length:amount},(_,index)=>skipped.state.cards.find(card=>card.id===`d${index}`)).every(card=>card?.zone===remainderZone),'Skipping search did not place every looked-at card in the printed remainder destination');
  if((rule.alternatives?.length||rule.name||rule.trait||rule.color||rule.cardType||rule.minCost!==undefined||rule.maxCost!==undefined||rule.exactCost!==undefined||rule.minPower!==undefined||rule.maxPower!==undefined||rule.exactPower!==undefined||rule.triggerOnly||rule.excludeName)&&expectedChoose<amount){
   const invalid=applyEffectAction(state,'player',rule,{cardIds:[`d${expectedChoose}`],targetId:`d${expectedChoose}`});assert(Boolean(invalid.error)&&invalid.state.cards.every(card=>card.zone==='deck'),'Ineligible search card was accepted or mutated the deck');
  }
 }}];
};
const playScenarios=(row:Identity):Scenario[]=>{
 const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 const entries=document.ast.flatMap(ability=>ability.actions.filter((action):action is Extract<EffectAction,{kind:'play'}>=>action.kind==='play').map(action=>({ability,action})));
 if(entries.length!==1)return [];
 const {ability,action}=entries[0],playIndex=ability.rawText.toLowerCase().lastIndexOf('play up to');if(playIndex<0)return [];
 const clause=ability.rawText.slice(playIndex),match=clause.match(/^play up to\s+(\d+)\s+(.+?)\s+from your (hand|trash|deck)(\s+rested)?/i);if(!match)return [];
 const amount=Number(match[1]),descriptor=match[2].replace(/other than\s+\[[^\]]+\]/i,'').trim(),source=match[3];if(/\bor\b/i.test(descriptor)||source==='deck')return [];
 const type=descriptor.match(/\b(Character|Stage)\s+cards?\b/i)?.[1],unwrapped=descriptor.replace(/\{[^}]*\}|\[[^\]]*\]|"[^"]*"|'[^']*'/g,' '),color=unwrapped.match(/\b(red|blue|green|purple|black|yellow)\b/i)?.[1]?.toLowerCase(),wrapper=descriptor.match(/(?:\{([^}]+)\}|\[([^\]]+)\]|"([^"]+)"|'([^']+)')/),wrapped=wrapper?.[1]??wrapper?.[2]??wrapper?.[3]??wrapper?.[4],trait=wrapped&&(/\btype including\b/i.test(descriptor)||/(?:\}|\])\s*type\b|["']\s*type\b/i.test(descriptor))?wrapped:undefined,name=wrapped&&!trait?wrapped:undefined,attribute=descriptor.match(/\b(Slash|Ranged|Strike|Wisdom|Special) attribute\b/i)?.[1],excluded=descriptor.match(/other than\s+\[([^\]]+)\]/i)?.[1],cost=descriptor.match(/cost of\s+(\d+)(?:\s+or\s+(less|more))?/i),power=descriptor.match(/(\d+)\s+power(?:\s+or\s+(less|more))?/i),expectedCost:Record<string,number>=cost?(cost[2]?.toLowerCase()==='less'?{maxCost:Number(cost[1])}:cost[2]?.toLowerCase()==='more'?{minCost:Number(cost[1])}:{exactCost:Number(cost[1])}):{},expectedPower:Record<string,number>=power?(power[2]?.toLowerCase()==='less'?{maxPower:Number(power[1])}:power[2]?.toLowerCase()==='more'?{minPower:Number(power[1])}:{exactPower:Number(power[1])}):{},rested=Boolean(match[4]);
 return [{name:`schema-play ${ability.trigger}: ${source} up to ${amount}${rested?' rested':''}`,run(doc){
  const found=doc.ast.filter(ast=>ast.trigger===ability.trigger).flatMap(ast=>ast.actions.filter((candidate):candidate is Extract<EffectAction,{kind:'play'}>=>candidate.kind==='play'));assert(found.length===1,'Play action was not isolated to one timing window');const rule=found[0];
  assert(rule.source===source&&rule.amount===amount&&Boolean(rule.rested)===rested,'Play source, count, or rested state differs from printed text');
  if(type)assert(rule.cardType===type,'Play card type differs from printed restriction');if(trait)assert(rule.trait===trait||rule.alternatives?.some(part=>part.trait===trait),'Play trait differs from printed restriction');if(name)assert(rule.name===name||rule.alternatives?.some(part=>part.name===name),'Play exact name differs from printed restriction');if(color)assert(rule.color===color||rule.alternatives?.some(part=>part.color===color),'Play color differs from printed restriction');if(attribute)assert(rule.attribute===attribute||rule.alternatives?.some(part=>part.attribute===attribute),'Play attribute differs from printed restriction');if(excluded)assert(rule.excludeName===excluded,'Play excluded-name differs from printed restriction');for(const [field,value]of Object.entries({...expectedCost,...expectedPower}))assert((rule as unknown as Record<string,unknown>)[field]===value,`Play ${field} differs from printed restriction`);if(/no base effect/i.test(descriptor))assert(rule.noBaseEffect,'Play no-base-effect restriction was lost');
  const first=rule.alternatives?.[0]??rule,firstLimits=first as typeof rule,zone=source as MatchCard['zone'],candidate=(id:string,owner:'player'|'opponent'='player',overrides:Partial<MatchCard>={}):MatchCard=>({id,owner,zone,type:first.cardType??rule.cardType??'Character',name:first.name??rule.name??'Eligible',traits:first.trait||rule.trait?[first.trait??rule.trait!]:[],color:first.color??rule.color??'Red',attributes:first.attribute||rule.attribute?[first.attribute??rule.attribute!]:[],cost:firstLimits.exactCost??firstLimits.maxCost??firstLimits.minCost??rule.exactCost??rule.maxCost??rule.minCost??0,power:firstLimits.exactPower??firstLimits.maxPower??firstLimits.minPower??rule.exactPower??rule.maxPower??rule.minPower??4000,effectText:rule.noBaseEffect?'':'[On Play] Draw 1 card.',...overrides});
  const legal=Array.from({length:amount},(_,index)=>candidate(`play-${index}`)),invalid=candidate('invalid','player',{type:rule.cardType==='Character'?'Event':'Character',name:rule.excludeName??'Ineligible',traits:[],color:'Yellow',attributes:[],cost:rule.minCost!==undefined||rule.exactCost!==undefined?0:(rule.maxCost??0)+1,power:rule.minPower!==undefined||rule.exactPower!==undefined?0:(rule.maxPower??0)+1,effectText:rule.noBaseEffect?'[On Play] Draw 1 card.':''}),initial=base(),state:MatchEffectState={...initial,cards:[...initial.cards,...legal,invalid]};
  const resolved=applyEffectAction(state,'player',rule,{cardIds:legal.map(card=>card.id),targetId:legal[0]?.id});assert(!resolved.error&&!resolved.requiresSelection,'Legal play choice was rejected');assert(legal.every(card=>resolved.state.cards.find(item=>item.id===card.id)?.zone===(card.type==='Stage'?'stage':'character')),'Selected card was not played to its correct area');assert(legal.every(card=>Boolean(resolved.state.cards.find(item=>item.id===card.id)?.rested)===rested),'Rested play state differs from printed instruction');
  const skipped=applyEffectAction(state,'player',rule,{cardIds:[]});assert(!skipped.error&&skipped.state.cards.every(card=>card.zone===state.cards.find(item=>item.id===card.id)?.zone),'Optional play skip changed card zones');if(rule.cardType||rule.name||rule.trait||rule.color||rule.attribute||rule.maxCost!==undefined||rule.minCost!==undefined||rule.exactCost!==undefined||rule.maxPower!==undefined||rule.minPower!==undefined||rule.exactPower!==undefined||rule.noBaseEffect||rule.excludeName){const rejected=applyEffectAction(state,'player',rule,{cardIds:[invalid.id],targetId:invalid.id});assert(Boolean(rejected.error)&&rejected.state.cards.every(card=>card.zone===state.cards.find(item=>item.id===card.id)?.zone),'Ineligible play card was accepted or mutated the board');}
  const wrongOwner=candidate('enemy-choice','opponent');const foreign=applyEffectAction({...state,cards:[...state.cards,wrongOwner]},'player',rule,{cardIds:[wrongOwner.id],targetId:wrongOwner.id});assert(Boolean(foreign.error),'Opponent-owned card was accepted for play');
 }}];
};
const turnLifeCostScenarios=(row:Identity):Scenario[]=>{
 const timingNames:Record<string,EffectTrigger>={'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block','end of your turn':'end-turn'};
 const matches=[...clean(row.effect_text).matchAll(/\[(On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|End of Your Turn)\]([\s\S]*?)(?=\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|End of Your Turn)\]|$)/ig)].flatMap(match=>[...match[2].matchAll(/You may turn\s+(\d+) cards? from the top of your Life(?: cards?)? face-up:/ig)].map(costMatch=>({timingLabel:match[1],amount:Number(costMatch[1])})));if(!matches.length)return [];
 return matches.flatMap(({timingLabel,amount})=>{const timing=timingNames[timingLabel.toLowerCase()];const basic:Scenario={name:`schema-turn-life-cost ${timing}: reveal top ${amount} Life card${amount===1?'':'s'} before effect`,run(doc){
  const ability=doc.ast.filter(ast=>ast.trigger===timing&&ast.costs.some(cost=>cost.kind==='turn-life'));assert(ability.length===1,`Expected one ${timing} ability with a Life-turn cost`);const costs=ability[0].costs.filter((cost):cost is Extract<EffectCost,{kind:'turn-life'}>=>cost.kind==='turn-life');assert(costs.length===1,`Expected one Life-turn cost in ${timing}`);const cost=costs[0];assert(cost.scope==='own'&&cost.amount===amount&&cost.position==='top'&&cost.faceUp&&cost.optional,'Printed Life-turn cost differs from schema');
  const state=base();state.cards.push(...Array.from({length:4},(_,i)=>({id:`life-${i}`,owner:'player' as const,zone:'life' as const,type:'Character' as const,faceUp:false})));const paid=payEffectCost(state,'player',cost);assert(!paid.error&&!paid.requiresSelection,'Legal face-up Life payment failed');for(let i=0;i<4;i++)assert(Boolean(paid.state.cards.find(card=>card.id===`life-${i}`)?.faceUp)===(i<amount),`Life card ${i} has the wrong face-up state`);
  const short={...state,cards:state.cards.filter(card=>card.owner!=='player'||card.zone!=='life').concat(Array.from({length:Math.max(0,amount-1)},(_,i)=>({id:`short-life-${i}`,owner:'player' as const,zone:'life' as const,type:'Character' as const,faceUp:false})))},rejected=payEffectCost(short,'player',cost);assert(Boolean(rejected.error)&&rejected.state.cards.every(card=>!card.faceUp),'Insufficient Life did not reject without mutation');
  const normalized=doc.normalized.filter(effect=>effect.timing===timing&&effect.sequence.some(step=>step.type==='PAY_COST'&&step.cost.kind==='turn-life'));assert(normalized.length===1&&normalized[0].sequence.findIndex(step=>step.type==='PAY_COST'&&step.cost.kind==='turn-life')<normalized[0].sequence.findIndex(step=>step.type==='RESOLVE'),'Life cost must resolve before effect actions');
 }};const result=[basic];
  // OP08-058 pays by revealing two Life cards, then adds a rested DON!! from
  // the DON!! deck. Verify that combined sequence as a whole before allowing
  // a published timing-window repair.
  if(row.code==='OP08-058'&&timing==='when-attacking')result.push({name:'schema-turn-life-cost-add-don when-attacking: add one rested DON!!',run(doc){
   const ability=doc.ast.filter(ast=>ast.trigger===timing);assert(ability.length===1&&ability[0].costs.length===1&&ability[0].costs[0].kind==='turn-life'&&ability[0].actions.length===1,'Life payment and DON!! addition must be one isolated ability');
   const add=ability[0].actions[0];assert(add.kind==='add-don'&&add.amount===1&&add.rested&&add.selection?.min===0&&add.selection.max===1,'OP08-058 must offer an optional choice of up to one rested DON!!');
   const state=base();state.cards.push(...Array.from({length:2},(_,i)=>({id:`life-${i}`,owner:'player' as const,zone:'life' as const,type:'Character' as const,faceUp:false})),{id:'don-available',owner:'player',zone:'don-deck',type:'DON!!'});
   const paid=payEffectCost(state,'player',ability[0].costs[0]);assert(!paid.error&&!paid.requiresSelection,'The printed Life payment failed');
   const prompt=applyEffectAction(paid.state,'player',add);assert(!prompt.error&&prompt.requiresSelection,'The optional DON!! choice must prompt when a DON!! is available');
   const added=applyEffectAction(paid.state,'player',add,{cardIds:['don-available']});assert(!added.error&&!added.requiresSelection,'The rested DON!! addition failed');const don=added.state.cards.find(card=>card.id==='don-available');assert(don?.zone==='cost-area'&&don.rested===true,'The added DON!! must enter the cost area rested');
   const skipped=applyEffectAction(paid.state,'player',add,{cardIds:[]});assert(!skipped.error&&skipped.state.cards.find(card=>card.id==='don-available')?.zone==='don-deck','Skipping the optional addition changed the DON!! deck');
  }});
  return result;
 });
};

const simpleDrawScenarios=(row:Identity):Scenario[]=>{
 const timingNames:Record<string,EffectTrigger>={'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block','end of your turn':'end-turn'};
 const timingPattern='On Play|When Attacking|Activate\\s*:\\s*Main|Main|Counter|Trigger|On K\\.O\\.|On Block|End of Your Turn';
 const windows=[...clean(row.effect_text).matchAll(new RegExp(`\\[(${timingPattern})\\]([\\s\\S]*?)(?=\\[(?:${timingPattern})\\]|$)`,'ig'))];
 const parsed=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 return windows.flatMap(match=>{const timing=timingNames[match[1].toLowerCase()],draws=[...match[2].matchAll(/\bDraw\s+(a|one|\d+)\s+cards?\b/ig)].map(draw=>(/^(?:a|one)$/i.test(draw[1])?1:Number(draw[1])));if(!timing||!draws.length)return [];const printed=parsed.ast.filter(ast=>ast.trigger===timing&&ast.rawText.includes(match[1])&&/\bDraw\s+(?:a|one|\d+)\s+cards?\b/i.test(ast.rawText));if(printed.length!==1)return [];return [{name:`schema-draw ${timing}: printed counts ${draws.join('+')}`,run(doc:EffectDocument){
  const abilities=doc.ast.filter(ast=>ast.trigger===timing&&ast.rawText.includes(match[1])&&/\bDraw\s+(?:a|one|\d+)\s+cards?\b/i.test(ast.rawText));assert(abilities.length===1,`Expected one ${timing} ability containing the printed draw`);const ability=abilities[0],drawActions=ability.actions.filter((action):action is Extract<EffectAction,{kind:'draw'}>=>action.kind==='draw');assert(canonical(drawActions.map(action=>action.amount))===canonical(draws),'Draw action count or amount differs from printed text');
  const normalizedDraws=doc.normalized.filter(effect=>effect.timing===timing).flatMap(effect=>effect.sequence.filter((step):step is Extract<typeof step,{type:'RESOLVE'}>&{action:Extract<EffectAction,{kind:'draw'}>}=>step.type==='RESOLVE'&&step.action.kind==='draw').map(step=>step.action.amount));assert(canonical(normalizedDraws)===canonical(draws),'Normalized draw actions differ from the printed draw sequence');
  const amount=drawActions.reduce((sum,action)=>sum+action.amount,0),state=base();state.cards=[...Array.from({length:amount+2},(_,index)=>({id:`own-deck-${index}`,owner:'player' as const,zone:'deck' as const,type:'Character' as const})),...Array.from({length:amount+1},(_,index)=>({id:`op-deck-${index}`,owner:'opponent' as const,zone:'deck' as const,type:'Character' as const})),{id:'existing-hand',owner:'player',zone:'hand',type:'Character'}];let after=state;for(const action of drawActions){const result=applyEffectAction(after,'player',action);assert(!result.error&&!result.requiresSelection,'Draw action failed to resolve');after=result.state;}for(let index=0;index<amount+2;index++)assert(after.cards.find(card=>card.id===`own-deck-${index}`)?.zone===(index<amount?'hand':'deck'),'Draw did not move exactly the top cards to hand');assert(after.cards.find(card=>card.id==='existing-hand')?.zone==='hand','Draw disturbed the existing hand');assert(after.cards.filter(card=>card.owner==='opponent'&&card.zone==='deck').length===amount+1,'Draw changed the opponent deck');
 }}];});
};

const conditionalMulticolorDrawScenarios=(row:Identity):Scenario[]=>{
 const clauses=[...clean(row.effect_text).matchAll(/\[(On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|End of Your Turn)\]\s*If your Leader is multicolored,\s*draw\s+(a|one|\d+)\s+cards?\.?/ig)];
 const local=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 return clauses.flatMap(clause=>{
  const label=clause[1],timing=({'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block','end of your turn':'end-turn'} as Record<string,EffectTrigger>)[label.toLowerCase()],amount=/^(?:a|one)$/i.test(clause[2])?1:Number(clause[2]);
  if(!timing)return [];
  const localAbilities=local.ast.filter(ast=>ast.trigger===timing&&ast.rawText.includes(clause[0]));
  if(localAbilities.length!==1||localAbilities[0].conditions.length!==1||!/^your Leader is multicolored$/i.test(localAbilities[0].conditions[0].text)||localAbilities[0].costs.length!==0||localAbilities[0].actions.length!==1||localAbilities[0].actions[0].kind!=='draw'||localAbilities[0].actions[0].amount!==amount)return [];
  return [{name:`schema-conditional-draw ${timing}: multicolored Leader gate and draw ${amount}`,run(doc){
  const matches=doc.ast.filter(ast=>ast.trigger===timing&&ast.rawText.includes(clause[0]));
  assert(matches.length===1,'Conditional draw was not isolated to one timing');
  const ability=matches[0],draws=ability.actions.filter((action):action is Extract<EffectAction,{kind:'draw'}>=>action.kind==='draw');
  assert(ability.conditions.length===1&&/^your Leader is multicolored$/i.test(ability.conditions[0].text)&&ability.costs.length===0&&ability.actions.length===1&&draws.length===1&&draws[0].amount===amount,'Conditional draw schema includes an incorrect condition, cost, or extra action');
  const normalized=doc.normalized.filter(effect=>effect.timing===timing);
  assert(normalized.length===1&&normalized[0].conditions.length===1&&/^your Leader is multicolored$/i.test(normalized[0].conditions[0].text)&&normalized[0].sequence.length===1&&normalized[0].sequence[0].type==='RESOLVE'&&normalized[0].sequence[0].action.kind==='draw'&&normalized[0].sequence[0].action.amount===amount,'Conditional draw normalized sequence differs from the printed clause');
  const multicolor=base();multicolor.cards.push({id:'leader',owner:'player',zone:'leader',type:'Leader',color:'red blue'},...Array.from({length:amount+1},(_,index)=>({id:`trigger-deck-${index}`,owner:'player' as const,zone:'deck' as const,type:'Character' as const})));const resolved=beginEffectExecution(multicolor,'player','source',timing,resolveEffectTiming(doc,timing).commands);assert(resolved.complete&&!resolved.error&&resolved.execution.state.cards.filter(card=>card.owner==='player'&&card.zone==='hand').length===amount,'Multicolored Leader should resolve the printed draw');
  const mono=base();mono.cards.push({id:'leader',owner:'player',zone:'leader',type:'Leader',color:'red'},...Array.from({length:amount+1},(_,index)=>({id:`mono-deck-${index}`,owner:'player' as const,zone:'deck' as const,type:'Character' as const})));const skipped=beginEffectExecution(mono,'player','source',timing,resolveEffectTiming(doc,timing).commands);assert(skipped.complete&&!skipped.error&&skipped.execution.state.cards.every(card=>card.zone===mono.cards.find(original=>original.id===card.id)?.zone),'Single-color Leader must fail the condition without moving cards');
 }}];
 });
};

const lifeToHandScenarios=(row:Identity):Scenario[]=>{
 const matches=[...clean(row.effect_text).matchAll(/\[(On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|End of Your Turn)\]\s*Add\s+(\d+)\s+cards? from the top of your Life cards? to your hand\.?/ig)];
 if(matches.length!==1)return [];
 const timing=({'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block','end of your turn':'end-turn'} as Record<string,EffectTrigger>)[matches[0][1].toLowerCase()],amount=Number(matches[0][2]);
 if(!timing)return [];
 return [{name:`schema-life-to-hand ${timing}: move top ${amount} Life card${amount===1?'':'s'} to hand`,run(doc){
  const abilities=doc.ast.filter(ast=>ast.trigger===timing&&ast.actions.some(action=>action.kind==='life'&&action.operation==='add-to-hand'));
  assert(abilities.length===1,'Life-to-hand action was not isolated to one timing window');
  const ability=abilities[0],actions=ability.actions.filter((action):action is Extract<EffectAction,{kind:'life'}>=>action.kind==='life');
  assert(actions.length===1&&actions[0].operation==='add-to-hand'&&actions[0].amount===amount,'Life-to-hand action, amount, or sequence differs from printed text');
  assert(ability.conditions.length===0&&ability.costs.length===0&&ability.actions.length===1,'Life-to-hand text includes additional conditions, costs, or actions');
  const normalized=doc.normalized.filter(effect=>effect.timing===timing&&effect.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind==='life'&&step.action.operation==='add-to-hand'));
  assert(normalized.length===1&&normalized[0].sequence.length===1,'Life-to-hand action is not isolated in normalized sequence');
  const state=base();state.cards.push(...Array.from({length:amount+2},(_,i)=>({id:`life-${i}`,owner:'player' as const,zone:'life' as const,type:'Character' as const})),{id:'opponent-life',owner:'opponent',zone:'life',type:'Character'});
  const result=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);
  assert(result.complete&&!result.error,'Life-to-hand effect did not complete');
  for(let i=0;i<amount+2;i++)assert(result.execution.state.cards.find(card=>card.id===`life-${i}`)?.zone===(i<amount?'hand':'life'),`Life card ${i} moved to the wrong zone`);
  assert(result.execution.state.cards.find(card=>card.id==='opponent-life')?.zone==='life','Effect moved opponent Life');
 }}];
};

const trashLifeScenarios=(row:Identity):Scenario[]=>{
 const matches=[...clean(row.effect_text).matchAll(/\[(On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|End of Your Turn)\]\s*Trash up to\s+(\d+)\s+cards? from the top of your opponent's Life cards?\.?/ig)];
 if(matches.length!==1)return [];
 const timing=({'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block','end of your turn':'end-turn'} as Record<string,EffectTrigger>)[matches[0][1].toLowerCase()],amount=Number(matches[0][2]);if(!timing)return [];
 const compiled=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text}),candidate=compiled.ast.filter(ast=>ast.trigger===timing&&ast.actions.some(action=>action.kind==='trash-life'&&action.scope==='opponent'));
 if(candidate.length!==1||candidate[0].conditions.length||candidate[0].costs.length||candidate[0].actions.some(action=>action.kind!=='trash-life'&&!(candidate[0].trigger==='on-ko'&&action.kind==='on-ko')))return [];
 return [{name:`schema-trash-life ${timing}: optionally trash up to ${amount} top opponent Life`,run(doc){
  const abilities=doc.ast.filter(ast=>ast.trigger===timing&&ast.actions.some(action=>action.kind==='trash-life'&&action.scope==='opponent'));
  assert(abilities.length===1&&abilities[0].conditions.length===0&&abilities[0].costs.length===0&&abilities[0].actions.every(action=>action.kind==='trash-life'||(timing==='on-ko'&&action.kind==='on-ko')),'Optional Life trash must be isolated from other effect instructions');
  const action=abilities[0].actions.find((item):item is Extract<EffectAction,{kind:'trash-life'}>=>item.kind==='trash-life');assert(action?.scope==='opponent'&&action.amount===amount&&action.selection?.min===0&&action.selection.max===amount,'Optional Life-trash amount, owner, or skip option differs from printed text');
  const normalized=doc.normalized.filter(effect=>effect.timing===timing&&effect.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind==='trash-life'));
  assert(normalized.length===1&&normalized[0].sequence.every(step=>step.type==='RESOLVE'&&(step.action.kind==='trash-life'||(timing==='on-ko'&&step.action.kind==='on-ko'))),'Optional Life trash is not isolated in normalized sequence');
  const state=base();state.cards.push(...Array.from({length:amount+1},(_,index)=>({id:`op-life-${index}`,owner:'opponent' as const,zone:'life' as const,type:'Character' as const})),{id:'own-life',owner:'player',zone:'life',type:'Character'});
  const waiting=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);assert(!waiting.complete&&waiting.requiresSelection,'Optional Life trash did not ask for a choice');
  const skipped=advanceEffectExecution(waiting.execution,{choice:'0'});assert(skipped.complete&&!skipped.error&&skipped.execution.state.cards.every(card=>card.zone===state.cards.find(item=>item.id===card.id)?.zone),'Choosing zero Life cards changed the board');
  const count=Math.min(amount,2),resolved=advanceEffectExecution(waiting.execution,{choice:String(count)});assert(resolved.complete&&!resolved.error,'Selected Life trash count was rejected');for(let index=0;index<amount+1;index++)assert(resolved.execution.state.cards.find(card=>card.id===`op-life-${index}`)?.zone===(index<count?'trash':'life'),'Life trash did not remove exactly the selected number from the top');assert(resolved.execution.state.cards.find(card=>card.id==='own-life')?.zone==='life','Opponent Life effect changed your Life');
  const invalid=advanceEffectExecution(waiting.execution,{choice:String(amount+1)});assert(Boolean(invalid.error)&&invalid.execution.state.cards.every(card=>card.zone===state.cards.find(item=>item.id===card.id)?.zone),'Over-limit Life trash was accepted or mutated the board');
 }}];
};

const handTrashCostScenarios=(row:Identity):Scenario[]=>{
 const timingNames:Record<string,EffectTrigger>={'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block','end of your turn':'end-turn'};
 const timingPattern='On Play|When Attacking|Activate\\s*:\\s*Main|Main|Counter|Trigger|On K\\.O\\.|On Block|End of Your Turn';
 const windows=[...clean(row.effect_text).matchAll(new RegExp(`\\[(${timingPattern})\\]([\\s\\S]*?)(?=\\[(?:${timingPattern})\\]|$)`,'ig'))];
 const parsed=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 return windows.flatMap(match=>{const timing=timingNames[match[1].toLowerCase()],clauses=[...match[2].matchAll(/((?:You may\s+)?trash\s+(\d+)\s+[^.:]*?\bfrom your hand)\s*:/ig)];if(!timing||!clauses.length)return [];return clauses.flatMap(clause=>{const amount=Number(clause[2]),optional=/^\s*You may\s+trash/i.test(clause[1]),abilities=parsed.ast.filter(ast=>ast.trigger===timing&&ast.rawText.includes(match[1])&&ast.costs.some(cost=>cost.kind==='trash'&&cost.scope==='hand'));if(abilities.length!==1||abilities[0].costs.filter(cost=>cost.kind==='trash'&&cost.scope==='hand').length!==1)return [];return [{name:`schema-hand-trash-cost ${timing}: choose ${amount} from hand${optional?' (optional)':''}`,run(doc:EffectDocument){
  const ability=doc.ast.filter(ast=>ast.trigger===timing&&ast.rawText.includes(match[1])&&ast.costs.some(cost=>cost.kind==='trash'&&cost.scope==='hand'));assert(ability.length===1,'Hand-trash cost was not isolated to one timing window');const cost=ability[0].costs.find((item):item is Extract<EffectCost,{kind:'trash'}>=>item.kind==='trash'&&item.scope==='hand');if(!cost)throw new Error('Hand-trash cost is missing');assert(cost.amount===amount&&cost.optional===optional,'Hand-trash amount or optionality differs from printed text');
  const normalized=doc.normalized.filter(effect=>effect.timing===timing&&effect.sequence.some(step=>step.type==='PAY_COST'&&step.cost.kind==='trash'&&step.cost.scope==='hand'));assert(normalized.length===1,'Hand-trash payment was not represented in the normalized timing window');const costIndex=normalized[0].sequence.findIndex(step=>step.type==='PAY_COST'&&step.cost.kind==='trash'&&step.cost.scope==='hand'),resolveIndex=normalized[0].sequence.findIndex(step=>step.type==='RESOLVE');assert(resolveIndex<0||costIndex<resolveIndex,'Hand-trash cost must be paid before its effect');
  const state=base(),eligible=Array.from({length:amount+1},(_,index)=>({id:`hand-${index}`,owner:'player' as const,zone:'hand' as const,type:cost.cardType??'Character' as const,color:cost.color,traits:cost.trait?[cost.trait]:[],cost:cost.maxCost??1,effectText:cost.requiresTrigger?'[Trigger]':''}));state.cards.push(...eligible,{id:'enemy-hand',owner:'opponent',zone:'hand',type:'Character'});const asked=payEffectCost(state,'player',cost);assert(Boolean(asked.requiresSelection)&&!asked.error,'Payment did not ask the player to choose hand cards');
  const chosen=eligible.slice(0,amount).map(card=>card.id),paid=payEffectCost(state,'player',cost,{cardIds:chosen});assert(!paid.error&&!paid.requiresSelection&&chosen.every(id=>paid.state.cards.find(card=>card.id===id)?.zone==='trash'),'Chosen hand cards were not trashed as payment');assert(paid.state.cards.find(card=>card.id===`hand-${amount}`)?.zone==='hand'&&paid.state.cards.find(card=>card.id==='enemy-hand')?.zone==='hand','Unchosen or opponent hand cards were changed');
  const underpaid=payEffectCost(state,'player',cost,{cardIds:chosen.slice(0,Math.max(0,amount-1))});assert(Boolean(underpaid.error)&&canonical(underpaid.state.cards)===canonical(state.cards),'Underpaid cost was accepted or mutated state');const opponentPayment=payEffectCost(state,'player',cost,{cardIds:[...chosen.slice(0,Math.max(0,amount-1)),'enemy-hand']});assert(Boolean(opponentPayment.error)&&canonical(opponentPayment.state.cards)===canonical(state.cards),'Opponent hand card was accepted or mutated state');
 }}];});});
};

const returnDonCostScenarios=(row:Identity):Scenario[]=>{
 const timingNames:Record<string,EffectTrigger>={'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block',"on your opponent's attack":'opponent-attack','end of your turn':'end-turn'};
 const timingPattern="On Play|When Attacking|Activate\\s*:\\s*Main|Main|Counter|Trigger|On K\\.O\\.|On Block|On Your Opponent's Attack|End of Your Turn";
 const windows=[...clean(row.effect_text).matchAll(new RegExp(`\\[(${timingPattern})\\]([\\s\\S]*?)(?=\\[(?:${timingPattern})\\]|$)`,'ig'))];
 const parsed=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 return windows.flatMap(match=>{const timing=timingNames[match[1].toLowerCase()],costs=[...match[2].matchAll(/DON!!\s*[−-]\s*(\d+)(?:\s*\([^)]*\))?\s*:/ig)];if(!timing||!costs.length)return [];return costs.flatMap(printed=>{const amount=Number(printed[1]),abilities=parsed.ast.filter(ast=>ast.trigger===timing&&ast.actions.some(action=>action.kind==='return-don'&&(action.owner??'self')==='self')||ast.trigger===timing&&ast.costs.some(cost=>cost.kind==='return-don'));if(abilities.length!==1||abilities[0].costs.filter(cost=>cost.kind==='return-don').length!==1)return [];return [{name:`schema-return-don-cost ${timing}: return ${amount} DON!!`,run(doc:EffectDocument){
  const ability=doc.ast.filter(ast=>ast.trigger===timing&&ast.costs.some(cost=>cost.kind==='return-don'));assert(ability.length===1,'DON!! return cost was not isolated to one timing window');const cost=ability[0].costs.find((item):item is Extract<EffectCost,{kind:'return-don'}>=>item.kind==='return-don');if(!cost)throw new Error('DON!! return cost is missing');assert(cost.amount===amount&&!cost.optional,'Printed DON!! return count or mandatory cost flag differs from schema');
  const normalized=doc.normalized.filter(effect=>effect.timing===timing&&effect.sequence.some(step=>step.type==='PAY_COST'&&step.cost.kind==='return-don'));assert(normalized.length===1,'DON!! return payment was not represented in the normalized timing window');const costIndex=normalized[0].sequence.findIndex(step=>step.type==='PAY_COST'&&step.cost.kind==='return-don'),resolveIndex=normalized[0].sequence.findIndex(step=>step.type==='RESOLVE');assert(resolveIndex<0||costIndex<resolveIndex,'DON!! must return before the effect resolves');
  const state=base(),own=Array.from({length:amount+1},(_,index)=>({id:`own-don-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:index===1,attachedTo:index===2?'source':undefined}));state.cards.push(...own,{id:'opponent-don',owner:'opponent',zone:'cost-area',type:'DON!!'});const asked=payEffectCost(state,'player',cost);assert(Boolean(asked.requiresSelection)&&!asked.error,'DON!! payment did not request an exact selection');
  const ids=own.slice(0,amount).map(card=>card.id),paid=payEffectCost(state,'player',cost,{cardIds:ids});assert(!paid.error&&!paid.requiresSelection&&ids.every(id=>paid.state.cards.find(card=>card.id===id)?.zone==='don-deck'&&!paid.state.cards.find(card=>card.id===id)?.rested&&!paid.state.cards.find(card=>card.id===id)?.attachedTo),'Selected DON!! did not return to the DON!! deck');assert(paid.state.cards.find(card=>card.id===`own-don-${amount}`)?.zone==='cost-area'&&paid.state.cards.find(card=>card.id==='opponent-don')?.zone==='cost-area','Unselected or opponent DON!! changed zones');
  for(const invalid of [ids.slice(0,Math.max(0,amount-1)),[...ids.slice(0,Math.max(0,amount-1)),'opponent-don'],amount>1?Array.from({length:amount},()=>ids[0]):[]]){const rejected=payEffectCost(state,'player',cost,{cardIds:invalid});assert(Boolean(rejected.error||rejected.requiresSelection)&&canonical(rejected.state.cards)===canonical(state.cards),'Underpaid, foreign, or duplicate DON!! payment mutated state');}
 }}];});});
};

const readyDonScenarios=(row:Identity):Scenario[]=>{
 const timingNames:Record<string,EffectTrigger>={'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block',"on your opponent's attack":'opponent-attack','end of your turn':'end-turn'};
 const timingPattern="On Play|When Attacking|Activate\\s*:\\s*Main|Main|Counter|Trigger|On K\\.O\\.|On Block|On Your Opponent's Attack|End of Your Turn";
 const windows=[...clean(row.effect_text).matchAll(new RegExp(`\\[(${timingPattern})\\]([\\s\\S]*?)(?=\\[(?:${timingPattern})\\]|$)`,'ig'))];
 const parsed=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 return windows.flatMap(match=>{const timing=timingNames[match[1].toLowerCase()],printed=match[2].match(/set up to (\d+) of your DON!! cards? as active/ig);if(!timing||!printed?.length)return [];const amounts=[...match[2].matchAll(/set up to (\d+) of your DON!! cards? as active/ig)].map(value=>Number(value[1]));if(amounts.length!==1)return [];const amount=amounts[0],abilities=parsed.ast.filter(ast=>ast.trigger===timing&&ast.actions.some(action=>action.kind==='ready'&&action.scope==='own-don'));if(abilities.length!==1)return [];return [{name:`schema-ready-don ${timing}: choose up to ${amount} rested DON!!`,run(doc:EffectDocument){
  const ability=doc.ast.filter(ast=>ast.trigger===timing&&ast.actions.some(action=>action.kind==='ready'&&action.scope==='own-don'));assert(ability.length===1,'Ready-DON action was not isolated to one timing window');const action=ability[0].actions.find((item):item is Extract<EffectAction,{kind:'ready'}>=>item.kind==='ready'&&item.scope==='own-don');if(!action)throw new Error('Ready-DON action is missing');assert(action.amount===amount&&action.selection?.min===0&&action.selection.max===amount,'Ready-DON amount or optional selection cap differs from printed text');
  const normalized=doc.normalized.filter(effect=>effect.timing===timing&&effect.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind==='ready'&&step.action.scope==='own-don'));assert(normalized.length===1,'Ready-DON action is missing from normalized timing');const step=normalized[0].sequence.find((item):item is Extract<typeof item,{type:'RESOLVE'}>=>item.type==='RESOLVE'&&item.action.kind==='ready'&&item.action.scope==='own-don');assert(step?.action.kind==='ready'&&step.action.amount===amount&&step.action.selection?.max===amount,'Normalized Ready-DON action differs from the printed cap');
  const state=base(),legal=Array.from({length:amount+1},(_,index)=>({id:`rested-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:true}));state.cards.push(...legal,{id:'active-don',owner:'player',zone:'cost-area',type:'DON!!',rested:false},{id:'attached-don',owner:'player',zone:'cost-area',type:'DON!!',rested:true,attachedTo:'leader'},{id:'enemy-don',owner:'opponent',zone:'cost-area',type:'DON!!',rested:true},{id:'rested-character',owner:'player',zone:'character',type:'Character',rested:true});const chosen=legal.slice(0,amount).map(card=>card.id),readied=applyEffectAction(state,'player',action,{cardIds:chosen});assert(!readied.error&&!readied.requiresSelection&&chosen.every(id=>readied.state.cards.find(card=>card.id===id)?.rested===false),'Selected rested DON!! were not readied');assert(readied.state.cards.find(card=>card.id===`rested-${amount}`)?.rested===true&&readied.state.cards.find(card=>card.id==='active-don')?.rested===false,'Unselected DON!! were changed');
  for(const id of ['active-don','attached-don','enemy-don','rested-character']){const rejected=applyEffectAction(state,'player',action,{cardIds:[id]});assert(Boolean(rejected.error)&&canonical(rejected.state.cards)===canonical(state.cards),`Illegal ready target ${id} mutated state`);}const skipped=applyEffectAction(state,'player',action,{cardIds:[]});assert(!skipped.error&&skipped.state.cards.every(card=>card.rested===state.cards.find(item=>item.id===card.id)?.rested),'Optional Ready-DON choice could not be skipped');const over=applyEffectAction(state,'player',action,{cardIds:Array.from({length:amount+1},(_,index)=>`rested-${index}`)});assert(Boolean(over.error)&&canonical(over.state.cards)===canonical(state.cards),'Ready-DON accepted more than the printed maximum');
 }}];});
};

const readyDonNamedAllyGateScenarios=(row:Identity):Scenario[]=>{
 const compiled=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 return compiled.ast.flatMap(ability=>{
  const condition=ability.conditions.find(item=>/you have no other \[[^\]]+\] Characters?/i.test(item.text)),match=condition?.text.match(/you have no other \[([^\]]+)\] Characters?/i),action=ability.actions.find((item):item is Extract<EffectAction,{kind:'ready'}>=>item.kind==='ready'&&item.scope==='own-don');
  if(!condition||!match||!match[1]||!action||action.amount===undefined)return [];
  const name=match[1],timing=ability.trigger,amount=action.amount;
  return [{name:`schema-ready-don-gate ${timing}: exclude source from no-other ${name} condition`,run(doc){
   const nodes=doc.ast.filter(ast=>ast.trigger===timing&&ast.actions.some(item=>item.kind==='ready'&&item.scope==='own-don'));
   assert(nodes.length===1,'Conditional Ready-DON ability is not isolated');const node=nodes[0],ready=node.actions.find((item):item is Extract<EffectAction,{kind:'ready'}>=>item.kind==='ready'&&item.scope==='own-don');
   assert(node.conditions.length===1&&node.conditions[0].text===condition!.text&&node.costs.length===0&&node.actions.length===1&&Boolean(ready&&ready.amount===amount&&ready.selection?.min===0&&ready.selection.max===amount),'Ready-DON amount or no-other condition differs from the printed text');
   const normalized=doc.normalized.filter(effect=>effect.timing===timing);assert(normalized.length===1&&normalized[0].conditions.length===1&&normalized[0].conditions[0].text===condition!.text&&normalized[0].sequence.length===1&&normalized[0].sequence[0].type==='RESOLVE'&&normalized[0].sequence[0].action.kind==='ready'&&normalized[0].sequence[0].action.scope==='own-don','Conditional Ready-DON sequence differs from the printed text');
   const makeState=(includeOther:boolean,leaderTraits:string[]=['Supernovas'])=>{const state=base();state.cards.push({id:'leader',owner:'player',zone:'leader',type:'Leader',traits:leaderTraits,color:'Red Blue'},{id:'source',owner:'player',zone:'character',type:'Character',name:row.name},...(includeOther?[{id:'other',owner:'player' as const,zone:'character' as const,type:'Character' as const,name}]:[]),...Array.from({length:amount},(_,index)=>({id:`rested-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:true})));return state;};
   const valid=makeState(false),validResult=beginEffectExecution(valid,'player','source',timing,resolveEffectTiming(doc,timing).commands);assert(validResult.requiresSelection,'Source Cavendish should not count as another Cavendish');const readied=advanceEffectExecution(validResult.execution,{cardIds:Array.from({length:amount},(_,index)=>`rested-${index}`)});assert(readied.complete&&!readied.error&&readied.execution.state.cards.filter(card=>card.id.startsWith('rested-')).every(card=>!card.rested),'Legal Ready-DON choice failed');
   const blocked=makeState(true),blockedResult=beginEffectExecution(blocked,'player','source',timing,resolveEffectTiming(doc,timing).commands);assert(blockedResult.complete&&!blockedResult.error&&blockedResult.execution.state.cards.every(card=>card.rested===blocked.cards.find(original=>original.id===card.id)?.rested),'A second Cavendish should block the ability without changing rested DON');
   const wrongLeader=makeState(false,[]),wrongLeaderResult=beginEffectExecution(wrongLeader,'player','source',timing,resolveEffectTiming(doc,timing).commands);assert(wrongLeaderResult.complete&&!wrongLeaderResult.error&&wrongLeaderResult.execution.state.cards.every(card=>card.rested===wrongLeader.cards.find(original=>original.id===card.id)?.rested),'A Leader without the required type should block the ability');
  }}];
 });
};

const restDonCostScenarios=(row:Identity):Scenario[]=>{
 const timingNames:Record<string,EffectTrigger>={'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block',"on your opponent's attack":'opponent-attack','end of your turn':'end-turn'};
 const timingPattern="On Play|When Attacking|Activate\\s*:\\s*Main|Main|Counter|Trigger|On K\\.O\\.|On Block|On Your Opponent's Attack|End of Your Turn";
 const windows=[...clean(row.effect_text).matchAll(new RegExp(`\\[(${timingPattern})\\]([\\s\\S]*?)(?=\\[(?:${timingPattern})\\]|$)`,'ig'))];
 const parsed=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 return windows.flatMap(match=>{const timing=timingNames[match[1].toLowerCase()],costs=[...match[2].matchAll(/((?:You may\s+)?rest\s+(\d+)\s+of your DON!! cards?[^.:]*?)\s*:/ig)];if(!timing||!costs.length)return [];return costs.flatMap(printed=>{const amount=Number(printed[2]),optional=/\byou may\b/i.test(match[2].slice(0,(printed.index??0)+printed[1].length)),abilities=parsed.ast.filter(ast=>ast.trigger===timing&&ast.costs.some(cost=>cost.kind==='rest'&&cost.scope==='don'));if(abilities.length!==1||abilities[0].costs.filter(cost=>cost.kind==='rest'&&cost.scope==='don').length!==1)return [];return [{name:`schema-rest-don-cost ${timing}: select ${amount} active DON!!${optional?' (optional)':''}`,run(doc:EffectDocument){
  const ability=doc.ast.filter(ast=>ast.trigger===timing&&ast.costs.some(cost=>cost.kind==='rest'&&cost.scope==='don'));assert(ability.length===1,'Rest-DON cost was not isolated to one timing window');const cost=ability[0].costs.find((item):item is Extract<EffectCost,{kind:'rest'}>=>item.kind==='rest'&&item.scope==='don');if(!cost)throw new Error('Rest-DON cost is missing');assert(cost.amount===amount&&cost.optional===optional,'Rest-DON count or optionality differs from printed text');
  const normalized=doc.normalized.filter(effect=>effect.timing===timing&&effect.sequence.some(step=>step.type==='PAY_COST'&&step.cost.kind==='rest'&&step.cost.scope==='don'));assert(normalized.length===1,'Rest-DON cost is absent from the normalized timing window');const payIndex=normalized[0].sequence.findIndex(step=>step.type==='PAY_COST'&&step.cost.kind==='rest'&&step.cost.scope==='don'),resolveIndex=normalized[0].sequence.findIndex(step=>step.type==='RESOLVE');assert(resolveIndex<0||payIndex<resolveIndex,'Rest-DON cost must be paid before the effect');
  const state=base(),legal=Array.from({length:amount+1},(_,index)=>({id:`active-don-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:false}));state.cards.push(...legal,{id:'rested-don',owner:'player',zone:'cost-area',type:'DON!!',rested:true},{id:'attached-don',owner:'player',zone:'cost-area',type:'DON!!',rested:false,attachedTo:'leader'},{id:'enemy-don',owner:'opponent',zone:'cost-area',type:'DON!!',rested:false},{id:'active-character',owner:'player',zone:'cost-area',type:'Character',rested:false});const asked=payEffectCost(state,'player',cost);assert(Boolean(asked.requiresSelection)&&!asked.error,'Rest-DON payment did not request selected active DON!!');
  const ids=legal.slice(0,amount).map(card=>card.id),paid=payEffectCost(state,'player',cost,{cardIds:ids});assert(!paid.error&&!paid.requiresSelection&&ids.every(id=>paid.state.cards.find(card=>card.id===id)?.rested),'Selected active DON!! were not rested');assert(paid.state.cards.find(card=>card.id===`active-don-${amount}`)?.rested===false&&paid.state.cards.find(card=>card.id==='rested-don')?.rested===true,'Unselected DON!! changed readiness');
  for(const invalid of [ids.slice(0,Math.max(0,amount-1)),[...ids.slice(0,Math.max(0,amount-1)),'enemy-don'],['rested-don'],['attached-don'],['active-character'],amount>1?Array.from({length:amount},()=>ids[0]):[]]){const rejected=payEffectCost(state,'player',cost,{cardIds:invalid});assert(Boolean(rejected.error||rejected.requiresSelection)&&canonical(rejected.state.cards)===canonical(state.cards),'Invalid Rest-DON payment mutated state');}
 }}];});});
};

const conditionalRestDonAdditionScenarios=(row:Identity):Scenario[]=>{
 const printed=[...clean(row.effect_text).matchAll(/\[Activate\s*:\s*Main\](?:\s*\[Once Per Turn\])?\s*You may rest\s+(\d+)\s+of your DON!! cards?:\s*If your Leader has the\s+[\[{\"]([^\]}\"]+)[\]}\"]\s+type,\s*add up to\s+(\d+) DON!! cards? from your DON!! deck and rest (?:it|them)\.?/ig)];
 if(printed.length!==1)return [];
 const amount=Number(printed[0][1]),trait=printed[0][2],addAmount=Number(printed[0][3]),timing:EffectTrigger='activate-main';
 const compiled=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 const local=compiled.ast.filter(ast=>ast.trigger===timing&&ast.costs.some(cost=>cost.kind==='rest'&&cost.scope==='don'));
 if(local.length!==1||local[0].conditions.length!==1||local[0].costs.length!==1||local[0].actions.length!==1||local[0].actions[0].kind!=='add-don')return [];
 return [{name:`schema-rested-don-addition activate-main: ${trait} Leader gate`,run(doc){
  const abilities=doc.ast.filter(ast=>ast.trigger===timing&&ast.costs.some(cost=>cost.kind==='rest'&&cost.scope==='don'));
  assert(abilities.length===1,'Rested-DON addition ability is not isolated');const ability=abilities[0],cost=ability.costs.find((item):item is Extract<EffectCost,{kind:'rest'}>=>item.kind==='rest'&&item.scope==='don'),action=ability.actions.find((item):item is Extract<EffectAction,{kind:'add-don'}>=>item.kind==='add-don');
  assert(cost?.amount===amount&&cost.optional&&ability.conditions.length===1&&new RegExp(`^your Leader has the [\\[{\\"]${trait.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}[\\]}\\"] type$`,'i').test(ability.conditions[0].text),'Rested-DON payment or Leader trait gate differs from the printed cost');
  assert(ability.costs.length===1&&ability.actions.length===1&&action?.amount===addAmount&&action.rested&&action.selection?.min===0&&action.selection.max===addAmount,'Rested-DON addition amount, rest state, or optional choice differs from text');
  const window=doc.normalized.filter(effect=>effect.timing===timing);assert(window.length===1&&window[0].conditions.length===1&&window[0].sequence.length===2&&window[0].sequence[0].type==='PAY_COST'&&window[0].sequence[0].cost.kind==='rest'&&window[0].sequence[1].type==='RESOLVE'&&window[0].sequence[1].action.kind==='add-don'&&window[0].sequence[1].action.rested,'Normalized activation must pay DON before adding rested DON');
  const state=base();state.cards.push({id:'leader',owner:'player',zone:'leader',type:'Leader',traits:[trait]},...Array.from({length:amount},(_,index)=>({id:`pay-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:false})),...Array.from({length:addAmount+1},(_,index)=>({id:`reserve-${index}`,owner:'player' as const,zone:'don-deck' as const,type:'DON!!' as const})));
  const begun=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);assert(begun.requiresSelection&&!begun.error,'DON cost should pause for explicit selection');assert(begun.execution.state.cards.every(card=>card.zone===state.cards.find(item=>item.id===card.id)?.zone),'DON was spent before the player chose a payment');
  const paid=advanceEffectExecution(begun.execution,{cardIds:Array.from({length:amount},(_,index)=>`pay-${index}`)});assert(paid.requiresSelection&&!paid.error,'Paid ability should then ask which DON to add');assert(paid.execution.state.cards.filter(card=>card.id.startsWith('pay-')).every(card=>card.rested),'Chosen cost DON should be rested');
  const resolved=advanceEffectExecution(paid.execution,{cardIds:['reserve-0']});assert(resolved.complete&&!resolved.error,'Selected rested DON addition did not complete');assert(resolved.execution.state.cards.find(card=>card.id==='reserve-0')?.zone==='cost-area'&&resolved.execution.state.cards.find(card=>card.id==='reserve-0')?.rested,'Added DON should enter the cost area rested');assert(resolved.execution.state.cards.find(card=>card.id==='reserve-1')?.zone==='don-deck','Unselected DON moved out of the reserve');
 }}];
};

const reorderScenarios=(row:Identity):Scenario[]=>{
 const text=clean(row.effect_text),matches=[...text.matchAll(/\[(On Play|When Attacking|Activate\s*:\s*Main|Main|Trigger)\]\s*Look at\s+(\d+)\s+cards? from the top of your deck and place them at the top or bottom of (?:your|the) deck in any order/ig)];
 return matches.map((match,index)=>{const timing=({'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main','trigger':'trigger'} as Record<string,EffectTrigger>)[match[1].toLowerCase()]??'unknown',amount=Number(match[2]);return {name:`schema-reorder ${timing}: inspect ${amount}, choose top or bottom`,run(doc){const actions=doc.ast.filter(ast=>ast.trigger===timing).flatMap(ast=>ast.actions.filter((action):action is Extract<EffectAction,{kind:'reorder-deck'}>=>action.kind==='reorder-deck'));assert(actions.length===matches.length,`Expected ${matches.length} deck-reorder action(s) in ${timing}`);const action=actions[index];assert(action.amount===amount&&action.position==='choice','Printed reorder count or destination choice was lost');const ability=doc.ast.find(ast=>ast.trigger===timing);if(/DON!!\s*[x×]\s*1/i.test(match[0]))assert(Boolean(ability?.actions.some(candidate=>candidate.kind==='attach-don-required'&&candidate.amount===1)),'Printed DON!! x1 timing requirement was lost');const followDon=match[0].match(/Then,?\s*give up to (\d+) rested DON!!/i);if(followDon){const grant=ability?.actions.find((candidate):candidate is Extract<EffectAction,{kind:'attach-don'}>=>candidate.kind==='attach-don');assert(grant?.amount===Number(followDon[1])&&grant.rested,'Printed rested-DON grant was lost or changed');const sequence=doc.normalized.find(effect=>effect.timing===timing)?.sequence??[];assert(sequence.findIndex(step=>step.type==='RESOLVE'&&step.action.kind==='reorder-deck')<sequence.findIndex(step=>step.type==='RESOLVE'&&step.action.kind==='attach-don'),'Rested DON grant must follow the deck reorder choice');}if(row.code==='OP02-056'){assert(!doc.ast.some(ast=>ast.trigger==='on-play'&&ast.actions.some(candidate=>candidate.kind==='bottom-deck'||candidate.kind==='attach-don-required')),'When Attacking instructions leaked into On Play');assert(!doc.ast.some(ast=>ast.trigger==='on-play'&&ast.actions.some(candidate=>candidate.kind==='search')),'Deck reorder was incorrectly converted to a card search');}}};});
};

const returnToHandScenarios=(row:Identity):Scenario[]=>{
 const result:Scenario[]=[],chunks=clean(row.effect_text).split(/(?=\[(?:On Play|When Attacking|Activate\s*:\s*Main|Activate:Main|Main|Counter|Trigger|On K\.O\.|On Block|End of Your Turn)\])/i);
 const timingMap:Record<string,EffectTrigger>={'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','activatemain':'activate-main','activate:main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block','end of your turn':'end-turn'};
 for(const chunk of chunks){
  const match=chunk.trim().match(/^\[(On Play|When Attacking|Activate\s*:\s*Main|Activate:Main|Main|Counter|Trigger|On K\.O\.|On Block|End of Your Turn)\]\s*Return up to (\d+) (of your opponent's |of your )?Characters?(?: with a cost of (\d+) or less| with (\d+) (base )?power or less)? to the owner's hand\.?$/i);
  if(!match)continue;
  const timing=timingMap[match[1].toLowerCase()],count=Number(match[2]),scope=match[3]?.toLowerCase().includes('opponent')?'opponent-character':match[3]?'own-character':'any-character',maxCost=match[4]?Number(match[4]):undefined,powerLimit=match[5]?Number(match[5]):undefined,basePower=Boolean(match[6]);
  result.push({name:`schema-return-hand ${timing}: ${scope}${maxCost===undefined?'':` cost <= ${maxCost}`}${powerLimit===undefined?'':` ${basePower?'base-power':'power'} <= ${powerLimit}`} up to ${count}`,run(doc){
   const abilities=doc.ast.filter(ast=>ast.trigger===timing);assert(abilities.length===1,'Return effect must stay isolated to its printed timing');const ability=abilities[0],actions=ability.actions.filter(action=>action.kind==='return-to-hand');assert(ability.conditions.length===0&&actions.length===1&&ability.actions.length===1,'Return effect shares conditions or follow-up actions and needs a full-sequence scenario');const action=actions[0];if(action.kind!=='return-to-hand')throw new Error('Expected a return-to-hand action');assert(action.scope===scope&&action.maxCost===maxCost&&action.maxPower===(basePower?undefined:powerLimit)&&action.maxBasePower===(basePower?powerLimit:undefined)&&action.selection?.min===0&&action.selection.max===count,'Return target scope, filter, or optional target count differs from the printed text');
   const state=base(),owner=scope==='own-character'?'player':'opponent',boundaryPower=powerLimit??4000;state.cards.push({id:'eligible',owner,zone:'character',type:'Character',cost:maxCost??3,power:boundaryPower,powerModifier:basePower?2000:0},{id:'second',owner,zone:'character',type:'Character',cost:maxCost??3,power:boundaryPower},{id:'third',owner,zone:'character',type:'Character',cost:maxCost??3,power:boundaryPower},{id:'over-limit',owner,zone:'character',type:'Character',cost:maxCost===undefined?2:maxCost+1,power:basePower?boundaryPower+1:powerLimit===undefined?5000:powerLimit+1,powerModifier:basePower?-1000:0},{id:'own',owner:'player',zone:'character',type:'Character',cost:maxCost??3,power:boundaryPower},{id:'leader',owner:'opponent',zone:'leader',type:'Leader',cost:maxCost??3,power:boundaryPower});
   const chosen=applyEffectAction(state,'player',action,action.selection?{cardIds:['eligible']}:{targetId:'eligible'});assert(!chosen.error&&!chosen.requiresSelection&&chosen.state.cards.find(card=>card.id==='eligible')?.zone==='hand','Eligible Character did not return to its owner’s hand');const skipped=applyEffectAction(state,'player',action,{cardIds:[]});assert(!skipped.error&&!skipped.requiresSelection&&skipped.state.cards.every(card=>state.cards.find(before=>before.id===card.id)?.zone===card.zone),'Up-to return effect could not choose zero targets');const tooMany=applyEffectAction(state,'player',action,{cardIds:Array.from({length:count+1},(_,i)=>['eligible','second','third'][i])});assert(Boolean(tooMany.error),'Return effect accepted more than its printed target maximum');
   const illegal=[...(scope==='opponent-character'?['own']:[]),...(maxCost!==undefined||powerLimit!==undefined?['over-limit']:[]),'leader'];for(const id of illegal){const rejected=applyEffectAction(state,'player',action,{cardIds:[id]});assert(Boolean(rejected.error)&&rejected.state.cards.find(card=>card.id===id)?.zone===(id==='leader'?'leader':'character'),`Illegal return target ${id} was accepted`);}
  }});
 }
 return result;
};

const handResetScenarios=(row:Identity):Scenario[]=>{
 const text=clean(row.effect_text);if(!/(?:you return all cards in your hand to your deck|you may return all cards in your hand to your deck|your opponent returns all cards in their hand to their deck)/i.test(text))return [];
 const actionMatch=text.match(/(?:you|your opponent) returns? all cards? in (?:your|their) hand to (?:your|their) deck/i);if(!actionMatch)return [];
 const timingLabel=text.match(/\[(On Play|When Attacking|Activate\s*:\s*Main|Activate:Main|Main|Counter|Trigger|On K\.O\.|On Block|End of Your Turn)\]/i)?.[1]?.toLowerCase()??'unknown';const timing=({'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','activatemain':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block','end of your turn':'end-turn'} as Record<string,EffectTrigger>)[timingLabel]??'unknown';
 const scope=/your opponent/i.test(actionMatch[0])?'opponent':'self',shuffle=/shuffles? (?:your|their) deck/i.test(text),drawEqual=/draw cards equal to the number you returned/i.test(text),drawFixed=Number(text.match(/then,?\s*(?:your opponent )?draws? (\d+) cards?/i)?.[1]??0);
 return [{name:`schema-hand-reset ${timing}: ${scope}: return entire hand${shuffle?' and shuffle':''}${drawEqual?' then draw returned count':drawFixed?` then draw ${drawFixed}`:''}`,run(doc){
  const actions=doc.ast.flatMap(ast=>ast.actions.filter((action):action is Extract<EffectAction,{kind:'hand-reset'}>=>action.kind==='hand-reset'));assert(actions.length===1,'Expected one whole-hand reset action');const action=actions[0];assert(action.scope===scope&&Boolean(action.shuffle)===shuffle,'Hand-reset scope or shuffle differs from printed text');if(drawEqual)assert(action.draw===undefined,'Equal-to-returned draw should use the live hand count');if(drawFixed)assert(action.draw===drawFixed,'Fixed reset draw count differs from printed text');
  const state=base();state.cards.push(...Array.from({length:3},(_,i)=>({id:`hand-${i}`,owner:scope==='self'?'player' as const:'opponent' as const,zone:'hand' as const,type:'Character' as const})),{id:'other-hand',owner:scope==='self'?'opponent':'player',zone:'hand',type:'Character'},...Array.from({length:8},(_,i)=>({id:`other-deck-${i}`,owner:scope==='self'?'player' as const:'opponent' as const,zone:'deck' as const,type:'Character' as const})));
  const beforeIds=state.cards.filter(card=>card.owner===(scope==='self'?'player':'opponent')&&card.zone==='deck').slice(0,3).map(card=>card.id),done=applyEffectAction(state,'player',action);assert(!done.error&&!done.requiresSelection,'Whole-hand reset failed');const owner=scope==='self'?'player':'opponent',hand=done.state.cards.filter(card=>card.owner===owner&&card.zone==='hand');assert(hand.length===(drawEqual?3:drawFixed),'Reset drew the wrong number of cards');assert(done.state.cards.length===state.cards.length,'Reset created or lost cards');if(!shuffle){assert(done.state.cards.filter(card=>card.owner===owner&&card.zone==='deck').slice(-3).every(card=>card.id.startsWith('hand-')),'Returned hand did not remain below the existing deck');assert(beforeIds.every(id=>done.state.cards.find(card=>card.id===id)?.zone==='hand'),'Reset did not draw from the top of the deck');}
 }}];
};

const bottomDeckScenarios=(row:Identity):Scenario[]=>{
 const result:Scenario[]=[];
 const chunks=clean(row.effect_text).split(/(?=\[(?:On Play|When Attacking|Activate\s*:\s*Main|Activate:Main|Main|Counter|Trigger|On K\.O\.|On Block|End of Your Turn)\])/i);
 const triggerMap:Record<string,EffectTrigger>={'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','activatemain':'activate-main','activate:main':'activate-main','main':'main','counter':'counter','trigger':'trigger','on k.o.':'on-ko','on block':'on-block','end of your turn':'end-turn'};
 for(const chunk of chunks){
  const ability=chunk.trim().match(/^\[(On Play|When Attacking|Activate\s*:\s*Main|Activate:Main|Main|Counter|Trigger|On K\.O\.|On Block|End of Your Turn)\]([\s\S]*)$/i);if(!ability)continue;
  const timing=triggerMap[ability[1].toLowerCase()],printed=[...ability[2].matchAll(/^\s*place up to (\d+) (of your opponent's |of your )?Characters?(?: with (?:a )?(?:base )?cost of (\d+) or less)? at the bottom of the owner's deck(?: in any order)?\.?\s*$/ig)];
  for(const [index,match] of printed.entries()){
   const count=Number(match[1]),maxCost=match[3],scope=match[2]?.toLowerCase().includes('opponent')?'opponent-character':match[2]?'own-character':'any-character';
   result.push({name:`schema-bottom-deck ${timing}: ${scope}${maxCost===undefined?'':` cost <= ${maxCost}`}${count===undefined?'':' up to '+count}`,run(doc){
    const actions=doc.ast.filter(ast=>ast.trigger===timing).flatMap(ast=>ast.actions.filter((action):action is Extract<EffectAction,{kind:'bottom-deck'}>=>action.kind==='bottom-deck'));
    assert(actions.length===printed.length,`Expected ${printed.length} bottom-deck action(s) in ${timing}`);const action=actions[index];assert(action.scope===scope&&action.maxCost===(maxCost===undefined?undefined:Number(maxCost)),'Bottom-deck scope or printed cost limit differs');if(count!==undefined)assert(action.selection?.min===0&&action.selection.max===count,'Printed up-to target count was lost');
    if(row.code==='OP02-056'){const ability=doc.ast.find(ast=>ast.trigger==='when-attacking');assert(Boolean(ability?.costs.some(cost=>cost.kind==='trash'&&cost.scope==='hand'&&cost.amount===1&&cost.optional)),'When Attacking must offer the printed optional hand-trash cost');assert(Boolean(ability?.actions.some(candidate=>candidate.kind==='attach-don-required'&&candidate.amount===1)),'When Attacking lost its DON!! x1 requirement');const sequence=doc.normalized.find(effect=>effect.timing==='when-attacking')?.sequence??[];assert(sequence.length===2&&sequence[0].type==='PAY_COST'&&sequence[0].cost.kind==='trash'&&sequence[1].type==='RESOLVE'&&sequence[1].action.kind==='bottom-deck','Resolve the optional hand-trash cost before bottom-deck removal; DON!! x1 remains an attack requirement, not a second effect step');assert(!doc.ast.some(ast=>ast.trigger==='on-play'&&ast.actions.some(candidate=>candidate.kind==='bottom-deck'||candidate.kind==='attach-don-required')),'When Attacking instructions leaked into On Play');}
    const limit=maxCost===undefined?5:Number(maxCost),state=base();state.cards.push({id:'boundary',owner:scope==='own-character'?'player':'opponent',zone:'character',type:'Character',cost:limit},{id:'second',owner:scope==='own-character'?'player':'opponent',zone:'character',type:'Character',cost:limit},{id:'third',owner:scope==='own-character'?'player':'opponent',zone:'character',type:'Character',cost:limit},{id:'too-costly',owner:scope==='own-character'?'player':'opponent',zone:'character',type:'Character',cost:limit+1},{id:'own',owner:'player',zone:'character',type:'Character',cost:limit},{id:'leader',owner:'opponent',zone:'leader',type:'Leader',cost:limit},{id:'attached',owner:scope==='own-character'?'player':'opponent',zone:'cost-area',type:'DON!!',attachedTo:'boundary'});
    const chosen=action.selection?{cardIds:['boundary']}: {targetId:'boundary'},moved=applyEffectAction(state,'player',action,chosen);assert(!moved.error&&!moved.requiresSelection,'Eligible boundary Character was rejected');assert(moved.state.cards.find(card=>card.id==='boundary')?.zone==='deck','Selected Character did not move to deck');assert(moved.state.cards.at(-1)?.id==='boundary','Selected Character was not placed at deck bottom');assert(moved.state.cards.find(card=>card.id==='attached')?.zone==='cost-area'&&!moved.state.cards.find(card=>card.id==='attached')?.attachedTo&&moved.state.cards.find(card=>card.id==='attached')?.rested,'Attached DON!! did not return rested when its Character left play');
    if(action.selection){const skipped=applyEffectAction(state,'player',action,{cardIds:[]});assert(!skipped.error&&!skipped.requiresSelection&&skipped.state.cards.find(card=>card.id==='boundary')?.zone==='character','Up-to effect must allow choosing no targets');const excessive=applyEffectAction(state,'player',action,{cardIds:Array.from({length:count+1},(_,i)=>['boundary','second','third'][i])});assert(Boolean(excessive.error),'Up-to target count accepted too many cards');}
    const illegalIds=[...(maxCost===undefined?[]:['too-costly']),...(scope==='opponent-character'?['own']:[]),'leader'];for(const id of illegalIds){const rejected=applyEffectAction(state,'player',action,action.selection?{cardIds:[id]}:{targetId:id});assert(Boolean(rejected.error)&&rejected.state.cards.find(card=>card.id===id)?.zone===(id==='leader'?'leader':'character'),`Illegal bottom-deck target ${id} was accepted`);}
   }});
  }
 }
 return result;
};

const selfTrashConditionalDrawScenarios=(row:Identity):Scenario[]=>row.code==='EB03-028'?[{name:'schema-self-trash-conditional-draw activate-main: hand boundary and optional cost',run(doc){
 const abilities=doc.ast.filter(ability=>ability.trigger==='activate-main');assert(abilities.length===1,'Expected one Activate: Main ability');const ability=abilities[0];
 assert(ability.conditions.length===1&&ability.conditions[0].text==='you have 4 or less cards in your hand','Draw condition must use the printed hand-size limit');
 assert(ability.costs.length===1&&ability.costs[0].kind==='trash'&&ability.costs[0].scope==='self'&&ability.costs[0].optional,'The Character must be an optional activation cost');
 assert(ability.actions.length===1&&ability.actions[0].kind==='draw'&&ability.actions[0].amount===2,'The ability must draw exactly two cards');
 const normalized=doc.normalized.filter(effect=>effect.timing==='activate-main');assert(normalized.length===1&&normalized[0].conditions.length===1&&normalized[0].sequence.length===2&&normalized[0].sequence[0].type==='PAY_COST'&&normalized[0].sequence[0].cost.kind==='trash'&&normalized[0].sequence[1].type==='RESOLVE'&&normalized[0].sequence[1].action.kind==='draw','Self-trash must resolve before its conditional draw');
 const resolution=resolveEffectTiming(doc,'activate-main');assert(resolution.status==='ready'&&resolution.commands.length===2,'Activate: Main did not produce the expected cost and draw commands');
 for(const handCount of [4,5]){const state:MatchEffectState={...base(),cards:[{id:'source',owner:'player',zone:'character',type:'Character',name:row.name},...Array.from({length:handCount},(_,i)=>({id:`hand-${i}`,owner:'player' as const,zone:'hand' as const,type:'Character' as const})),...Array.from({length:2},(_,i)=>({id:`deck-${i}`,owner:'player' as const,zone:'deck' as const,type:'Character' as const}))]};const result=beginEffectExecution(state,'player','source','activate-main',resolution.commands);assert(result.complete&&!result.error,'Paid activation did not complete');assert(result.execution.state.cards.find(card=>card.id==='source')?.zone==='trash','Paid activation did not trash this Character');const drawn=result.execution.state.cards.filter(card=>card.owner==='player'&&card.zone==='hand'&&card.id.startsWith('deck-')).length;assert(drawn===(handCount<=4?2:0),`Wrong draw result at hand size ${handCount}`);}
 }},{name:'schema-self-trash-conditional-draw on-play: trash exactly one hand card',run(doc){
  const abilities=doc.ast.filter(ability=>ability.trigger==='on-play');assert(abilities.length===1&&abilities[0].conditions.length===0&&abilities[0].costs.length===0&&abilities[0].actions.length===1,'On Play must be a separate unconditional ability');const action=abilities[0].actions[0];assert(action.kind==='trash'&&action.scope==='hand'&&action.amount===1,'On Play must trash exactly one card from hand');
  const normalized=doc.normalized.filter(effect=>effect.timing==='on-play');assert(normalized.length===1&&normalized[0].conditions.length===0&&normalized[0].sequence.length===1&&normalized[0].sequence[0].type==='RESOLVE'&&normalized[0].sequence[0].action.kind==='trash','On Play schema must resolve only the printed hand trash');
  const resolution=resolveEffectTiming(doc,'on-play');assert(resolution.status==='ready'&&resolution.commands.length===1,'On Play must have one trash command');const state:MatchEffectState={...base(),cards:[{id:'source',owner:'player',zone:'character',type:'Character'},...Array.from({length:2},(_,i)=>({id:`hand-${i}`,owner:'player' as const,zone:'hand' as const,type:'Character' as const}))]};const prompt=beginEffectExecution(state,'player','source','on-play',resolution.commands);assert(!prompt.error&&prompt.requiresSelection,'On Play must ask the player which hand card to trash');const selected=advanceEffectExecution(prompt.execution,{cardIds:['hand-1']});assert(selected.complete&&!selected.error&&selected.execution.state.cards.find(card=>card.id==='hand-1')?.zone==='trash'&&selected.execution.state.cards.find(card=>card.id==='hand-0')?.zone==='hand','On Play trashed the wrong number of hand cards');
 }}]:[];

const mihawkRestedDonScenarios=(row:Identity):Scenario[]=>row.code==='P-163'?[{name:'schema-mihawk-rested-don activate-main: pay a field rest, gate by 5-cost Character',run(doc){
 const abilities=doc.ast.filter(ability=>ability.trigger==='activate-main');assert(abilities.length===1,'Expected one Activate: Main ability');const ability=abilities[0];
 assert(ability.conditions.length===1&&ability.conditions[0].text==='there is a Character with a cost of 5 or more','Effect must require a field Character with cost 5 or more');
 assert(ability.costs.length===1&&ability.costs[0].kind==='rest'&&ability.costs[0].scope==='own-card'&&ability.costs[0].amount===1&&ability.costs[0].optional,'Activation must offer one optional active field-card rest');
 const action=ability.actions[0];assert(ability.actions.length===1&&action.kind==='attach-don'&&action.amount===3&&action.rested===true&&action.recipient==='self'&&action.selection?.min===0&&action.selection.max===3,'Effect must offer up to three rested DON!! to this Leader');
 const normalized=doc.normalized.filter(effect=>effect.timing==='activate-main');assert(normalized.length===1&&normalized[0].sequence.length===2&&normalized[0].sequence[0].type==='PAY_COST'&&normalized[0].sequence[0].cost.kind==='rest'&&normalized[0].sequence[1].type==='RESOLVE'&&normalized[0].sequence[1].action.kind==='attach-don','Rest payment must precede the DON!! attachment');
 const resolution=resolveEffectTiming(doc,'activate-main');assert(resolution.status==='ready'&&resolution.commands.length===2,'Expected rest payment followed by DON!! attachment');
 for(const qualifyingCost of [5,4]){const state:MatchEffectState={...base(),cards:[{id:'source',owner:'player',zone:'leader',type:'Leader',name:'Dracule Mihawk'},{id:'payment',owner:'player',zone:'character',type:'Character',cost:2},...(qualifyingCost===5?[{id:'qualifier',owner:'player' as const,zone:'character' as const,type:'Character' as const,cost:qualifyingCost}]:[{id:'qualifier',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,cost:qualifyingCost}]),...Array.from({length:3},(_,i)=>({id:`don-${i}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:true}))]};const started=beginEffectExecution(state,'player','source','activate-main',resolution.commands);assert(!started.error&&started.requiresSelection,'Activation must request the one-card rest payment');const paid=advanceEffectExecution(started.execution,{cardIds:['payment']});assert(!paid.error&&paid.execution.state.cards.find(card=>card.id==='payment')?.rested,'Selected payment card was not rested');if(qualifyingCost<5){assert(paid.complete&&paid.execution.state.cards.every(card=>!card.id.startsWith('don-')||!card.attachedTo),'DON!! attached despite the field condition failing');continue;}assert(paid.requiresSelection,'Eligible field condition must reach optional DON!! selection');const attached=advanceEffectExecution(paid.execution,{targetId:'source',cardIds:['don-0','don-1','don-2']});assert(attached.complete&&!attached.error&&attached.execution.state.cards.filter(card=>card.type==='DON!!'&&card.attachedTo==='source').length===3,'Selected rested DON!! were not attached to this Leader');}
 const state:MatchEffectState={...base(),cards:[{id:'source',owner:'player',zone:'leader',type:'Leader'},{id:'payment',owner:'player',zone:'character',type:'Character'},...Array.from({length:3},(_,i)=>({id:`don-${i}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:true})),{id:'qualifier',owner:'player',zone:'character',type:'Character',cost:5}]};const started=beginEffectExecution(state,'player','source','activate-main',resolution.commands),declined=advanceEffectExecution(started.execution,{choice:'decline'});assert(declined.complete&&declined.execution.state.cards.find(card=>card.id==='payment')?.rested!==true&&declined.execution.state.cards.every(card=>!card.id.startsWith('don-')||!card.attachedTo),'Declining the optional cost mutated the board');
 }}]:[];

const animalKingdomCompoundCostScenarios=(row:Identity):Scenario[]=>['OP17-078','OP17-077'].includes(row.code)?[{name:'schema-compound-rest-hand-add-don main: pay both costs before optional rested DON',run(doc){
 const restAmount=row.code==='OP17-078'?2:3,abilities=doc.ast.filter(ability=>ability.trigger==='main');assert(abilities.length===1,'Expected one Main ability');const ability=abilities[0];
 assert(ability.conditions.length===1&&ability.conditions[0].text==='your Leader has the {Animal Kingdom Pirates} type','Animal Kingdom Leader condition differs from printed text');
 assert(ability.costs.length===2&&ability.costs[0].kind==='rest'&&ability.costs[0].scope==='don'&&ability.costs[0].amount===restAmount&&ability.costs[0].optional&&ability.costs[1].kind==='trash'&&ability.costs[1].scope==='hand'&&ability.costs[1].amount===2&&!ability.costs[1].optional,'Rest DON!! and hand trash must be one optional package with ordered mandatory payments');
 const action=ability.actions[0];assert(ability.actions.length===1&&action.kind==='add-don'&&action.amount===3&&action.rested&&action.selection?.min===0&&action.selection.max===3,'Main must offer up to three rested DON!!');
 const window=doc.normalized.filter(effect=>effect.timing==='main');assert(window.length===1&&window[0].sequence.length===3&&window[0].sequence[0].type==='PAY_COST'&&window[0].sequence[0].cost.kind==='rest'&&window[0].sequence[1].type==='PAY_COST'&&window[0].sequence[1].cost.kind==='trash'&&window[0].sequence[2].type==='RESOLVE'&&window[0].sequence[2].action.kind==='add-don','Normalized order must be rest DON, trash two cards, then choose added DON');
 const resolution=resolveEffectTiming(doc,'main');assert(resolution.status==='ready'&&resolution.commands.length===3,'Main resolution lost a cost or action');
 const run=(leaderTrait:boolean)=>{const state:MatchEffectState={...base(),cards:[{id:'leader',owner:'player',zone:'leader',type:'Leader',traits:leaderTrait?['Animal Kingdom Pirates']:[]},...Array.from({length:restAmount+1},(_,i)=>({id:`pay-${i}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:false})),...Array.from({length:3},(_,i)=>({id:`hand-${i}`,owner:'player' as const,zone:'hand' as const,type:'Character' as const})),...Array.from({length:4},(_,i)=>({id:`don-deck-${i}`,owner:'player' as const,zone:'don-deck' as const,type:'DON!!' as const})),{id:'qualifier',owner:'player',zone:'character',type:'Character',cost:5}]};const started=beginEffectExecution(state,'player','event','main',resolution.commands);assert(started.requiresSelection,'Activation must ask for active DON!! payment');const rested=advanceEffectExecution(started.execution,{cardIds:Array.from({length:restAmount},(_,i)=>`pay-${i}`)});assert(rested.requiresSelection,'After paying DON!!, activation must ask for both hand cards');const trashed=advanceEffectExecution(rested.execution,{cardIds:['hand-0','hand-1']});assert(!trashed.error,'Hand-trash payment failed');assert(trashed.execution.state.cards.find(card=>card.id==='hand-0')?.zone==='trash'&&trashed.execution.state.cards.find(card=>card.id==='hand-1')?.zone==='trash','Both selected hand cards must be trashed');if(!leaderTrait){assert(trashed.complete&&trashed.execution.state.cards.every(card=>!card.id.startsWith('don-deck-')||card.zone==='don-deck'),'Failed Leader condition still added DON!!');return;}assert(trashed.requiresSelection,'Successful costs and condition must reach optional DON!! selection');const added=advanceEffectExecution(trashed.execution,{cardIds:['don-deck-0','don-deck-1','don-deck-2']});assert(added.complete&&!added.error&&['don-deck-0','don-deck-1','don-deck-2'].every(id=>added.execution.state.cards.find(card=>card.id===id)?.zone==='cost-area'&&added.execution.state.cards.find(card=>card.id===id)?.rested),'Three selected rested DON!! were not added');};
 run(true);run(false);
 const declineState:MatchEffectState={...base(),cards:[{id:'leader',owner:'player',zone:'leader',type:'Leader',traits:['Animal Kingdom Pirates']},...Array.from({length:restAmount},(_,i)=>({id:`pay-${i}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const})),...Array.from({length:2},(_,i)=>({id:`hand-${i}`,owner:'player' as const,zone:'hand' as const,type:'Character' as const})),{id:'qualifier',owner:'player',zone:'character',type:'Character',cost:5}]},pending=beginEffectExecution(declineState,'player','event','main',resolution.commands),declined=advanceEffectExecution(pending.execution,{choice:'decline'});assert(declined.complete&&canonical(declined.execution.state.cards)===canonical(declineState.cards),'Declining the package changed the board');
 }}]:[];

const op10RestSelfSearchScenarios=(row:Identity):Scenario[]=>row.code==='OP10-028'?[{name:'schema-rest-self-search activate-main: pay costs before five-card search',run(doc){
 const abilities=doc.ast.filter(ability=>ability.trigger==='activate-main');assert(abilities.length===1,'Expected one Activate: Main ability');const ability=abilities[0];
 assert(ability.conditions.length===0&&ability.costs.length===2&&ability.costs[0].kind==='rest'&&ability.costs[0].scope==='don'&&ability.costs[0].amount===2&&ability.costs[0].optional&&ability.costs[1].kind==='trash'&&ability.costs[1].scope==='self'&&!ability.costs[1].optional,'Activation must rest two DON!! then trash its source as one optional package');
 const search=ability.actions[0];assert(ability.actions.length===1&&search.kind==='search'&&search.amount===5&&search.choose===2&&search.destination==='deck-bottom'&&search.trait==='The Akazaya Nine','Search window or eligibility differs from printed text');
 const normalized=doc.normalized.filter(effect=>effect.timing==='activate-main');assert(normalized.length===1&&normalized[0].sequence.length===3&&normalized[0].sequence[0].type==='PAY_COST'&&normalized[0].sequence[0].cost.kind==='rest'&&normalized[0].sequence[1].type==='PAY_COST'&&normalized[0].sequence[1].cost.kind==='trash'&&normalized[0].sequence[2].type==='RESOLVE'&&normalized[0].sequence[2].action.kind==='search','Both costs must precede the search');
 const resolution=resolveEffectTiming(doc,'activate-main');assert(resolution.status==='ready'&&resolution.commands.length===3,'Activation command sequence is incomplete');const state:MatchEffectState={...base(),cards:[{id:'source',owner:'player',zone:'character',type:'Character',name:row.name},...Array.from({length:3},(_,i)=>({id:`pay-${i}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:false})),...Array.from({length:5},(_,i)=>({id:`look-${i}`,owner:'player' as const,zone:'deck' as const,type:'Character' as const,traits:i<3?['The Akazaya Nine']:['Other']}))]};
 const started=beginEffectExecution(state,'player','source','activate-main',resolution.commands);assert(started.requiresSelection,'Must select two active DON!! to begin');const paidDon=advanceEffectExecution(started.execution,{cardIds:['pay-0','pay-1']});assert(paidDon.requiresSelection&&paidDon.execution.state.cards.find(card=>card.id==='source')?.zone==='trash','After DON!! payment, this Character must be trashed before the search choice');const chosen=advanceEffectExecution(paidDon.execution,{cardIds:['look-0','look-2']});assert(chosen.complete&&!chosen.error,'The selected Akazaya Nine search failed');assert(['pay-0','pay-1'].every(id=>chosen.execution.state.cards.find(card=>card.id===id)?.rested),'Rested DON!! payment was not retained');assert(['look-0','look-2'].every(id=>chosen.execution.state.cards.find(card=>card.id===id)?.zone==='hand'),'Selected eligible cards did not enter hand');assert(['look-1','look-3','look-4'].every(id=>chosen.execution.state.cards.find(card=>card.id===id)?.zone==='deck'),'Unselected or ineligible cards left the deck');
 const decline=beginEffectExecution(state,'player','source','activate-main',resolution.commands),skipped=advanceEffectExecution(decline.execution,{choice:'decline'});assert(skipped.complete&&canonical(skipped.execution.state.cards)===canonical(state.cards),'Declining the package changed the board');
 }}]:[];

export function scenarios(row:Identity):Scenario[]{
 if(row.code==='ST06-004')return [{name:'continuous: separate effect immunity and DON!!-plus-zero-cost Double Attack',run(doc:EffectDocument){
  const effectAction=doc.ast.flatMap(ability=>ability.actions).find(action=>action.kind==='prevent-ko');assert(effectAction?.kind==='prevent-ko'&&effectAction.by==='effect'&&effectAction.requiresAttachedDon===undefined,'Independent effect immunity must not inherit the Double Attack DON requirement');
  const keywordAbility=doc.ast.find(ability=>ability.actions.some(action=>action.kind==='grant-keyword'&&action.keyword==='double-attack'));assert(Boolean(keywordAbility?.actions.some(action=>action.kind==='attach-don-required'&&action.amount===1)),'Double Attack must retain its DON!! x1 requirement');
  for(const attached of [0,1])for(const zeroCostCharacter of [false,true]){
   const state=base();state.turnNumber=2;state.phase='main';state.playedThisTurn=[];state.cards=[{id:'attacker',owner:'player',zone:'character',type:'Character',name:'Ulti',cost:4,power:5000,effectSchema:doc},...(attached?[{id:'don',owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'attacker'}]:[]),...(zeroCostCharacter?[{id:'zero-cost',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,cost:0}]:[]),{id:'opponent-leader',owner:'opponent',zone:'leader',type:'Leader'},...Array.from({length:2},(_,index)=>({id:`life-${index}`,owner:'opponent' as const,zone:'life' as const,type:'Character' as const}))];
   const result=resolveBattle(state,'attacker','opponent-leader'),expectedDamage=attached===1&&zeroCostCharacter?2:1,remainingLife=result.state.cards.filter(card=>card.owner==='opponent'&&card.zone==='life').length;assert(remainingLife===2-expectedDamage,`Expected ${expectedDamage} Life damage with DON=${attached}, zero-cost=${zeroCostCharacter}; got ${2-remainingLife}`);
  }
  const state=base();state.cards=[{id:'protected',owner:'opponent',zone:'character',type:'Character',cost:4,effectSchema:doc},{id:'source',owner:'player',zone:'character',type:'Character'}];const begun=beginEffectExecution(state,'player','source','main',[{kind:'resolve-action',value:{kind:'ko'}}]),result=begun.requiresSelection?advanceEffectExecution(begun.execution,{targetId:'protected'}):begun;assert(result.execution.state.cards.find(card=>card.id==='protected')?.zone==='character','Always-on effect immunity must work without attached DON!! or a zero-cost Character');
 }}];
 if(row.code==='OP01-099')return [{name:'unknown: Kurozumi battle protection covers matching Characters, except your Semimaru',run(doc:EffectDocument){
  for(const target of [{owner:'player' as const,name:'Target',traits:['Kurozumi Clan']},{owner:'opponent' as const,name:'Target',traits:['Kurozumi Clan']},{owner:'player' as const,name:'Kurozumi Semimaru',traits:['Kurozumi Clan']},{owner:'player' as const,name:'Target',traits:['Other']}] ){const attackerOwner=target.owner==='player'?'opponent' as const:'player' as const,state=base();state.cards=[{id:'protector',owner:'player',zone:'character',type:'Character',name:'Kurozumi Orochi',effectSchema:doc},{id:'protected',owner:target.owner,zone:'character',type:'Character',name:target.name,traits:target.traits,power:4000},{id:'attacker',owner:attackerOwner,zone:'character',type:'Character',power:5000}];const result=resolveBattle(state,'attacker','protected'),expected=target.traits.includes('Kurozumi Clan')&&(target.owner!=='player'||target.name!=='Kurozumi Semimaru');assert((result.state.cards.find(card=>card.id==='protected')?.zone==='character')===expected,`Wrong global clan protection result (${target.owner},${target.name},${target.traits})`);}
 }}];
 if(row.code==='OP07-069')return [{name:'unknown: DON comparison and Foxy name/trait limits gate effect protection',run(doc:EffectDocument){
  for(const donCounts of [[2,1],[1,2]] as const)for(const target of [{name:'Target',traits:['Foxy Pirates']},{name:'Pickles',traits:['Foxy Pirates']},{name:'Target',traits:['Other']}] ){const state=base();state.cards=[{id:'protector',owner:'player',zone:'character',type:'Character',name:'Porche',effectSchema:doc},{id:'protected',owner:'player',zone:'character',type:'Character',name:target.name,traits:target.traits},{id:'source',owner:'opponent',zone:'character',type:'Character'},...Array.from({length:donCounts[0]},(_,index)=>({id:`own-don-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const})),...Array.from({length:donCounts[1]},(_,index)=>({id:`opponent-don-${index}`,owner:'opponent' as const,zone:'cost-area' as const,type:'DON!!' as const}))];const begun=beginEffectExecution(state,'opponent','source','main',[{kind:'resolve-action',value:{kind:'ko'}}]),result=begun.requiresSelection?advanceEffectExecution(begun.execution,{targetId:'protected'}):begun,expected=donCounts[0]<=donCounts[1]&&target.traits.includes('Foxy Pirates')&&target.name!=='Pickles';assert((result.execution.state.cards.find(card=>card.id==='protected')?.zone==='character')===expected,`Wrong Foxy DON/name protection result (${donCounts},${target.name},${target.traits})`);}
 }}];
 if(row.code==='OP06-052')return [{name:'unknown: DON!! and hand-size conditions gate battle protection',run(doc:EffectDocument){
  for(const handCount of [4,5])for(const attached of [0,1]){const state=base();state.cards=[{id:'protected',owner:'player',zone:'character',type:'Character',effectSchema:doc,power:4000},{id:'attacker',owner:'opponent',zone:'character',type:'Character',power:5000},...Array.from({length:handCount},(_,index)=>({id:`hand-${index}`,owner:'player' as const,zone:'hand' as const,type:'Character' as const})),...Array.from({length:attached},(_,index)=>({id:`don-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'protected'}))];const result=resolveBattle(state,'attacker','protected'),protectedCard=handCount<=4&&attached===1;assert(result.state.cards.find(card=>card.id==='protected')?.zone===(protectedCard?'character':'trash'),`Wrong hand/DON protection result (${handCount},${attached})`);}
 }}];
 if(row.code==='ST05-008')return [{name:'unknown: eight field DON!! condition gates battle protection',run(doc:EffectDocument){
  for(const donCount of [7,8]){const state=base();state.cards=[{id:'protected',owner:'player',zone:'character',type:'Character',effectSchema:doc,power:4000},{id:'attacker',owner:'opponent',zone:'character',type:'Character',power:5000},...Array.from({length:donCount},(_,index)=>({id:`don-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const}))];const result=resolveBattle(state,'attacker','protected');assert(result.state.cards.find(card=>card.id==='protected')?.zone===(donCount>=8?'character':'trash'),`Wrong field DON!! protection result (${donCount})`);}
 }}];
 if(row.code==='OP02-100')return [{name:'unknown: Fullbody condition gates battle protection',run(doc:EffectDocument){
  for(const hasFullbody of [false,true]){const state=base();state.cards=[{id:'protected',owner:'player',zone:'character',type:'Character',effectSchema:doc,power:4000},{id:'attacker',owner:'opponent',zone:'character',type:'Character',power:5000},...(hasFullbody?[{id:'fullbody',owner:'player' as const,zone:'character' as const,type:'Character' as const,name:'Fullbody'}]:[])];const result=resolveBattle(state,'attacker','protected');assert(result.state.cards.find(card=>card.id==='protected')?.zone===(hasFullbody?'character':'trash'),`Wrong Fullbody protection result (${hasFullbody})`);}
 }}];
 if(row.code==='OP09-045')return [{name:'unknown: Buggy or Mohji condition gates battle protection',run(doc:EffectDocument){
  for(const name of ['none','Buggy','Mohji']){const state=base();state.cards=[{id:'protected',owner:'player',zone:'character',type:'Character',effectSchema:doc,power:4000},{id:'attacker',owner:'opponent',zone:'character',type:'Character',power:5000},...(name==='none'?[]:[{id:'ally',owner:'player' as const,zone:'character' as const,type:'Character' as const,name}])];const result=resolveBattle(state,'attacker','protected');assert(result.state.cards.find(card=>card.id==='protected')?.zone===(name==='none'?'trash':'character'),`Wrong name-alternative protection result (${name})`);}
 }}];
 if(row.code==='ST09-004')return [{name:'unknown: attached DON!! and two-Life threshold gate battle protection',run(doc:EffectDocument){
  for(const lifeCount of [2,3])for(const attached of [0,1]){const state=base();state.cards=[{id:'protected',owner:'player',zone:'character',type:'Character',effectSchema:doc,power:4000},{id:'attacker',owner:'opponent',zone:'character',type:'Character',power:5000},...Array.from({length:lifeCount},(_,index)=>({id:`life-${index}`,owner:'player' as const,zone:'life' as const,type:'Character' as const})),...Array.from({length:attached},(_,index)=>({id:`don-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'protected'}))];const result=resolveBattle(state,'attacker','protected'),protectedCard=lifeCount<=2&&attached===1;assert(result.state.cards.find(card=>card.id==='protected')?.zone===(protectedCard?'character':'trash'),`Wrong Life/DON protection result (${lifeCount},${attached})`);}
 }}];
 if(row.code==='OP10-104')return [{name:'unknown: Supernovas Leader and opponent-Life conditions gate protection',run(doc:EffectDocument){
  for(const supernovas of [false,true])for(const opponentLife of [2,3])for(const attached of [0,1]){const state=base();state.cards=[{id:'protected',owner:'player',zone:'character',type:'Character',effectSchema:doc,power:4000},{id:'own-leader',owner:'player',zone:'leader',type:'Leader',traits:supernovas?['Supernovas']:[]},{id:'attacker',owner:'opponent',zone:'character',type:'Character',power:5000},...Array.from({length:opponentLife},(_,index)=>({id:`enemy-life-${index}`,owner:'opponent' as const,zone:'life' as const,type:'Character' as const})),...Array.from({length:attached},(_,index)=>({id:`don-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'protected'}))];const result=resolveBattle(state,'attacker','protected'),protectedCard=supernovas&&opponentLife>=3&&attached===1;assert(result.state.cards.find(card=>card.id==='protected')?.zone===(protectedCard?'character':'trash'),`Wrong Leader/Life/DON protection result (${supernovas},${opponentLife},${attached})`);}
 }}];
 if(row.code==='OP02-027')return [{name:'unknown: all field DON!! must be rested for effect protection',run(doc:EffectDocument){
  for(const rested of [false,true]){const state=base();state.cards=[{id:'protected',owner:'opponent',zone:'character',type:'Character',effectSchema:doc},{id:'source',owner:'player',zone:'character',type:'Character'},...Array.from({length:2},(_,index)=>({id:`don-${index}`,owner:'opponent' as const,zone:'cost-area' as const,type:'DON!!' as const,rested}))];const begun=beginEffectExecution(state,'player','source','main',[{kind:'resolve-action',value:{kind:'ko'}}]),result=begun.requiresSelection?advanceEffectExecution(begun.execution,{targetId:'protected'}):begun;assert((result.execution.state.cards.find(card=>card.id==='protected')?.zone==='character')===rested,`Wrong rested-DON protection result (${rested})`);}
 }}];
 if(row.code==='OP13-080')return [{name:'unknown: seven opponent Trash cards gate effect protection',run(doc:EffectDocument){
  for(const trashCount of [6,7]){const state=base();state.cards=[{id:'protected',owner:'opponent',zone:'character',type:'Character',effectSchema:doc},{id:'source',owner:'player',zone:'character',type:'Character'},...Array.from({length:trashCount},(_,index)=>({id:`trash-${index}`,owner:'opponent' as const,zone:'trash' as const,type:'Character' as const}))];const begun=beginEffectExecution(state,'player','source','main',[{kind:'resolve-action',value:{kind:'ko'}}]),result=begun.requiresSelection?advanceEffectExecution(begun.execution,{targetId:'protected'}):begun;assert((result.execution.state.cards.find(card=>card.id==='protected')?.zone==='character')===(trashCount>=7),`Wrong opponent-Trash protection result (${trashCount})`);}
  for(const trashCount of [6,7]){const state=base();state.phase='main';state.turnNumber=2;state.playedThisTurn=['rush-card'];state.cards=[{id:'rush-card',owner:'player',zone:'character',type:'Character',effectSchema:doc},{id:'enemy-leader',owner:'opponent',zone:'leader',type:'Leader'},...Array.from({length:trashCount},(_,index)=>({id:`own-trash-${index}`,owner:'player' as const,zone:'trash' as const,type:'Character' as const}))];const result=declareAttack(state,'player','rush-card','enemy-leader');assert(Boolean(result.error)===(trashCount<7),`Rush should ${trashCount>=7?'allow':'not allow'} an immediate attack at ${trashCount} Trash cards`);}
 }}];
 if(row.code==='OP07-033')return [{name:'unknown: crew-size and target cost/name limits protect only eligible Characters',run(doc:EffectDocument){
  for(const target of [{name:'Target',cost:3},{name:'Target',cost:4},{name:'Monkey.D.Luffy',cost:3}] ){const state=base();state.cards=[{id:'protector',owner:'opponent',zone:'character',type:'Character',name:'Viola',effectSchema:doc},{id:'protected',owner:'opponent',zone:'character',type:'Character',name:target.name,cost:target.cost},{id:'third',owner:'opponent',zone:'character',type:'Character'},{id:'source',owner:'player',zone:'character',type:'Character'}];const begun=beginEffectExecution(state,'player','source','main',[{kind:'resolve-action',value:{kind:'ko'}}]),result=begun.requiresSelection?advanceEffectExecution(begun.execution,{targetId:'protected'}):begun,expected=target.cost<=3&&target.name!=='Monkey.D.Luffy';assert((result.execution.state.cards.find(card=>card.id==='protected')?.zone==='character')===expected,`Wrong cost/name aura result (${target.name},${target.cost})`);}
 }}];
 if(row.code==='OP04-119')return [{name:'continuous: rested Protector on opponent turn protects active five-cost allies',run(doc:EffectDocument){
  const onPlay=doc.normalized.find(effect=>effect.timing==='on-play');assert(Boolean(onPlay?.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind==='play')),'The independent On Play action must remain available');assert(!onPlay?.conditions.some(condition=>condition.text==='this Character is rested'),'The rested condition must not gate the independent On Play effect');
  for(const opponentTurn of [false,true])for(const protectorRested of [false,true])for(const target of [{cost:5,rested:false},{cost:5,rested:true},{cost:4,rested:false}]){const state=base();state.turn=opponentTurn?'player':'opponent';state.cards=[{id:'protector',owner:'opponent',zone:'character',type:'Character',name:'Protector',cost:5,rested:protectorRested,effectSchema:doc},{id:'protected',owner:'opponent',zone:'character',type:'Character',name:'Ally',...target},{id:'source',owner:'player',zone:'character',type:'Character'}];const begun=beginEffectExecution(state,'player','source','main',[{kind:'resolve-action',value:{kind:'ko'}}]),result=begun.requiresSelection?advanceEffectExecution(begun.execution,{targetId:'protected'}):begun,expected=opponentTurn&&protectorRested&&target.cost===5&&!target.rested;assert((result.execution.state.cards.find(card=>card.id==='protected')?.zone==='character')===expected,`Wrong rested-aura result (${opponentTurn},${protectorRested},${target.cost},${target.rested})`);}
 }}];
 if(row.code==='OP08-029')return [{name:'unknown: active Mink Protector protects only eligible Minks',run(doc:EffectDocument){
  for(const protectorRested of [false,true])for(const target of [{name:'Mink',cost:3,traits:['Minks']},{name:'Mink',cost:4,traits:['Minks']},{name:'Pekoms',cost:3,traits:['Minks']},{name:'Other',cost:3,traits:['Minks']}] ){const state=base();state.cards=[{id:'protector',owner:'opponent',zone:'character',type:'Character',name:'Pedro',rested:protectorRested,effectSchema:doc},{id:'protected',owner:'opponent',zone:'character',type:'Character',...target},{id:'source',owner:'player',zone:'character',type:'Character'}];const begun=beginEffectExecution(state,'player','source','main',[{kind:'resolve-action',value:{kind:'ko'}}]),result=begun.requiresSelection?advanceEffectExecution(begun.execution,{targetId:'protected'}):begun,expected=!protectorRested&&target.traits.includes('Minks')&&target.cost<=3&&target.name!=='Pekoms';assert((result.execution.state.cards.find(card=>card.id==='protected')?.zone==='character')===expected,`Wrong trait/cost/exclusion aura result (${protectorRested},${target.name},${target.cost})`);}
 }}];
 if(row.code==='P-052')return [{name:'unknown: DON!! x1 Slash-only battle K.O. protection',run(doc:EffectDocument){
  for(const attached of [0,1])for(const attribute of ['Slash','Strike']){
   const state=base();state.cards=[{id:'protected',owner:'player',zone:'character',type:'Character',power:5000,effectSchema:doc},{id:'attacker',owner:'opponent',zone:'character',type:'Character',power:6000,attributes:[attribute]},...Array.from({length:attached},(_,index)=>({id:`don-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'protected'}))];
   const battle=resolveBattle(state,'attacker','protected'),protectedCard=attached===1&&attribute==='Slash';
   assert(battle.state.cards.find(card=>card.id==='protected')?.zone===(protectedCard?'character':'trash'),`Wrong result for DON=${attached} and ${attribute} attacker`);
  }
  const action=doc.ast.flatMap(ability=>ability.actions).find(action=>action.kind==='prevent-ko');
  assert(action?.kind==='prevent-ko'&&action.attribute==='Slash'&&action.requiresAttachedDon===1,'Schema lost the Slash restriction or DON!! ×1 requirement');
 }}];
 if(row.code==='P-007')return [{name:'unknown: Strike Leaders or Characters are blocked only with DON!! x1',run(doc:EffectDocument){
  for(const attached of [0,1])for(const sourceType of ['Leader','Character'] as const)for(const attribute of ['Strike','Slash']){
   const state=base();state.cards=[{id:'protected',owner:'player',zone:'character',type:'Character',power:5000,effectSchema:doc},{id:'attacker',owner:'opponent',zone:sourceType==='Leader'?'leader':'character',type:sourceType,power:6000,attributes:[attribute]},...Array.from({length:attached},(_,index)=>({id:`don-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'protected'}))];
   const result=resolveBattle(state,'attacker','protected'),protectedCard=attached===1&&attribute==='Strike';
   assert(result.state.cards.find(card=>card.id==='protected')?.zone===(protectedCard?'character':'trash'),`Wrong protection result for DON=${attached}, ${sourceType}, ${attribute}`);
  }
 }}];
 if(row.code==='P-025')return [{name:'unknown: DON!!-gated battle protection excludes Special Characters',run(doc:EffectDocument){
  for(const attached of [0,1])for(const sourceType of ['Leader','Character'] as const)for(const hasSpecial of [false,true]){
   const state=base();state.cards=[{id:'protected',owner:'player',zone:'character',type:'Character',power:5000,effectSchema:doc},{id:'attacker',owner:'opponent',zone:sourceType==='Leader'?'leader':'character',type:sourceType,power:6000,attributes:hasSpecial?['Special']:['Slash']},...Array.from({length:attached},(_,index)=>({id:`don-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'protected'}))];
   const result=resolveBattle(state,'attacker','protected'),protectedCard=attached===1&&sourceType==='Character'&&!hasSpecial;
   assert(result.state.cards.find(card=>card.id==='protected')?.zone===(protectedCard?'character':'trash'),`Wrong excluded-attribute protection result (DON=${attached}, ${sourceType}, Special=${hasSpecial})`);
  }
 }}];
 if(row.code==='OP09-025')return [{name:'unknown: Odyssey Leader condition protects only from Leader battle K.O.',run(doc:EffectDocument){
  for(const hasOdyssey of [false,true])for(const sourceType of ['Leader','Character'] as const){
   const state=base();state.cards=[{id:'protected',owner:'player',zone:'character',type:'Character',power:5000,effectSchema:doc},{id:'own-leader',owner:'player',zone:'leader',type:'Leader',traits:hasOdyssey?['ODYSSEY']:[]},{id:'attacker',owner:'opponent',zone:sourceType==='Leader'?'leader':'character',type:sourceType,power:6000}];
   const result=resolveBattle(state,'attacker','protected'),protectedCard=hasOdyssey&&sourceType==='Leader';
   assert(result.state.cards.find(card=>card.id==='protected')?.zone===(protectedCard?'character':'trash'),`Wrong Leader/condition protection result (Odyssey=${hasOdyssey}, attacker=${sourceType})`);
  }
 }}];
 if(row.code==='OP14-003')return [{name:'unknown: effect protection is limited to Characters at 5000 base power or less',run(doc:EffectDocument){
  for(const sourceType of ['Character','Leader'] as const)for(const power of [5000,6000]){
   const state=base();state.cards=[{id:'protected',owner:'opponent',zone:'character',type:'Character',effectSchema:doc},{id:'source',owner:'player',zone:sourceType==='Leader'?'leader':'character',type:sourceType,power}];
   const begun=beginEffectExecution(state,'player','source','main',[{kind:'resolve-action',value:{kind:'ko'}}]);
   const result=begun.requiresSelection?advanceEffectExecution(begun.execution,{targetId:'protected'}):begun,protectedCard=sourceType==='Character'&&power<=5000;
   assert((result.execution.state.cards.find(card=>card.id==='protected')?.zone==='character')===protectedCard,`Wrong effect-source protection result (${sourceType}, ${power})`);
  }
 }}];
 if(row.code==='OP06-012')return [{name:'unknown: opponent base-power condition gates battle K.O. protection',run(doc:EffectDocument){
  for(const condition of [false,true]){
   const state=base();state.cards=[{id:'protected',owner:'player',zone:'character',type:'Character',power:5000,effectSchema:doc},{id:'attacker',owner:'opponent',zone:'character',type:'Character',power:5000},...(condition?[{id:'large-leader',owner:'opponent' as const,zone:'leader' as const,type:'Leader' as const,power:6000}]:[])];
   const result=resolveBattle(state,'attacker','protected');
   assert(result.state.cards.find(card=>card.id==='protected')?.zone===(condition?'character':'trash'),`Battle protection ignored opponent power condition=${condition}`);
  }
 }}];
 if(row.code==='P-104')return [{name:'unknown: either player DON threshold gates effect removal protection',run(doc:EffectDocument){
  for(const donOwner of ['none','protected','effect-owner'] as const){
   const state=base();state.cards=[{id:'protected',owner:'opponent',zone:'character',type:'Character',effectSchema:doc},{id:'source',owner:'player',zone:'character',type:'Character'},...Array.from({length:donOwner==='none'?0:10},(_,index)=>({id:`${donOwner}-don-${index}`,owner:donOwner==='protected'?'opponent' as const:'player' as const,zone:'cost-area' as const,type:'DON!!' as const}))];
   const result=beginEffectExecution(state,'player','source','main',[{kind:'resolve-action',value:{kind:'ko'}}]);
   const resolved=result.requiresSelection?advanceEffectExecution(result.execution,{targetId:'protected'}):result,expected=donOwner!=='none';
   const inPlay=resolved.execution.state.cards.find(card=>card.id==='protected')?.zone==='character';
   assert(inPlay===expected,`Either-player DON!! condition failed for ${donOwner}`);
  }
 }}];
 if(row.code==='OP13-091')return [{name:'unknown: seven-Trash condition gates effect K.O. protection',run(doc:EffectDocument){
  for(const trashCount of [6,7]){
   const state=base();state.cards=[{id:'protected',owner:'opponent',zone:'character',type:'Character',effectSchema:doc},{id:'source',owner:'player',zone:'character',type:'Character'},...Array.from({length:trashCount},(_,index)=>({id:`opponent-trash-${index}`,owner:'opponent' as const,zone:'trash' as const,type:'Character' as const}))];
   const begun=beginEffectExecution(state,'player','source','main',[{kind:'resolve-action',value:{kind:'ko'}}]);
   const result=begun.requiresSelection?advanceEffectExecution(begun.execution,{targetId:'protected'}):begun;
   const inPlay=result.execution.state.cards.find(card=>card.id==='protected')?.zone==='character';
   assert(inPlay===(trashCount>=7),`K.O. protection ignored the seven-card Trash threshold (${trashCount})`);
  }
 }}];
 if(row.code==='OP11-005')return [...[
  {name:'unknown: DON!!-gated effect K.O. protection checks source Character attribute',run(doc:EffectDocument){
   const commands=[{kind:'resolve-action' as const,value:{kind:'ko' as const}}];
   const scenario=(attached:number,sourceType:'Character'|'Event',sourceAttributes:string[]=[] ,negated=false)=>{
    const state=base();state.cards=[
     {id:'protected',owner:'opponent',zone:'character',type:'Character',effectSchema:doc,effectNegated:negated},
     {id:'source',owner:'player',zone:sourceType==='Character'?'character':'trash',type:sourceType,attributes:sourceAttributes},
     ...Array.from({length:attached},(_,index)=>({id:`attached-${index}`,owner:'opponent' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'protected'})),
    ];
    const begun=beginEffectExecution(state,'player','source','main',commands);
    const result=begun.requiresSelection?advanceEffectExecution(begun.execution,{targetId:'protected'}):begun;
    const protectedCard=attached>=1&&sourceType==='Character'&&!sourceAttributes.some(attribute=>attribute.toLowerCase()==='special')&&!negated;
    const resultCard=result.execution.state.cards.find(card=>card.id==='protected');
    if(protectedCard)assert(Boolean(result.error)&&resultCard?.zone==='character','A protected target must reject the K.O. and remain in play');
    else assert(result.complete&&!result.error&&resultCard?.zone==='trash',`Expected K.O. to resolve (DON=${attached}, source=${sourceType}/${sourceAttributes.join(',')||'no attribute'}, negated=${negated})`);
   };
   scenario(0,'Character');scenario(1,'Character');scenario(1,'Character',['Special']);scenario(1,'Event');scenario(1,'Character',[],true);
   const action=doc.ast.flatMap(ability=>ability.actions).find(action=>action.kind==='prevent-ko');
   assert(action?.kind==='prevent-ko'&&action.excludeAttribute==='Special'&&action.requiresAttachedDon===1,'Schema must preserve the exact DON and excluded-attribute conditions');
  }}
 ],...keywordScenarios(row.effect_text)];
 if(row.code==='OP12-062')return [true,false].map(eligible=>({name:`On Play: Sanji DON condition ${eligible?'met':'unmet'}`,run(doc){
  const state=base();state.cards.push({id:'leader',owner:'player',zone:'leader',type:'Leader',name:eligible?'Sanji':'Zoro'},{id:'reserve-don',owner:'player',zone:'don-deck',type:'DON!!'});
  const started=beginEffectExecution(state,'player','source','on-play',resolveEffectTiming(doc,'on-play').commands);
  const result=started.requiresSelection?advanceEffectExecution(started.execution,{cardIds:eligible?['reserve-don']:[]}):started;
  assert(result.complete&&!result.error,'Conditional DON/draw did not complete');
  assert(result.execution.state.cards.filter(c=>c.zone==='hand').length===(eligible?1:0),'Draw ignored the Leader condition');
  const don=result.execution.state.cards.find(c=>c.id==='reserve-don');
  assert(don?.zone===(eligible?'cost-area':'don-deck'),'DON addition ignored condition');
  if(eligible)assert(don?.rested,'Added DON must be rested');
 }}));
 if(row.code==='OP02-085')return [
  {name:'on-play: pay one own DON, then return one opponent DON',run(doc){
   const state=base();state.cards.push({id:'own-don',owner:'player',zone:'cost-area',type:'DON!!'},{id:'opponent-don-0',owner:'opponent',zone:'cost-area',type:'DON!!'},{id:'opponent-don-1',owner:'opponent',zone:'cost-area',type:'DON!!'});
   const begun=beginEffectExecution(state,'player','source','on-play',resolveEffectTiming(doc,'on-play').commands);
   assert(begun.requiresSelection,'Must pay own DON before returning opponent DON');
   assert(begun.execution.state.cards.filter(card=>card.owner==='opponent'&&card.type==='DON!!').every(card=>card.zone==='cost-area'),'Opponent DON returned before own cost');
   const paid=advanceEffectExecution(begun.execution,{cardIds:['own-don']});
   assert(paid.requiresSelection&&!paid.error,`Opponent DON selection did not follow payment: ${paid.error??'no selection requested'}`);
   const returned=advanceEffectExecution(paid.execution,{cardIds:['opponent-don-1']});
   assert(returned.complete&&!returned.error,'Valid opponent DON return failed');
   assert(returned.execution.state.cards.find(card=>card.id==='own-don')?.zone==='don-deck','Own DON cost was not paid');
   assert(returned.execution.state.cards.find(card=>card.id==='opponent-don-1')?.zone==='don-deck','Opponent DON did not return');
   assert(returned.execution.state.cards.find(card=>card.id==='opponent-don-0')?.zone==='cost-area','Unselected DON changed zone');
  }},
  {name:'on-ko: opponent-turn effect makes opponent choose two DON to return',run(doc){
   const state=base();state.turn='opponent';state.cards.push(...Array.from({length:3},(_,i)=>({id:`opponent-don-${i}`,owner:'opponent' as const,zone:'cost-area' as const,type:'DON!!' as const})));
   const begun=beginEffectExecution(state,'player','source','on-ko',resolveEffectTiming(doc,'on-ko').commands);
   assert(begun.requiresSelection,'On K.O. must request opponent DON choices');
   const done=advanceEffectExecution(begun.execution,{cardIds:['opponent-don-0','opponent-don-2']});
   assert(done.complete&&!done.error,'Opponent did not return exactly two DON');
   assert(done.execution.state.cards.filter(card=>card.zone==='don-deck').length===2,'Wrong number of DON returned');
   assert(done.execution.state.cards.find(card=>card.id==='opponent-don-1')?.zone==='cost-area','Unselected DON changed zone');
   const ownTurn={...state,turn:'player' as const};const skipped=beginEffectExecution(ownTurn,'player','source','on-ko',resolveEffectTiming(doc,'on-ko').commands);
   assert(skipped.complete&&!skipped.error&&skipped.execution.state.cards.filter(card=>card.type==='DON!!').every(card=>card.zone==='cost-area'),'Opponent-turn condition did not suppress the effect');
  }}
 ];
 if(row.code==='OP11-022')return [
  {name:'unknown: Leader attack prohibition blocks an otherwise legal attack',run(doc){
   const state=base();state.cards=[{id:'source',owner:'player',zone:'leader',type:'Leader',effectSchema:doc},{id:'enemy',owner:'opponent',zone:'leader',type:'Leader'}];
   const blocked=declareAttack(state,'player','source','enemy');assert(blocked.error,'Leader with printed cannot-attack text attacked');assert(blocked.state===state,'Rejected attack mutated the board');
   const withoutText=structuredClone(state);delete withoutText.cards[0].effectSchema;assert(!declareAttack(withoutText,'player','source','enemy').error,'A normal Leader was incorrectly prohibited from attacking');
  }},
  {name:'activate-main: rest DON, turn top Life face-up, and play only an eligible hand Character',run(doc){
   const state=base();state.cards=[{id:'source',owner:'player',zone:'leader',type:'Leader',effectSchema:doc},{id:'don',owner:'player',zone:'cost-area',type:'DON!!'}, {id:'life-top',owner:'player',zone:'life',type:'Character',faceUp:false},
    {id:'neptunian',owner:'player',zone:'hand',type:'Character',cost:1,traits:['Neptunian']},{id:'too-costly',owner:'player',zone:'hand',type:'Character',cost:2,traits:['Neptunian']},{id:'wrong-name',owner:'player',zone:'hand',type:'Character',cost:1,name:'Chopper',traits:['Tony Tony Chopper']},{id:'megalo',owner:'player',zone:'hand',type:'Character',cost:1,name:'Megalo',traits:['Fish-Man']}];
   const begun=beginEffectExecution(state,'player','source','activate-main',resolveEffectTiming(doc,'activate-main').commands);assert(begun.requiresSelection,'Must choose the rested DON payment');assert(!begun.execution.state.cards.find(card=>card.id==='life-top')?.faceUp,'Life turned face-up before DON was paid');
   const paid=advanceEffectExecution(begun.execution,{cardIds:['don']});assert(paid.requiresSelection&&!paid.error,'Play choice did not follow costs');assert(paid.execution.state.cards.find(card=>card.id==='life-top')?.faceUp,'Top Life was not turned face-up as a cost');
   const illegal=advanceEffectExecution(paid.execution,{cardIds:['too-costly']});assert(illegal.error&&!illegal.complete,'Character costing more than field DON was accepted');
   const wrong=advanceEffectExecution(paid.execution,{cardIds:['wrong-name']});assert(wrong.error&&!wrong.complete,'Unlisted Character was accepted by the alternatives restriction');
   const played=advanceEffectExecution(paid.execution,{cardIds:['megalo']});assert(played.complete&&!played.error,'Printed alternate [Megalo] choice was rejected');assert(played.execution.state.cards.find(card=>card.id==='megalo')?.zone==='character','Megalo did not enter the field');assert(played.execution.state.cards.find(card=>card.id==='neptunian')?.zone==='hand','Unselected Neptunian moved');
  }}
 ];
 if(row.code==='EB04-043')return [
  {name:'on-play: mill exactly the top two cards from the deck',run(doc){
   const state=base();const before=state.cards.map(card=>card.id);
   const result=beginEffectExecution(state,'player','kaku','on-play',resolveEffectTiming(doc,'on-play').commands);
   assert(result.complete&&!result.error,'Kaku On Play mill did not resolve');
   assert(JSON.stringify(result.execution.state.cards.filter(card=>card.zone==='trash').map(card=>card.id))===JSON.stringify(before.slice(0,2)),'Kaku must mill the top two, not choose them');
   assert(result.execution.state.cards.filter(card=>card.zone==='deck').length===6,'Milled cards remain in the deck');
  }},
  {name:'continuous: accept the once-per-turn replacement on any eligible black Character',run(doc){
   const state=base();state.cards=[{id:'kaku',owner:'opponent',zone:'character',type:'Character',name:'Kaku',color:'Black',cost:3,effectSchema:doc},{id:'target',owner:'opponent',zone:'character',type:'Character',name:'Other black Character',color:'Black',cost:5},...['trash-a','trash-b','trash-c','trash-extra'].map(id=>({id,owner:'opponent' as const,zone:'trash' as const,type:'Character' as const}))];
   const commands=[{kind:'resolve-action' as const,value:{kind:'ko' as const}}];
   const start=beginEffectExecution(state,'player','attacker','main',commands);const target=advanceEffectExecution(start.execution,{targetId:'target'});
   assert(target.requiresSelection,'Kaku replacement must ask before the eligible Character is K.O.d');
   assert(target.execution.state.cards.find(card=>card.id==='target')?.zone==='character','Target moved before replacement choice');
   const paid=advanceEffectExecution(target.execution,{choice:'accept',cardIds:['trash-a','trash-b','trash-c']});
   assert(paid.complete&&!paid.error,'Exactly three Trash cards should pay the replacement');
   assert(paid.execution.state.cards.find(card=>card.id==='target')?.zone==='character','Paid replacement did not save target');
   assert(JSON.stringify(paid.execution.state.cards.filter(card=>card.zone==='deck').map(card=>card.id))===JSON.stringify(['trash-a','trash-b','trash-c']),'Selected Trash cards were not placed on deck bottom in order');
   assert(paid.execution.state.cards.find(card=>card.id==='trash-extra')?.zone==='trash','Unselected Trash card moved');
   const secondStart=beginEffectExecution(paid.execution.state,'player','attacker','main',commands);const second=advanceEffectExecution(secondStart.execution,{targetId:'target'});
   assert(second.complete&&second.execution.state.cards.find(card=>card.id==='target')?.zone==='trash','Kaku replacement was incorrectly available twice in one turn');
  }},
  {name:'continuous: decline or reject non-qualifying K.O. replacements',run(doc){
   const state=base();state.cards=[{id:'kaku',owner:'opponent',zone:'character',type:'Character',name:'Kaku',color:'Black',cost:3,effectSchema:doc},{id:'too-costly',owner:'opponent',zone:'character',type:'Character',color:'Black',cost:6},{id:'wrong-color',owner:'opponent',zone:'character',type:'Character',color:'Red',cost:3},...['trash-a','trash-b','trash-c'].map(id=>({id,owner:'opponent' as const,zone:'trash' as const,type:'Character' as const}))];
   const commands=[{kind:'resolve-action' as const,value:{kind:'ko' as const}}];
   for(const id of ['too-costly','wrong-color']){const start=beginEffectExecution(state,'player','attacker','main',commands);const result=advanceEffectExecution(start.execution,{targetId:id});assert(result.complete&&!result.error,'Non-qualifying Character should resolve ordinary K.O.');assert(result.execution.state.cards.find(card=>card.id===id)?.zone==='trash','Non-qualifying Character should not receive replacement');}
   const replacementStart=beginEffectExecution(state,'player','attacker','main',commands);const declined=advanceEffectExecution(replacementStart.execution,{targetId:'kaku'});assert(declined.requiresSelection,'Eligible Kaku should be offered the optional replacement');
   const result=advanceEffectExecution(declined.execution,{choice:'decline'});assert(result.complete&&!result.error,'Declining replacement should allow the K.O.');assert(result.execution.state.cards.find(card=>card.id==='kaku')?.zone==='trash','Declined Kaku should be K.O.d');
  }}
 ];
 if(row.code==='EB04-054')return [
  {name:'on-play: only at two or less Life, choose whether to add the top deck card to Life',run(doc){
   for(const lifeCount of [2,3]){const state=base();for(let i=0;i<lifeCount;i++)state.cards.push({id:`life-${lifeCount}-${i}`,owner:'player',zone:'life',type:'Character'});const start=beginEffectExecution(state,'player','kuma','on-play',resolveEffectTiming(doc,'on-play').commands);
    if(lifeCount===2){assert(start.requiresSelection,'Kuma must offer the top deck card at two Life');const taken=advanceEffectExecution(start.execution,{cardIds:['deck-0']});assert(taken.complete&&!taken.error,'Kuma failed to add the top deck card');assert(taken.execution.state.cards.find(card=>card.id==='deck-0')?.zone==='life','Top deck card did not enter Life');assert(taken.execution.state.cards.find(card=>card.id==='deck-1')?.zone==='deck','Kuma took more than one deck card');
     const skipped=advanceEffectExecution(start.execution,{cardIds:[]});assert(skipped.complete&&!skipped.error,'Kuma could not decline the optional Life addition');assert(skipped.execution.state.cards.find(card=>card.id==='deck-0')?.zone==='deck','Declining moved the top card');
    }else assert(start.complete&&!start.error&&start.execution.state.cards.find(card=>card.id==='deck-0')?.zone==='deck','Kuma On Play ignored the Life threshold');
   }
  }},
  {name:'on-ko: add only the chosen top opponent Life card to Kuma owner hand',run(doc){
   const state=base();state.cards=[{id:'op-life-0',owner:'opponent',zone:'life',type:'Character'},{id:'op-life-1',owner:'opponent',zone:'life',type:'Character'},{id:'own-life',owner:'player',zone:'life',type:'Character'}];
   const start=beginEffectExecution(state,'player','kuma','on-ko',resolveEffectTiming(doc,'on-ko').commands);assert(start.requiresSelection,'Kuma On K.O. should offer up to the top opposing Life card');
   const invalid=advanceEffectExecution(start.execution,{cardIds:['op-life-1']});assert(!invalid.complete&&invalid.error,'Kuma must not select below the top Life card');
   const taken=advanceEffectExecution(start.execution,{cardIds:['op-life-0']});assert(taken.complete&&!taken.error,'Kuma failed to take top opponent Life');assert(taken.execution.state.cards.find(card=>card.id==='op-life-0')?.zone==='hand','Opponent Life did not go to the effect owner hand');assert(taken.execution.state.cards.find(card=>card.id==='op-life-1')?.zone==='life','Unselected Life moved');assert(taken.execution.state.cards.find(card=>card.id==='own-life')?.zone==='life','Effect changed its controller Life');
   const skipped=advanceEffectExecution(start.execution,{cardIds:[]});assert(skipped.complete&&!skipped.error&&skipped.execution.state.cards.every(card=>card.zone==='life'),'Optional zero-card choice failed');
  }}
 ];
 if(row.code==='OP01-024')return [
  {name:'unknown: DON!! ×2 protects only against battle K.O. by Strike Characters',run(doc){
   for(const attached of [0,1,2])for(const attribute of ['Strike','Slash']){const state=base();state.cards=[{id:'luffy',owner:'player',zone:'character',type:'Character',name:'Monkey.D.Luffy',color:'Red',cost:2,power:3000,effectSchema:doc},{id:'attacker',owner:'opponent',zone:'character',type:'Character',name:'Attacker',power:7000,attributes:[attribute]},...Array.from({length:attached},(_,index)=>({id:`attached-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'luffy'}))];
    const battle=resolveBattle(state,'attacker','luffy');const protectedCard=attached>=2&&attribute==='Strike';assert(battle.state.cards.find(card=>card.id==='luffy')?.zone===(protectedCard?'character':'trash'),'Battle K.O. protection ignored the exact attribute or DON threshold');
   }
  }},
  {name:'activate-main: attach zero to two rested cost-area DON!! to this Character',run(doc){
   const state=base();state.cards=[{id:'luffy',owner:'player',zone:'character',type:'Character',name:'Monkey.D.Luffy',effectSchema:doc},{id:'rested-a',owner:'player',zone:'cost-area',type:'DON!!',rested:true},{id:'rested-b',owner:'player',zone:'cost-area',type:'DON!!',rested:true},{id:'active',owner:'player',zone:'cost-area',type:'DON!!',rested:false}];
   const start=beginEffectExecution(state,'player','luffy','activate-main',resolveEffectTiming(doc,'activate-main').commands);assert(start.requiresSelection,'Activate Main must offer an optional DON attachment choice');
   const invalid=advanceEffectExecution(start.execution,{cardIds:['active']});assert(!invalid.complete&&invalid.error,'Active DON!! should not satisfy the rested DON!! choice');
   const attached=advanceEffectExecution(start.execution,{cardIds:['rested-a','rested-b']});assert(attached.complete&&!attached.error,'Could not attach the selected rested DON!!');assert(attached.execution.state.cards.filter(card=>card.attachedTo==='luffy').length===2,'DON!! did not attach to the source Character');assert(attached.execution.state.cards.find(card=>card.id==='active')?.zone==='cost-area'&&!attached.execution.state.cards.find(card=>card.id==='active')?.attachedTo,'Unselected active DON!! moved');
   const none=advanceEffectExecution(start.execution,{cardIds:[]});assert(none.complete&&!none.error&&none.execution.state.cards.every(card=>!card.attachedTo),'Could not choose zero DON!!');
  }}
 ];
 if(row.code==='OP01-120')return [
  {name:'when-attacking: prevent eligible opponent Blockers from activating for this battle',run(doc){
   const state=base();state.cards=[
    {id:'shanks',owner:'player',zone:'character',type:'Character',name:'Shanks',effectSchema:doc},
    {id:'small-blocker',owner:'opponent',zone:'character',type:'Character',power:2000,keywords:['blocker']},
    {id:'large-blocker',owner:'opponent',zone:'character',type:'Character',power:3000,keywords:['blocker']},
    {id:'non-blocker',owner:'opponent',zone:'character',type:'Character',power:1000},
   ];
   const action=resolveEffectTiming(doc,'when-attacking').commands.find(command=>command.kind==='resolve-action'&&command.value.kind==='prevent-keyword-activation');
   if(!action||action.kind!=='resolve-action')throw new Error('Shanks When Attacking restriction was not parsed');
   const applied=applyEffectAction(state,'player',action.value as Extract<EffectAction,{kind:'prevent-keyword-activation'}>);
   assert(declareBlock(applied.state,'opponent','small-blocker').error==='This Blocker cannot activate during this battle.','2,000-power Blocker should be disabled for the battle');
   assert(!declareBlock(applied.state,'opponent','large-blocker').error,'Blocker above 2,000 power should remain usable');
   assert(/does not have Blocker/.test(declareBlock(applied.state,'opponent','non-blocker').error??''),'Non-Blocker must remain illegal');
   const expired=expireEffectModifiers(applied.state,'battle');
   assert(!declareBlock(expired,'opponent','small-blocker').error,'Battle restriction should expire after this battle');
  }}
 ];
 if(row.code==='OP01-086')return [
  {name:'counter: boost one own Leader/Character, then return an active cost-3-or-less Character',run(doc){
   const state=base();state.cards=[
    {id:'own-leader',owner:'player',zone:'leader',type:'Leader',power:5000},
    {id:'own-active',owner:'player',zone:'character',type:'Character',cost:3,power:4000},
    {id:'own-rested',owner:'player',zone:'character',type:'Character',cost:2,power:3000,rested:true},
    {id:'enemy-active',owner:'opponent',zone:'character',type:'Character',cost:3,power:4000},
    {id:'enemy-costly',owner:'opponent',zone:'character',type:'Character',cost:4,power:5000},
   ];
   const commands=resolveEffectTiming(doc,'counter').commands;
   const started=beginEffectExecution(state,'player','overheat','counter',commands);
   if(!started.requiresSelection)throw new Error('Counter should first select its power target');
   const boosted=advanceEffectExecution(started.execution,{targetId:'own-leader'});
   if(!boosted.requiresSelection)throw new Error('Counter should then select a return target');
   const invalid=advanceEffectExecution(boosted.execution,{targetId:'own-rested'});
   if(!invalid.error)throw new Error('Rested Character should not satisfy active-only return');
   const returned=advanceEffectExecution(boosted.execution,{targetId:'enemy-active'});
   assert(returned.complete&&!returned.error,'Legal opponent Character should return to its owner hand');
   assert(returned.execution.state.cards.find(card=>card.id==='own-leader')?.powerModifier===4000,'Counter power should apply before its return');
   assert(returned.execution.state.cards.find(card=>card.id==='enemy-active')?.zone==='hand','Returned card did not go to its owner hand');
   assert(returned.execution.state.cards.find(card=>card.id==='own-rested')?.zone==='character','Invalid target moved');
  }},
  {name:'trigger: return any field card costing 4 or less, without limiting the owner',run(doc){
   const state=base();state.cards=[
    {id:'own-stage',owner:'player',zone:'stage',type:'Stage',cost:4},
    {id:'enemy-character',owner:'opponent',zone:'character',type:'Character',cost:4},
    {id:'too-costly',owner:'opponent',zone:'character',type:'Character',cost:5},
   ];
   const started=beginEffectExecution(state,'player','overheat','trigger',resolveEffectTiming(doc,'trigger').commands);
   if(!started.requiresSelection)throw new Error('Trigger should ask for a card to return');
   const invalid=advanceEffectExecution(started.execution,{targetId:'too-costly'});
   if(!invalid.error)throw new Error('Trigger accepted a card above 4 cost');
   const returned=advanceEffectExecution(started.execution,{targetId:'own-stage'});
   assert(returned.complete&&!returned.error,'Trigger should accept own eligible Stage');
   assert(returned.execution.state.cards.find(card=>card.id==='own-stage')?.zone==='hand','Eligible card did not return to hand');
   assert(returned.execution.state.cards.find(card=>card.id==='enemy-character')?.zone==='character','Unselected card moved');
  }}
 ];
 if(row.code==='OP01-112')return [{name:'Activate Main: return exactly one DON!!, then attack an active opponent Character this turn',run(doc){
  const state=base();state.turnNumber=2;state.cards=[
   {id:'page-one',owner:'player',zone:'character',type:'Character',name:'Page One',effectSchema:doc},
   {id:'don-a',owner:'player',zone:'cost-area',type:'DON!!'},
   {id:'don-b',owner:'player',zone:'cost-area',type:'DON!!'},
   {id:'active-target',owner:'opponent',zone:'character',type:'Character',power:5000},
   {id:'other-attacker',owner:'player',zone:'character',type:'Character'},
  ];
  const started=beginEffectExecution(state,'player','page-one','activate-main',resolveEffectTiming(doc,'activate-main').commands);
  if(!started.requiresSelection)throw new Error('Page One must ask which DON!! to return');
  const paid=advanceEffectExecution(started.execution,{cardIds:['don-a']});
  const granted=paid.complete?paid:advanceEffectExecution(paid.execution,{targetId:'page-one'});
  assert(granted.complete&&!granted.error,'Permission did not resolve');
  assert(granted.execution.state.cards.find(card=>card.id==='don-a')?.zone==='don-deck','Paid DON!! did not return to DON!! deck');
  const attack=declareAttack(granted.execution.state,'player','page-one','active-target');
  assert(!attack.error,'Page One could not attack the active opponent Character');
  const other=declareAttack(granted.execution.state,'player','other-attacker','active-target');
  assert(/must be rested/.test(other.error??''),'Permission incorrectly applied to another Character');
  const expired=expireEffectModifiers(granted.execution.state,'turn-end');
  const afterTurn=declareAttack(expired,'player','page-one','active-target');
  assert(/must be rested/.test(afterTurn.error??''),'Permission did not expire at turn end');
 }}];
 if(row.code==='OP01-080')return [{name:'On K.O.: draw exactly the top card of the effect owner deck',run(doc){
  const state=base();state.cards=[
   {id:'top',owner:'player',zone:'deck',type:'Character'},
   {id:'next',owner:'player',zone:'deck',type:'Character'},
   {id:'opponent-top',owner:'opponent',zone:'deck',type:'Character'},
  ];
  const result=beginEffectExecution(state,'player','zala','on-ko',resolveEffectTiming(doc,'on-ko').commands);
  assert(result.complete&&!result.error,'On K.O. draw should resolve without a choice');
  assert(result.execution.state.cards.find(card=>card.id==='top')?.zone==='hand','Did not draw one card');
  assert(result.execution.state.cards.find(card=>card.id==='next')?.zone==='deck','Drew more than one card');
  assert(result.execution.state.cards.find(card=>card.id==='opponent-top')?.zone==='deck','Changed the opponent deck');
 }}];
 if(row.code==='OP01-038')return [
  {name:'When Attacking: require one attached DON and K.O. only a rested opponent Character costing 2 or less',run(doc){
   const state=base();state.turnNumber=2;state.cards=[
    {id:'kanjuro',owner:'player',zone:'character',type:'Character',cost:2,power:3000,effectSchema:doc},
    {id:'eligible',owner:'opponent',zone:'character',type:'Character',cost:2,power:3000,rested:true},
    {id:'active',owner:'opponent',zone:'character',type:'Character',cost:2,power:3000,rested:false},
    {id:'expensive',owner:'opponent',zone:'character',type:'Character',cost:3,power:4000,rested:true},
   ];
   const commands=resolveEffectTiming(doc,'when-attacking').commands;
   const noDon=beginEffectExecution(state,'player','kanjuro','when-attacking',commands);
   assert(noDon.complete&&noDon.execution.commandIndex===commands.length&&noDon.execution.state.cards.find(card=>card.id==='eligible')?.zone==='character','DON!! ×1 prerequisite was not enforced');
   state.cards.push({id:'attached-don',owner:'player',zone:'cost-area',type:'DON!!',attachedTo:'kanjuro'});
   const attack=declareAttack(state,'player','kanjuro','eligible');assert(!attack.error,'Attached DON should not prevent the basic attack');
   const started=beginEffectExecution(attack.state,'player','kanjuro','when-attacking',commands);
   if(!started.requiresSelection)throw new Error('DON!! ×1 should enable Kanjuro’s When Attacking effect');
   const command=commands.find(item=>item.kind==='resolve-action'&&item.value.kind==='ko');
   if(!command||command.kind!=='resolve-action')throw new Error('Kanjuro When Attacking K.O. action was not parsed');
   const ko=advanceEffectExecution(started.execution,{targetId:'eligible'});
   assert(ko.execution.state.cards.find(card=>card.id==='eligible')?.zone==='trash','Eligible rested Character was not K.O.’d');
   for(const id of ['active','expensive']){const rejected=advanceEffectExecution(started.execution,{targetId:id});assert(Boolean(rejected.error),`Invalid target ${id} was accepted`);}
  }},
  {name:'On K.O.: opponent chooses exactly one card from the effect owner hand to trash',run(doc){
   const state=base();state.cards=[{id:'hand-a',owner:'player',zone:'hand',type:'Character'},{id:'hand-b',owner:'player',zone:'hand',type:'Event'}];
   const commands=resolveEffectTiming(doc,'on-ko').commands;assert(commands.length===1&&commands[0].kind==='resolve-action'&&commands[0].value.kind==='trash','On K.O. discard sequence was not parsed');
   const action=commands[0].value as Extract<EffectAction,{kind:'trash'}>;
   assert(action.chooser==='opponent'&&action.scope==='hand'&&action.amount===1,'Opponent chooser, source hand, or exact count was lost');
   const missing=applyEffectAction(state,'player',action);assert(Boolean(missing.requiresSelection),'Kanjuro should pause for opponent hand choice');
   const discarded=applyEffectAction(state,'player',action,{cardIds:['hand-b']});
   assert(discarded.state.cards.find(card=>card.id==='hand-b')?.zone==='trash','Selected card was not trashed');
   assert(discarded.state.cards.find(card=>card.id==='hand-a')?.zone==='hand','Unselected hand card moved');
  }}
 ];
 if(row.code==='OP04-090')return [
 {name:'unknown: this Character may attack active Characters without a turn limit',run(doc){const state=base();state.turnNumber=2;state.cards=[{id:'luffy',owner:'player',zone:'character',type:'Character',rested:false,effectSchema:doc},{id:'active-enemy',owner:'opponent',zone:'character',type:'Character',rested:false}];const attack=declareAttack(state,'player','luffy','active-enemy');assert(!attack.error,'Luffy’s static effect should permit attacks against active Characters');}},
 {name:'Activate Main: optionally bottom-deck seven Trash cards, ready Luffy, then skip its next refresh',run(doc){
  const state=base();state.turnNumber=2;state.cards=[
   {id:'luffy',owner:'player',zone:'character',type:'Character',name:'Monkey.D.Luffy (090)',rested:true,effectSchema:doc},
   ...Array.from({length:8},(_,index)=>({id:`trash-${index}`,owner:'player' as const,zone:'trash' as const,type:'Character' as const})),
   {id:'draw-next',owner:'player',zone:'deck',type:'Character'},
  ];
  const attackState=state;
  const commands=resolveEffectTiming(doc,'activate-main').commands;
  const started=beginEffectExecution(attackState,'player','luffy','activate-main',commands);
  if(!started.requiresSelection)throw new Error('Luffy must ask for exactly seven Trash cards');
  const tooFew=advanceEffectExecution(started.execution,{cardIds:['trash-0','trash-1']});assert(Boolean(tooFew.error),'Accepted fewer than seven Trash cards');
  const paidIds=Array.from({length:7},(_,index)=>`trash-${index}`);
  const paid=advanceEffectExecution(started.execution,{cardIds:paidIds});
  assert(paid.complete&&!paid.error,'Seven-card activation did not finish');
  assert(paid.execution.state.cards.find(card=>card.id==='luffy')?.rested===false,'Luffy did not become active');
  const bottom=paid.execution.state.cards.slice(-7).map(card=>card.id);assert(bottom.join(',')===paidIds.join(','),'Trash card order was not preserved at deck bottom');
  assert(paid.execution.state.turnEffects.some(effect=>effect.kind==='skip-next-refresh'&&effect.target==='luffy'),'Next Refresh skip was not registered');
  const nextTurn=beginTurn(paid.execution.state,'player',3);
  assert(nextTurn.state.cards.find(card=>card.id==='luffy')?.rested===true,'Luffy became active during the next Refresh Phase');
  assert(!nextTurn.state.turnEffects.some(effect=>effect.kind==='skip-next-refresh'&&effect.target==='luffy'),'Refresh restriction was not consumed');
  const declined=advanceEffectExecution(started.execution,{choice:'decline'});
  assert(declined.complete&&declined.execution.state.cards.find(card=>card.id==='luffy')?.rested===true,'Declining the optional payment still readied Luffy');
 }}];
 if(row.code==='OP04-082')return [
  {name:'On Play: only under Rebecca Leader, K.O. a cost-1-or-less Character then trash the top deck card',run(doc){
   for(const leaderName of ['Rebecca','Luffy']){const state=base();state.cards=[
    {id:'kyros',owner:'player',zone:'character',type:'Character',name:'Kyros',effectSchema:doc},
    {id:'leader',owner:'player',zone:'leader',type:'Leader',name:leaderName},
    {id:'legal',owner:'opponent',zone:'character',type:'Character',cost:1,rested:true},
    {id:'too-costly',owner:'opponent',zone:'character',type:'Character',cost:2,rested:true},
    {id:'deck-top',owner:'player',zone:'deck',type:'Character'},
    {id:'deck-next',owner:'player',zone:'deck',type:'Character'},
   ];const started=beginEffectExecution(state,'player','kyros','on-play',resolveEffectTiming(doc,'on-play').commands);
    if(leaderName==='Rebecca'){if(!started.requiresSelection)throw new Error('Rebecca condition should open the K.O. choice');const invalid=advanceEffectExecution(started.execution,{targetId:'too-costly'});assert(Boolean(invalid.error),'Kyros accepted a target above cost 1');const chosen=advanceEffectExecution(started.execution,{targetId:'legal'});assert(chosen.complete&&!chosen.error,'Legal K.O. did not complete with the deck-trash follow-up');assert(chosen.execution.state.cards.find(card=>card.id==='legal')?.zone==='trash','Legal Character was not K.O.’d');assert(chosen.execution.state.cards.find(card=>card.id==='deck-top')?.zone==='trash','Did not trash the top deck card');assert(chosen.execution.state.cards.find(card=>card.id==='deck-next')?.zone==='deck','Trashed more than the top deck card');}
    else assert(started.complete&&!started.error&&started.execution.state.cards.every(card=>card.zone!=='trash'),'Effect ran without Rebecca as Leader');
   }
  }},
  {name:'unknown: choose an active Leader or Corrida Coliseum to replace Kyros’s K.O., or decline',run(doc){
   const state=base();state.cards=[
    {id:'attacker',owner:'player',zone:'character',type:'Character',power:6000},
    {id:'kyros',owner:'opponent',zone:'character',type:'Character',power:5000,name:'Kyros',effectSchema:doc},
    {id:'opponent-leader',owner:'opponent',zone:'leader',type:'Leader',name:'Rebecca',rested:false},
    {id:'coliseum',owner:'opponent',zone:'stage',type:'Stage',name:'Corrida Coliseum',rested:false},
    {id:'other-stage',owner:'opponent',zone:'stage',type:'Stage',name:'Wrong Stage',rested:false},
   ];
   const offer=resolveBattle(state,'attacker','kyros');assert(Boolean(offer.requiresSelection),'Kyros did not offer its K.O. replacement');assert(offer.state.cards.find(card=>card.id==='kyros')?.zone==='character','Kyros moved before the replacement choice');
   const invalid=resolveBattle(state,'attacker','kyros',6000,5000,{choice:'accept',cardId:'other-stage'});assert(Boolean(invalid.error),'Accepted an unrelated Stage as replacement payment');
   const paid=resolveBattle(state,'attacker','kyros',6000,5000,{choice:'accept',cardId:'coliseum'});assert(paid.replacementResolved&&paid.state.cards.find(card=>card.id==='kyros')?.zone==='character','Resting Corrida Coliseum did not replace the K.O.');assert(paid.state.cards.find(card=>card.id==='coliseum')?.rested,'Replacement cost did not rest the selected Stage');
   const declined=resolveBattle(state,'attacker','kyros',6000,5000,{choice:'decline'});assert(declined.state.cards.find(card=>card.id==='kyros')?.zone==='trash','Declining did not let the K.O. happen');
  }}
 ];
 if(row.code==='OP04-094')return [
  {name:'Main: the 15-card Trash threshold changes the optional K.O. cap from 4 to 6',run(doc){
   for(const trashCount of [14,15]){
    const state=base();state.cards=[{id:'source',owner:'player',zone:'hand',type:'Event'},...Array.from({length:trashCount},(_,i)=>({id:`trash-${i}`,owner:'player' as const,zone:'trash' as const,type:'Character' as const})),{id:'cost-4',owner:'opponent',zone:'character',type:'Character',cost:4},{id:'cost-5',owner:'opponent',zone:'character',type:'Character',cost:5},{id:'cost-6',owner:'opponent',zone:'character',type:'Character',cost:6},{id:'cost-7',owner:'opponent',zone:'character',type:'Character',cost:7}];
    const begun=beginEffectExecution(state,'player','source','main',resolveEffectTiming(doc,'main').commands);assert(begun.requiresSelection,'Main must ask whether to K.O. up to one eligible Character');
    const atFour=advanceEffectExecution(begun.execution,{targetId:'cost-4'});assert(atFour.complete&&!atFour.error&&atFour.execution.state.cards.find(card=>card.id==='cost-4')?.zone==='trash','Cost-4 target should be legal at either threshold');
    for(const id of trashCount===14?['cost-5','cost-6']:['cost-7']){const invalid=advanceEffectExecution(begun.execution,{targetId:id});assert(invalid.error&&!invalid.complete,`${id} was legal at ${trashCount} Trash cards`);}
    if(trashCount===15){const atSix=advanceEffectExecution(begun.execution,{targetId:'cost-6'});assert(atSix.complete&&!atSix.error&&atSix.execution.state.cards.find(card=>card.id==='cost-6')?.zone==='trash','Cost-6 target should be legal at 15 Trash cards');}
    const none=advanceEffectExecution(begun.execution,{cardIds:[]});assert(none.complete&&!none.error,'Main should allow choosing zero Characters');
   }
  }},
  {name:'Trigger: optionally rest your active Leader before choosing a cost-5-or-less opponent Character',run(doc){
   const state=base();state.cards=[{id:'source',owner:'player',zone:'life',type:'Event'},{id:'leader',owner:'player',zone:'leader',type:'Leader',rested:false},{id:'legal',owner:'opponent',zone:'character',type:'Character',cost:5},{id:'too-costly',owner:'opponent',zone:'character',type:'Character',cost:6}];
   const begun=beginEffectExecution(state,'player','source','trigger',resolveEffectTiming(doc,'trigger').commands);assert(begun.requiresSelection&&begun.execution.commands[begun.execution.commandIndex]?.kind==='pay-cost','Trigger must offer the optional Leader rest before the K.O. choice');
   const invalid=advanceEffectExecution(begun.execution,{cardIds:['too-costly']});assert(invalid.error&&!invalid.complete,'Trigger accepted a cost-6 Character');assert(!invalid.execution.state.cards.find(card=>card.id==='leader')?.rested,'Leader was rested before confirming payment');
   const paid=advanceEffectExecution(begun.execution,{cardIds:['leader']});assert(paid.requiresSelection&&!paid.error,'K.O. choice must follow Leader payment');assert(paid.execution.state.cards.find(card=>card.id==='leader')?.rested,'Leader rest cost was not paid first');
   const chosen=advanceEffectExecution(paid.execution,{targetId:'legal'});assert(chosen.complete&&!chosen.error&&chosen.execution.state.cards.find(card=>card.id==='legal')?.zone==='trash','Legal Trigger target failed after payment');
   const declined=advanceEffectExecution(begun.execution,{choice:'decline'});assert(declined.complete&&!declined.error,'Optional Trigger cost could not be declined');assert(!declined.execution.state.cards.find(card=>card.id==='leader')?.rested&&declined.execution.state.cards.find(card=>card.id==='legal')?.zone==='character','Declining the rest cost must skip the Trigger K.O.');
  }}
 ];
 if(row.code==='ST19-002')return [{name:'On Play: choose exactly two black Navy cards before drawing three',run(doc){
  const state=base();state.cards.push({id:'leader',owner:'player',zone:'leader',type:'Leader',traits:['Navy']},...['cost-1','cost-2'].map(id=>({id,owner:'player' as const,zone:'hand' as const,type:'Character' as const,color:'Black',traits:['Navy']})));
  const started=beginEffectExecution(state,'player','source','on-play',resolveEffectTiming(doc,'on-play').commands);
  assert(started.requiresSelection,'Must request hand-cost selection');
  assert(started.execution.state.cards.filter(c=>c.zone==='hand').length===2,'Drew before paying cost');
  const invalid=advanceEffectExecution(started.execution,{cardIds:['cost-1']});
  assert(!invalid.complete,'Accepted only one cost card');
  assert(invalid.execution.state.cards.filter(c=>c.zone==='trash').length===0,'Partial cost was paid');
  const result=advanceEffectExecution(started.execution,{cardIds:['cost-1','cost-2']});
  assert(result.complete&&!result.error,'Valid cost failed');
  assert(result.execution.state.cards.filter(c=>c.zone==='trash').length===2,'Did not trash both cost cards');
  assert(result.execution.state.cards.filter(c=>c.zone==='hand').map(c=>c.id).join(',')==='deck-0,deck-1,deck-2','Did not draw exactly three top cards');
 }}];
 if(row.code==='OP02-030')return [
  {name:'activate-main: pay three active DON before readying this Character',run(doc){
   const state=base();state.cards=[{id:'source',owner:'player',zone:'character',type:'Character',rested:true,effectText:row.effect_text,effectSchema:doc},...Array.from({length:3},(_,i)=>({id:`don-${i}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:false}))];
   const begun=beginEffectExecution(state,'player','source','activate-main',resolveEffectTiming(doc,'activate-main').commands);
   assert(begun.requiresSelection,'Must choose the three DON payments');
   assert(begun.execution.state.cards.find(card=>card.id==='source')?.rested,'Source readied before payment');
   const paid=advanceEffectExecution(begun.execution,{cardIds:['don-0','don-1','don-2']});
   assert(paid.complete&&!paid.error,'Paid activation did not resolve');
   assert(paid.execution.state.cards.find(card=>card.id==='source')?.rested===false,'Character did not become active');
   assert(paid.execution.state.cards.filter(card=>card.type==='DON!!'&&card.rested).length===3,'Did not rest exactly three DON');
  }},
  {name:'on-ko: choose exactly a green cost-3 Land of Wano Character from deck, then shuffle',run(doc){
   const state=base();state.cards=[
    {id:'legal',owner:'player',zone:'deck',type:'Character',name:'Kinemon',color:'Green',cost:3,traits:['Land of Wano']},
    {id:'wrong-color',owner:'player',zone:'deck',type:'Character',name:'Kinemon',color:'Red',cost:3,traits:['Land of Wano']},
    {id:'wrong-cost',owner:'player',zone:'deck',type:'Character',name:'Kinemon',color:'Green',cost:4,traits:['Land of Wano']},
    {id:'wrong-trait',owner:'player',zone:'deck',type:'Character',name:'Kinemon',color:'Green',cost:3,traits:['Straw Hat Crew']},
   ];
   const begun=beginEffectExecution(state,'player','source','on-ko',resolveEffectTiming(doc,'on-ko').commands);
   assert(begun.requiresSelection,'Must choose up to one eligible Character from deck');
   const invalid=advanceEffectExecution(begun.execution,{cardIds:['wrong-color']});
   assert(invalid.error&&!invalid.complete,'Wrong-color Character was accepted');
   assert(invalid.execution.state.cards.every(card=>card.zone==='deck'),'Invalid selection moved a card');
   const played=advanceEffectExecution(begun.execution,{cardIds:['legal']});
   assert(played.complete&&!played.error,'Valid Character failed to play and shuffle');
   assert(played.execution.state.cards.find(card=>card.id==='legal')?.zone==='character','Selected Character did not enter the field');
   assert(played.execution.state.cards.filter(card=>card.zone==='deck').length===3,'Deck lost cards during selection or shuffle');
  }}
 ];
 if(row.code==='OP12-014')return ['luffy','red-event','wrong'].map(selected=>({name:`On Play search eligibility: ${selected}`,run(doc){
  const state=base();
  Object.assign(state.cards[0],{id:'luffy',name:'Monkey.D.Luffy',color:'Purple'});
  Object.assign(state.cards[1],{id:'red-event',name:'Event',color:'Red',type:'Event'});
  Object.assign(state.cards[2],{id:'wrong',name:'Koala',color:'Red',type:'Character'});
  const started=beginEffectExecution(state,'player','source','on-play',resolveEffectTiming(doc,'on-play').commands);
  assert(started.requiresSelection,'Search must request a selection');
  const result=advanceEffectExecution(started.execution,{cardIds:[selected]});
  if(selected==='wrong'){assert(result.error,'Ineligible Character was accepted');assert(result.execution.state.cards.every(c=>c.zone==='deck'),'Rejected selection changed zones');}
  else {assert(result.complete&&!result.error,'Eligible card was rejected');assert(result.execution.state.cards.find(c=>c.id===selected)?.zone==='hand','Selected card not added to hand');assert(result.execution.state.cards.filter(c=>c.zone==='deck')[0].id==='deck-5','Unselected looked-at cards were not bottom-decked');}
 }}));
 if(row.code==='OP13-086')return [{name:'On Play: search, trash remaining cards, then require a hand discard',run(doc){
  const state=base();Object.assign(state.cards[0],{name:'Saint Charlos',traits:['Celestial Dragons']});
  state.cards.push({id:'old-hand',owner:'player',zone:'hand',type:'Character'});
  const started=beginEffectExecution(state,'player','source','on-play',resolveEffectTiming(doc,'on-play').commands);
  assert(started.execution.commands[started.execution.commandIndex]?.value.kind==='search','Search must precede hand discard');
  const searched=advanceEffectExecution(started.execution,{cardIds:['deck-0']});
  assert(searched.requiresSelection&&!searched.complete,'Mandatory discard was skipped');
  assert(searched.execution.state.cards.find(c=>c.id==='deck-0')?.zone==='hand','Search result missing');
  assert(searched.execution.state.cards.filter(c=>c.zone==='trash').length===2,'Search leftovers not trashed');
  const finished=advanceEffectExecution(searched.execution,{cardIds:['old-hand']});
  assert(finished.complete&&!finished.error,'Hand discard did not complete');
 assert(finished.execution.state.cards.find(c=>c.id==='old-hand')?.zone==='trash','Selected hand card not trashed');
 }}];
 if(row.code==='OP10-099')return [...turnLifeCostScenarios(row),{name:'End of Your Turn: ready only a cost 3–8 Supernovas Character and grant it Blocker through opponent turn',run(doc){
  const ability=doc.ast.find(item=>item.trigger==='end-turn');if(!ability)throw new Error('End of Your Turn ability is missing');const ready=ability.actions[0],grant=ability.actions[1];assert(ready?.kind==='ready'&&ready.scope==='own-character'&&ready.amount===1&&ready.selection?.min===0&&ready.selection.max===1&&ready.trait==='Supernovas'&&ready.minCost===3&&ready.maxCost===8,'Ready target must be an optional cost 3–8 Supernovas Character');assert(grant?.kind==='grant-keyword'&&grant.keyword==='blocker'&&grant.scope==='previous-target'&&grant.until==='opponent-next-turn','Blocker must apply to only the selected Character until the end of opponent turn');
  const makeState=()=>{const state=base();state.cards=[{id:'source',owner:'player',zone:'character',type:'Character',effectSchema:doc},{id:'eligible',owner:'player',zone:'character',type:'Character',cost:5,traits:['Supernovas'],rested:true},{id:'low',owner:'player',zone:'character',type:'Character',cost:2,traits:['Supernovas'],rested:true},{id:'high',owner:'player',zone:'character',type:'Character',cost:9,traits:['Supernovas'],rested:true},{id:'wrong-trait',owner:'player',zone:'character',type:'Character',cost:5,traits:['Navy'],rested:true},{id:'life',owner:'player',zone:'life',type:'Character',faceUp:false},...Array.from({length:2},(_,index)=>({id:`deck-${index}`,owner:'player' as const,zone:'deck' as const,type:'Character' as const})),{id:'opp-life',owner:'opponent',zone:'life',type:'Character'},...Array.from({length:2},(_,index)=>({id:`opp-deck-${index}`,owner:'opponent' as const,zone:'deck' as const,type:'Character' as const})),{id:'opp-don-deck',owner:'opponent',zone:'don-deck',type:'DON!!' as const}];return state;};
  const commands=resolveEffectTiming(doc,'end-turn').commands;assert(commands[0]?.kind==='pay-cost'&&commands[0].value.kind==='turn-life','Life reveal cost must precede target choice');const start=beginEffectExecution(makeState(),'player','source','end-turn',commands);assert(start.requiresSelection,'Eligible target should be offered');assert(start.execution.state.cards.find(card=>card.id==='life')?.faceUp,'Life cost did not turn the top Life card face-up before target selection');const invalid=advanceEffectExecution(start.execution,{cardIds:['low']});assert(invalid.error&&!invalid.complete,'Cost-2 Supernova was accepted');const resolved=advanceEffectExecution(start.execution,{cardIds:['eligible']});assert(resolved.complete&&!resolved.error,'Legal Supernova target failed');assert(!resolved.execution.state.cards.find(card=>card.id==='eligible')?.rested&&resolved.execution.state.cards.find(card=>card.id==='eligible')?.temporaryKeywords?.includes('blocker'),'Selected Character did not ready and gain Blocker');assert(['low','high','wrong-trait'].every(id=>!resolved.execution.state.cards.find(card=>card.id===id)?.temporaryKeywords?.includes('blocker')),'Blocker leaked to an unselected or ineligible Character');
  const declined=beginEffectExecution(makeState(),'player','source','end-turn',commands);const skip=advanceEffectExecution(declined.execution,{cardIds:[]});assert(skip.complete&&!skip.error&&skip.execution.state.cards.every(card=>!card.temporaryKeywords?.includes('blocker')),'Declining the optional target still granted Blocker');
  const opponentTurn=beginTurn(resolved.execution.state,'opponent',2).state;assert(opponentTurn.cards.find(card=>card.id==='eligible')?.temporaryKeywords?.includes('blocker'),'Blocker expired before the opponent finished their turn');const playerTurn=beginTurn(opponentTurn,'player',3).state;assert(!playerTurn.cards.find(card=>card.id==='eligible')?.temporaryKeywords?.includes('blocker'),'Blocker did not expire when the player turn resumed');
 }}];
 if(row.code==='OP16-079')return [{name:'Character played from Trash: only a Land of Wano Character gets Rush',run(doc){
  const ability=doc.ast.filter(item=>item.trigger==='character-played-from-trash');assert(ability.length===1,'Trash-play event window is missing');const grant=ability[0].actions.find((action):action is Extract<EffectAction,{kind:'grant-keyword'}>=>action.kind==='grant-keyword');assert(grant?.keyword==='rush'&&grant.scope==='previous-played'&&grant.trait==='Land of Wano'&&grant.until==='turn-end','Rush must be granted only to the played Land of Wano Character until turn end');
  const state=base();state.cards=[{id:'listener',owner:'player',zone:'character',type:'Character',effectSchema:doc},{id:'legal',owner:'player',zone:'trash',type:'Character',traits:['Land of Wano']},{id:'wrong',owner:'player',zone:'trash',type:'Character',traits:['Navy']}];const play:EffectAction={kind:'play',source:'trash',amount:1,cardType:'Character',trait:'Land of Wano'};const played=applyEffectAction(state,'player',play,{cardIds:['legal']});assert(!played.error&&!played.requiresSelection&&played.state.cards.find(card=>card.id==='legal')?.zone==='character'&&played.state.cards.find(card=>card.id==='legal')?.temporaryKeywords?.includes('rush'),'Eligible trash play did not receive Rush');assert(!played.state.cards.find(card=>card.id==='wrong')?.temporaryKeywords?.includes('rush'),'Rush leaked onto a different Character');
  const noSource={...state,cards:state.cards.filter(card=>card.id!=='listener')},plain=applyEffectAction(noSource,'player',play,{cardIds:['legal']});assert(!plain.error&&!plain.requiresSelection&&!plain.state.cards.find(card=>card.id==='legal')?.temporaryKeywords?.includes('rush'),'Rush was granted without an on-board listener');
 }}];
 if(row.code==='OP03-074')return [...returnDonCostScenarios(row),{name:'schema-top-knot-reference main: DON!! 2 and Trigger invokes Main',run(doc){
  const main=doc.ast.filter(ast=>ast.trigger==='main');assert(main.length===1&&main[0].costs.some(cost=>cost.kind==='return-don'&&cost.amount===2),'Top Knot Main must pay DON!! −2');
  const normalized=doc.normalized.filter(effect=>effect.timing==='main');assert(normalized.length===1&&normalized[0].sequence.some(step=>step.type==='PAY_COST'&&step.cost.kind==='return-don'&&step.cost.amount===2),'Top Knot Main payment is missing from the execution plan');
  const trigger=doc.ast.filter(ast=>ast.trigger==='trigger');if(trigger.length){assert(trigger.length===1&&trigger[0].actions.some(action=>action.kind==='activate-referenced-effect'&&action.trigger==='main'),'Top Knot Trigger must invoke Main');const resolution=resolveEffectTiming(doc,'trigger');assert(resolution.status==='ready'&&resolution.commands.some(command=>command.kind==='pay-cost'&&command.value.kind==='return-don'&&command.value.amount===2)&&resolution.commands.some(command=>command.kind==='resolve-action'&&command.value.kind==='bottom-deck'),'Trigger must execute the same paid Main sequence');}
 }}];
 if(row.code==='EB04-022')return [...handTrashCostScenarios(row),{name:'schema-power when-attacking: Issho gives −2000 power',run(doc){
  const ability=doc.ast.filter(ast=>ast.trigger==='when-attacking');assert(ability.length===1,'Issho When Attacking window is missing');const action=ability[0].actions.find(action=>action.kind==='power');if(!action||action.kind!=='power')throw new Error('Issho power action is missing');assert(action.amount===-2000&&action.target==='opponent-character','Issho must reduce an opponent Character by 2000');
  const state=base();state.cards.push({id:'target',owner:'opponent',zone:'character',type:'Character',power:5000});const applied=applyEffectAction(state,'player',action,{targetId:'target',cardIds:['target']});assert(!applied.error&&applied.state.cards.find(card=>card.id==='target')?.powerModifier===-2000,'Printed negative power change was not applied');
 }}];
 // Exact, whole-text templates prevent a passing draw from certifying an omitted condition or second ability.
 const match=clean(row.effect_text).match(/^\[(On Play|Main|Counter|Trigger)\]\s*Draw (\d+) cards?\.?$/i);
 if(match){
  const timing=({'on play':'on-play',main:'main',counter:'counter',trigger:'trigger'} as const)[match[1].toLowerCase() as 'main'];
  const amount=Number(match[2]);
  return [{name:`${timing}: draw exactly ${amount} top cards`,run(doc){
   const commands=resolveEffectTiming(doc,timing).commands;
   const result=beginEffectExecution(base(),'player','source',timing,commands);
   assert(result.complete&&!result.error,'Effect did not complete');
   assert(canonical(result.execution.state.cards.filter(c=>c.zone==='hand').map(c=>c.id))===canonical(Array.from({length:amount},(_,i)=>`deck-${i}`)),'Wrong hand contents or draw order');
   assert(result.execution.state.cards.filter(c=>c.zone==='deck').length===8-amount,'Wrong remaining deck');
  }}];
 }
 if(row.code==='ST17-003')return [{name:'On Play: reorder top three, without adding a card to hand',run(doc){
  const started=beginEffectExecution(base(),'player','source','on-play',resolveEffectTiming(doc,'on-play').commands);
  assert(started.requiresSelection,'Must ask for top-three ordering');
  const result=advanceEffectExecution(started.execution,{cardIds:['deck-2','deck-0','deck-1']});
  assert(result.complete&&!result.error,'Reordering did not complete');
  assert(result.execution.state.cards.every(c=>c.zone==='deck'),'Reorder moved a card out of deck');
  assert(result.execution.state.cards.slice(0,3).map(c=>c.id).join(',')==='deck-2,deck-0,deck-1','Wrong top-three order');
 }}];
 if(row.code==='OP12-058')return [{name:'Main: optional top-deck play grants Rush only to the played Whitebeard Character',run(doc){
  const main=doc.ast.filter(ability=>ability.trigger==='main');assert(main.length===1,'Expected one Main ability');const ability=main[0];assert(ability.conditions.length===1&&ability.conditions[0].text==='your Leader\'s type includes "Whitebeard Pirates"','Main must be gated by the Whitebeard Pirates Leader');assert(ability.actions.length===3&&ability.actions[0].kind==='reveal'&&ability.actions[0].source==='deck'&&ability.actions[0].amount===1,'Main must reveal exactly the top card');const play=ability.actions[1];assert(play.kind==='play'&&play.source==='deck'&&play.topOnly&&play.amount===1&&play.cardType==='Character'&&play.trait==='Whitebeard Pirates'&&play.maxCost===9&&play.selection?.min===0&&play.selection.max===1,'Optional play must select only the revealed eligible Character');const grant=ability.actions[2];assert(grant.kind==='grant-keyword'&&grant.scope==='previous-played'&&grant.keyword==='rush'&&grant.until==='turn-end','Rush must apply only to the Character successfully played');
  const makeState=(hasLeader=true,eligible=true)=>{const state=base();state.cards=[{id:'event',owner:'player',zone:'hand',type:'Event',effectSchema:doc},{id:'leader',owner:'player',zone:'leader',type:'Leader',traits:hasLeader?['Whitebeard Pirates']:['Other']},...Array.from({length:2},(_,index)=>({id:`deck-${index}`,owner:'player' as const,zone:'deck' as const,type:'Character' as const,cost:9,traits:(eligible||index>0)?['Whitebeard Pirates']:['Other']})),{id:'opponent-leader',owner:'opponent',zone:'leader',type:'Leader'}];return state;};
  const legal=makeState(),started=beginEffectExecution(legal,'player','event','main',resolveEffectTiming(doc,'main').commands);assert(started.requiresSelection,'Eligible revealed card should offer an optional play choice');const played=advanceEffectExecution(started.execution,{cardIds:['deck-0']});assert(played.complete&&!played.error&&played.execution.state.cards.find(card=>card.id==='deck-0')?.zone==='character'&&played.execution.state.cards.find(card=>card.id==='deck-0')?.temporaryKeywords?.includes('rush'),'Played top Character did not receive Rush');assert(!played.execution.state.cards.find(card=>card.id==='deck-1')?.temporaryKeywords?.includes('rush'),'Rush leaked to another eligible card');
  const skippedStart=beginEffectExecution(makeState(),'player','event','main',resolveEffectTiming(doc,'main').commands),skipped=advanceEffectExecution(skippedStart.execution,{cardIds:[]});assert(skipped.complete&&!skipped.error&&skipped.execution.state.cards.find(card=>card.id==='deck-0')?.zone==='deck'&&!skipped.execution.state.cards.find(card=>card.id==='deck-0')?.temporaryKeywords?.includes('rush'),'Declining the optional play must keep the revealed card in deck and skip the grant');
  const ineligible=beginEffectExecution(makeState(true,false),'player','event','main',resolveEffectTiming(doc,'main').commands);assert(ineligible.complete&&!ineligible.error&&!ineligible.requiresSelection&&ineligible.execution.state.cards.every(card=>!card.temporaryKeywords?.includes('rush')),'An ineligible top card must not be played or receive Rush');
  const wrongLeader=beginEffectExecution(makeState(false),'player','event','main',resolveEffectTiming(doc,'main').commands);assert(wrongLeader.complete&&!wrongLeader.error&&!wrongLeader.requiresSelection&&wrongLeader.execution.state.cards.every(card=>card.zone!=='character'||card.id==='opponent-leader'),'A non-Whitebeard Leader must block the entire Main ability');
 }}];
 const text=clean(row.effect_text);
 return [...familyScenarios(text),...recoveryScenarios(text),...donScenarios(text),...keywordScenarios(text),...boundedKeywordGrantScenarios(row),...simplePowerScenarios(row),...simpleCounterPowerScenarios(row),...printedTargetPowerScenarios(row),...printedOpponentPowerScenarios(row),...printedRestScenarios(row),...printedPreventReadyScenarios(row),...printedReadyScenarios(row),...simpleKoScenarios(row),...referencedMainScenarios(row),...searchScenarios(row),...playScenarios(row),...bottomDeckScenarios(row),...handResetScenarios(row),...returnToHandScenarios(row),...reorderScenarios(row),...turnLifeCostScenarios(row),...simpleDrawScenarios(row),...conditionalMulticolorDrawScenarios(row),...selfTrashConditionalDrawScenarios(row),...mihawkRestedDonScenarios(row),...animalKingdomCompoundCostScenarios(row),...op10RestSelfSearchScenarios(row),...lifeToHandScenarios(row),...trashLifeScenarios(row),...handTrashCostScenarios(row),...returnDonCostScenarios(row),...readyDonScenarios(row),...readyDonNamedAllyGateScenarios(row),...restDonCostScenarios(row),...conditionalRestDonAdditionScenarios(row),...attachedDonRestScenarios(row),...standaloneActionScenarios(row)];
}
