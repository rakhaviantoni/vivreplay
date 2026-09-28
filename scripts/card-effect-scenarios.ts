import {type EffectDocument} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {beginEffectExecution,advanceEffectExecution} from '../packages/domain/effect-controller';
import type {MatchEffectState} from '../packages/domain/match-effect-state';
import {familyScenarios} from './effect-family-scenarios';
export type Identity={id:string;code:string;name:string;color:string;card_type:'Character'|'Leader'|'Event'|'Stage';cost:number;power:number;effect_text:string};
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const clean=(text:string|null)=>text?.replace(/^NULL$/i,'').trim()??'';
const base=():MatchEffectState=>({turn:'player',cards:Array.from({length:8},(_,i)=>({id:`deck-${i}`,owner:'player',zone:'deck',type:'Character'})),turnEffects:[],restrictions:[],delayed:[]});
type Scenario={name:string;run:(doc:EffectDocument)=>void};
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
export function scenarios(row:Identity):Scenario[]{
 if(row.code==='OP12-062')return [true,false].map(eligible=>({name:`On Play: Sanji DON condition ${eligible?'met':'unmet'}`,run(doc){
  const state=base();state.cards.push({id:'leader',owner:'player',zone:'leader',type:'Leader',name:eligible?'Sanji':'Zoro'},{id:'reserve-don',owner:'player',zone:'don-deck',type:'DON!!'});
  const result=beginEffectExecution(state,'player','source','on-play',resolveEffectTiming(doc,'on-play').commands);
  assert(result.complete&&!result.error,'Conditional DON/draw did not complete');
  assert(result.execution.state.cards.filter(c=>c.zone==='hand').length===(eligible?1:0),'Draw ignored the Leader condition');
  const don=result.execution.state.cards.find(c=>c.id==='reserve-don');
  assert(don?.zone===(eligible?'cost-area':'don-deck'),'DON addition ignored condition');
  if(eligible)assert(don?.rested,'Added DON must be rested');
 }}));
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
 return familyScenarios(clean(row.effect_text));
}
