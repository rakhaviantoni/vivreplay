import {type EffectAction,type EffectDocument} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {beginEffectExecution,advanceEffectExecution} from '../packages/domain/effect-controller';
import type {MatchEffectState} from '../packages/domain/match-effect-state';
import {applyEffectAction,beginTurn,declareAttack,declareBlock,expireEffectModifiers,resolveBattle} from '../packages/domain/match-effect-state';
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
export function scenarios(row:Identity):Scenario[]{
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
 const text=clean(row.effect_text);
 return [...familyScenarios(text),...recoveryScenarios(text),...donScenarios(text),...keywordScenarios(text)];
}
