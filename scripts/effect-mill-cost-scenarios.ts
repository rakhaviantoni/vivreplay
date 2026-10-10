import {compileEffectDocument,type EffectAction,type EffectCost} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {beginEffectExecution,advanceEffectExecution} from '../packages/domain/effect-controller';
import type {MatchEffectState} from '../packages/domain/match-effect-state';

type Identity={id:string;code:string;name:string;color:string;card_type:'Character'|'Leader'|'Event'|'Stage';cost:number;power:number;effect_text:string};
type Scenario={name:string;run:(doc:ReturnType<typeof compileEffectDocument>)=>void};
const assert:(condition:unknown,message:string)=>asserts condition=(condition,message)=>{if(!condition)throw new Error(message);};

export function optionalMillThenDebuffScenario(row:Identity):Scenario[]{
 const local=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 const expected=local.ast.find(ability=>ability.costs.some(cost=>cost.kind==='trash'&&cost.scope==='deck'&&cost.optional)&&ability.actions.some(action=>action.kind==='cost'&&action.target==='opponent-character'));
 if(!expected)return [];
 return [{name:`${row.code} real play: optional deck-trash cost resolves before opponent Character cost change`,run(doc){
  const ability=doc.ast.find(candidate=>candidate.trigger===expected.trigger);assert(Boolean(ability),'The printed timing window is missing');
  const cost=ability!.costs.find((item):item is Extract<EffectCost,{kind:'trash'}>=>item.kind==='trash'&&item.scope==='deck');
  const debuff=ability!.actions.find((item):item is Extract<EffectAction,{kind:'cost'}>=>item.kind==='cost'&&item.target==='opponent-character');
  assert(cost?.optional&&cost.amount>0&&debuff&&debuff.selection?.min===0,'The deck trash must be an optional cost before the opponent cost reduction');
  const normalized=doc.normalized.find(item=>item.timing===expected.trigger);
  assert(normalized?.sequence[0]?.type==='PAY_COST'&&normalized.sequence[0].cost.kind==='trash'&&normalized.sequence[0].cost.scope==='deck'&&normalized.sequence[1]?.type==='RESOLVE'&&normalized.sequence[1].action.kind==='cost','The optional mill must resolve before the cost reduction target choice');
  const base:MatchEffectState={turn:'player',cards:[{id:'source',owner:'player',zone:'character',type:'Character',effectSchema:doc},{id:'target',owner:'opponent',zone:'character',type:'Character',cost:5},{id:'deck-a',owner:'player',zone:'deck',type:'Character'},{id:'deck-b',owner:'player',zone:'deck',type:'Event'},{id:'deck-c',owner:'player',zone:'deck',type:'Character'}],turnEffects:[],restrictions:[],delayed:[]};
  const commands=resolveEffectTiming(doc,expected.trigger);assert(commands.status==='ready','The complete timing must compile to executable commands');
  const offered=beginEffectExecution(base,'player','source',expected.trigger,commands.commands);assert(offered.requiresSelection,'The optional mill cost must be offered before selecting the opponent Character');
  const accepted=advanceEffectExecution(offered.execution,{choice:'accept'});assert(!accepted.error&&!accepted.complete&&accepted.execution.state.cards.filter(card=>card.zone==='trash').length===cost.amount,'Accepting the cost must mill exactly the printed number of top cards');assert(accepted.requiresSelection,'The debuff target choice must follow the completed mill');
  const resolved=advanceEffectExecution(accepted.execution,{cardIds:['target'],targetId:'target'});assert(resolved.complete&&!resolved.error&&resolved.execution.state.cards.find(card=>card.id==='target')?.costModifier===debuff.amount,'The selected opponent Character did not receive the printed cost change');assert(resolved.execution.state.cards.filter(card=>card.zone==='trash').length===cost.amount,'Resolving the target must not mill extra cards');
  const declined=advanceEffectExecution(offered.execution,{choice:'decline'});assert(declined.complete&&!declined.error&&declined.execution.state.cards.every(card=>card.zone!=='trash')&&declined.execution.state.cards.find(card=>card.id==='target')?.costModifier===undefined,'Declining the cost must skip both the mill and its dependent debuff');
 }}];
}
